// =============================================================================
// Claybox³ᴰ — Estoque Page
// CRUD de materiais de impressão 3D
// =============================================================================

const EstoquePage = {
    items: [],
    filtered: [],
    selected: null,
    _sortField: null,
    _sortDir: 'asc',
    _search: '',

    async render() {
        this.items = await API.loadEstoque();
        this.selected = null;
        this._search = '';
        this._applyFilter();
        this._renderMain();
    },

    _applyFilter() {
        let items = [...this.items];
        if (this._search) {
            const q = this._search.toLowerCase();
            items = items.filter(i =>
                i.material.toLowerCase().includes(q) ||
                (i.medida || '').toLowerCase().includes(q)
            );
        }
        if (this._sortField) {
            items.sort((a, b) => {
                let va = a[this._sortField], vb = b[this._sortField];
                if (typeof va === 'string') va = va.toLowerCase();
                if (typeof vb === 'string') vb = vb.toLowerCase();
                if (va < vb) return this._sortDir === 'asc' ? -1 : 1;
                if (va > vb) return this._sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        this.filtered = items;
    },

    _onSearch() {
        this._search = Router.val('est-search');
        this._applyFilter();
        this._renderMain();
    },

    _sort(field) {
        if (this._sortField === field) {
            this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this._sortField = field;
            this._sortDir = 'asc';
        }
        this._applyFilter();
        this._renderMain();
    },

    _sortClass(field) {
        if (this._sortField !== field) return 'tbl-sortable';
        return `tbl-sortable sort-${this._sortDir}`;
    },

    _renderMain() {
        const el = Router.$('page-estoque');
        if (!el) return;

        const totalEstoque = this.items.reduce((s, i) => s + (i.preco || 0), 0);

        el.innerHTML = `
            <div class="flex-between mb-24 anim-fade-up">
                <div>
                    <h1 class="page-title">Estoque</h1>
                    <p class="page-sub">Gerencie seus materiais de impressão 3D</p>
                </div>
                <div class="flex gap-8">
                    <div class="stat-card" style="padding:var(--sp-10) var(--sp-16);flex-direction:row;gap:var(--sp-12);align-items:center">
                        <span class="stat-label" style="margin:0">Valor Total</span>
                        <span style="font-size:var(--font-lg);font-weight:700;color:var(--primary)">${UI.currency(totalEstoque)}</span>
                    </div>
                    ${UI.searchBar('est-search', 'Buscar material...', 'EstoquePage._onSearch()')}
                    <button class="btn btn-primary" onclick="EstoquePage._showNew()">
                        ${UI.icons.plus} Novo Material
                    </button>
                </div>
            </div>

            <div class="flex gap-24 anim-fade-up stagger-1" style="height:calc(100vh - 200px)">
                <!-- Lista -->
                <div class="card flex-2" style="display:flex;flex-direction:column;overflow:hidden">
                    <div class="tbl-head">
                        <span class="tbl-cell ${this._sortClass('material')}" style="flex:2" onclick="EstoquePage._sort('material')">Material</span>
                        <span class="tbl-cell ${this._sortClass('quantidade')}" style="flex:1;text-align:center" onclick="EstoquePage._sort('quantidade')">Quantidade</span>
                        <span class="tbl-cell" style="flex:1;text-align:center">Medida</span>
                        <span class="tbl-cell ${this._sortClass('preco')}" style="flex:1;text-align:right" onclick="EstoquePage._sort('preco')">Preço</span>
                    </div>
                    <div class="tbl-sep"></div>
                    <div class="tbl-body" style="flex:1;overflow-y:auto" id="estoque-tbody">
                        ${this._renderRows()}
                    </div>
                </div>

                <!-- Detalhes -->
                <div class="card flex-1" style="display:flex;flex-direction:column;overflow-y:auto" id="estoque-detail">
                    ${UI.empty('Selecione um material para ver os detalhes')}
                </div>
            </div>
        `;

        // Restore search value
        const searchEl = Router.$('est-search');
        if (searchEl && this._search) searchEl.value = this._search;
    },

    _renderRows() {
        if (this.filtered.length === 0) {
            return this._search
                ? UI.empty('Nenhum material encontrado para a busca')
                : UI.empty('Nenhum material cadastrado');
        }
        return this.filtered.map(item => {
            const qty = item.quantidade || 0;
            const total = item.quantidade_total || 1;
            const pct = Math.min((qty / total) * 100, 100);
            return `
                <div class="tbl-row ${this.selected?.id === item.id ? 'active' : ''}" onclick="EstoquePage._select('${item.id}')">
                    <span class="tbl-cell" style="flex:2">
                        <div style="font-weight:500">${Router.esc(item.material)}</div>
                        <div style="margin-top:4px;width:80%">${UI.progressBar(pct)}</div>
                    </span>
                    <span class="tbl-cell" style="flex:1;text-align:center">${qty}/${total}</span>
                    <span class="tbl-cell" style="flex:1;text-align:center;color:var(--text-2)">${Router.esc(item.medida)}</span>
                    <span class="tbl-cell" style="flex:1;text-align:right;font-weight:600;color:var(--primary)">${UI.currency(item.preco)}</span>
                </div>
            `;
        }).join('');
    },

    _select(id) {
        this.selected = this.items.find(i => i.id === id) || null;

        // Update active state without full re-render
        const tbody = Router.$('estoque-tbody');
        if (tbody) {
            tbody.querySelectorAll('.tbl-row').forEach(row => {
                const isActive = row.getAttribute('onclick')?.includes(id);
                row.classList.toggle('active', isActive);
            });
        }

        this._renderDetail();
    },

    _renderDetail() {
        const item = this.selected;
        if (!item) return;

        const detailEl = Router.$('estoque-detail');
        if (!detailEl) return;

        const qty = item.quantidade || 0;
        const total = item.quantidade_total || 1;
        const pct = Math.min((qty / total) * 100, 100);

        detailEl.innerHTML = `
            <div class="flex-between" style="margin-bottom:var(--sp-16)">
                <div class="section-title" style="margin:0">Detalhes</div>
                <div class="flex gap-8">
                    <button class="btn btn-ghost btn-sm" onclick="EstoquePage._edit()">
                        ${UI.icons.edit} Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="EstoquePage._confirmDel()">
                        ${UI.icons.trash} Excluir
                    </button>
                </div>
            </div>

            <div class="tbl-sep mb-16"></div>

            <div class="card card-xs mb-12">
                <div class="detail-label">Material</div>
                <div class="detail-value lg">${Router.esc(item.material)}</div>
            </div>

            <div class="mb-16">
                <div class="flex-between mb-8">
                    <span style="font-size:var(--font-sm);color:var(--text-2)">Estoque</span>
                    <span style="font-size:var(--font-sm);font-weight:600">${qty}/${total}${item.medida}</span>
                </div>
                ${UI.progressBar(pct)}
                <div style="text-align:center;margin-top:var(--sp-8);font-size:var(--font-sm);color:var(--text-3)">${pct.toFixed(0)}% restante</div>
            </div>

            <div class="grid grid-2 gap-8 mb-16">
                <div class="card card-xs">
                    <div class="detail-label">Medida</div>
                    <div class="detail-value">${Router.esc(item.medida)}</div>
                </div>
                <div class="card card-xs">
                    <div class="detail-label">Preço</div>
                    <div class="detail-value primary">${UI.currency(item.preco)}</div>
                </div>
            </div>

            <div class="highlight">
                ${Math.round(pct)}% disponível
            </div>
        `;
    },

    // ── Novo material ──────────────────────────────────────────────
    _showNew() {
        Router.showModal(`
            <div class="modal-title">Novo Material</div>
            <div class="flex-col" style="gap:var(--sp-12)">
                <div class="field"><label>Material</label><input id="ne-material" placeholder="Ex: PLA Preto"></div>
                <div class="grid grid-2 gap-8">
                    <div class="field"><label>Quantidade Atual</label><input id="ne-qtd" type="number" placeholder="Ex: 800"></div>
                    <div class="field"><label>Quantidade Total</label><input id="ne-qtd-total" type="number" placeholder="Ex: 1000"></div>
                </div>
                <div class="grid grid-2 gap-8">
                    <div class="field"><label>Medida</label><input id="ne-medida" placeholder="Ex: g, ml, un"></div>
                    <div class="field"><label>Preço (R$)</label><input id="ne-preco" type="number" step="0.01" placeholder="Ex: 120"></div>
                </div>
            </div>
            <div class="flex-end mt-16">
                <button class="btn btn-ghost" onclick="Router.hideModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="EstoquePage._submitNew()">Cadastrar</button>
            </div>
        `);
    },

    async _submitNew() {
        const material = Router.val('ne-material');
        if (!material) {
            Router.toast('Preencha o nome do material', 'error');
            return;
        }

        await API.registerEstoque({
            material,
            quantidade: Router.num('ne-qtd'),
            quantidadeTotal: Router.int('ne-qtd-total'),
            medida: Router.val('ne-medida'),
            preco: Router.num('ne-preco'),
        });

        Router.hideModal();
        Router.toast('Material cadastrado!', 'success');
        await this.render();
    },

    // ── Editar ─────────────────────────────────────────────────────
    _edit() {
        const item = this.selected;
        if (!item) return;

        Router.showModal(`
            <div class="modal-title">Editar Material</div>
            <div class="flex-col" style="gap:var(--sp-12)">
                <div class="field"><label>Material</label><input id="ee-material" value="${Router.esc(item.material)}"></div>
                <div class="grid grid-2 gap-8">
                    <div class="field"><label>Quantidade Atual</label><input id="ee-qtd" type="number" value="${item.quantidade}"></div>
                    <div class="field"><label>Quantidade Total</label><input id="ee-qtd-total" type="number" value="${item.quantidade_total}"></div>
                </div>
                <div class="grid grid-2 gap-8">
                    <div class="field"><label>Medida</label><input id="ee-medida" value="${Router.esc(item.medida)}"></div>
                    <div class="field"><label>Preço (R$)</label><input id="ee-preco" type="number" step="0.01" value="${item.preco}"></div>
                </div>
            </div>
            <div class="flex-end mt-16">
                <button class="btn btn-ghost" onclick="Router.hideModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="EstoquePage._saveEdit()">Salvar</button>
            </div>
        `);
    },

    async _saveEdit() {
        if (!this.selected) return;

        await API.updateEstoque({
            id: this.selected.id,
            material: Router.optStr('ee-material'),
            quantidade: Router.num('ee-qtd'),
            quantidadeTotal: Router.optInt('ee-qtd-total'),
            medida: Router.optStr('ee-medida'),
            preco: Router.num('ee-preco'),
        });

        Router.hideModal();
        Router.toast('Material atualizado!', 'success');
        await this.render();
    },

    // ── Excluir ────────────────────────────────────────────────────
    _confirmDel() {
        if (!this.selected) return;

        UI.confirmModal(
            'Excluir Material',
            `Deseja excluir <strong style="color:var(--text)">${Router.esc(this.selected.material)}</strong> do estoque?`,
            () => EstoquePage._doDel(),
            'Excluir',
            true
        );
    },

    async _doDel() {
        if (!this.selected) return;
        await API.deleteEstoque(this.selected.id);
        Router.toast('Material excluído!', 'success');
        await this.render();
    },
};
