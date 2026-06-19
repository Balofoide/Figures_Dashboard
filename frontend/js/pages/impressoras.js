// =============================================================================
// Claybox³ᴰ — Impressoras Page
// CRUD de impressoras 3D
// =============================================================================

const ImpressorasPage = {
    items: [],
    filtered: [],
    selected: null,
    _sortField: null,
    _sortDir: 'asc',
    _search: '',

    async render() {
        this.items = await API.loadImpressoras();
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
                i.modelo.toLowerCase().includes(q) ||
                (i.filamento_tipo || '').toLowerCase().includes(q)
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
        this._search = Router.val('imp-search');
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
        const el = Router.$('page-impressoras');
        if (!el) return;

        el.innerHTML = `
            <div class="flex-between mb-24 anim-fade-up">
                <div>
                    <h1 class="page-title">Impressoras</h1>
                    <p class="page-sub">Gerencie suas impressoras 3D e filamentos</p>
                </div>
                <div class="flex gap-8">
                    ${UI.searchBar('imp-search', 'Buscar impressora...', 'ImpressorasPage._onSearch()')}
                    <button class="btn btn-primary" onclick="ImpressorasPage._showNew()">
                        ${UI.icons.plus} Nova Impressora
                    </button>
                </div>
            </div>

            <div class="flex gap-24 anim-fade-up stagger-1" style="height:calc(100vh - 200px)">
                <!-- Lista -->
                <div class="card flex-2" style="display:flex;flex-direction:column;overflow:hidden">
                    <div class="tbl-head">
                        <span class="tbl-cell ${this._sortClass('modelo')}" style="flex:2" onclick="ImpressorasPage._sort('modelo')">Modelo</span>
                        <span class="tbl-cell ${this._sortClass('watts')}" style="flex:0.8;text-align:center" onclick="ImpressorasPage._sort('watts')">Watts</span>
                        <span class="tbl-cell ${this._sortClass('filamento_tipo')}" style="flex:0.8;text-align:center" onclick="ImpressorasPage._sort('filamento_tipo')">Tipo</span>
                        <span class="tbl-cell" style="flex:1;text-align:center">Filamento</span>
                        <span class="tbl-cell" style="flex:0.8;text-align:center">Nozzle</span>
                    </div>
                    <div class="tbl-sep"></div>
                    <div class="tbl-body" style="flex:1;overflow-y:auto" id="imp-tbody">
                        ${this._renderRows()}
                    </div>
                </div>

                <!-- Detalhes -->
                <div class="card flex-1" style="display:flex;flex-direction:column;overflow-y:auto" id="imp-detail">
                    ${UI.empty('Selecione uma impressora para ver os detalhes')}
                </div>
            </div>
        `;

        // Restore search value
        const searchEl = Router.$('imp-search');
        if (searchEl && this._search) searchEl.value = this._search;
    },

    _renderRows() {
        if (this.filtered.length === 0) {
            return this._search
                ? UI.empty('Nenhuma impressora encontrada para a busca')
                : UI.empty('Nenhuma impressora cadastrada');
        }
        return this.filtered.map(item => {
            const filPct = item.filamento_total > 0 ? Math.min((item.filamento / item.filamento_total) * 100, 100) : 0;
            return `
                <div class="tbl-row ${this.selected?.id === item.id ? 'active' : ''}" onclick="ImpressorasPage._select('${item.id}')">
                    <span class="tbl-cell" style="flex:2;font-weight:500">${Router.esc(item.modelo)}</span>
                    <span class="tbl-cell" style="flex:0.8;text-align:center">${item.watts}W</span>
                    <span class="tbl-cell" style="flex:0.8;text-align:center">${Router.esc(item.filamento_tipo)}</span>
                    <span class="tbl-cell" style="flex:1;text-align:center">
                        <div>${item.filamento}/${item.filamento_total}g</div>
                        <div style="margin-top:2px;width:80%;margin:2px auto 0">${UI.progressBar(filPct)}</div>
                    </span>
                    <span class="tbl-cell" style="flex:0.8;text-align:center;color:var(--text-2)">${item.nozzle}mm</span>
                </div>
            `;
        }).join('');
    },

    _select(id) {
        this.selected = this.items.find(i => i.id === id) || null;

        // Update active state without full re-render
        const tbody = Router.$('imp-tbody');
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

        const detailEl = Router.$('imp-detail');
        if (!detailEl) return;

        const filPct = item.filamento_total > 0 ? Math.min((item.filamento / item.filamento_total) * 100, 100) : 0;

        detailEl.innerHTML = `
            <div class="flex-between" style="margin-bottom:var(--sp-16)">
                <div class="section-title" style="margin:0">Detalhes</div>
                <div class="flex gap-8">
                    <button class="btn btn-ghost btn-sm" onclick="ImpressorasPage._edit()">
                        ${UI.icons.edit} Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="ImpressorasPage._confirmDel()">
                        ${UI.icons.trash} Excluir
                    </button>
                </div>
            </div>

            <div class="tbl-sep mb-16"></div>

            <div class="card card-xs mb-12">
                <div class="detail-label">Modelo</div>
                <div class="detail-value lg">${Router.esc(item.modelo)}</div>
            </div>

            <!-- Filament bar -->
            <div class="mb-16">
                <div class="flex-between mb-8">
                    <span style="font-size:var(--font-sm);color:var(--text-2)">Filamento</span>
                    <span style="font-size:var(--font-sm);font-weight:600">${item.filamento}/${item.filamento_total}g</span>
                </div>
                ${UI.progressBar(filPct)}
                <div style="text-align:center;margin-top:var(--sp-8);font-size:var(--font-sm);color:var(--text-3)">${filPct.toFixed(0)}% restante</div>
            </div>

            <div class="grid grid-2 gap-8 mb-16">
                <div class="card card-xs">
                    <div class="detail-label">Potência</div>
                    <div class="detail-value">${item.watts}W</div>
                </div>
                <div class="card card-xs">
                    <div class="detail-label">Tipo de Filamento</div>
                    <div class="detail-value">${Router.esc(item.filamento_tipo)}</div>
                </div>
                <div class="card card-xs">
                    <div class="detail-label">Preço/Kg</div>
                    <div class="detail-value primary">${UI.currency(item.filamento_preco)}</div>
                </div>
                <div class="card card-xs">
                    <div class="detail-label">Nozzle</div>
                    <div class="detail-value">${item.nozzle}mm</div>
                </div>
            </div>

            <div class="card card-xs mb-12">
                <div class="detail-label">Dimensões</div>
                <div class="detail-value">${Router.esc(item.diametro)}</div>
            </div>

            <!-- Reabastecer filamento -->
            <div class="card card-xs" style="border: 1px solid var(--primary-soft)">
                <div class="detail-label">Reabastecer Filamento</div>
                <div class="flex gap-8 mt-8">
                    <div class="field" style="flex:1;margin:0">
                        <input id="reb-qtd" type="number" placeholder="Quantidade (g)" style="height:36px">
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="ImpressorasPage._refill()">Adicionar</button>
                </div>
            </div>
        `;
    },

    async _refill() {
        if (!this.selected) return;
        const qtd = Router.int('reb-qtd');
        if (qtd <= 0) {
            Router.toast('Informe uma quantidade válida', 'error');
            return;
        }

        const newFilament = Math.min(this.selected.filamento + qtd, this.selected.filamento_total);
        await API.updateImpressora({
            id: this.selected.id,
            filamento: newFilament,
        });

        Router.toast(`Filamento reabastecido (+${qtd}g)`, 'success');
        await this.render();
    },

    // ── Nova impressora ────────────────────────────────────────────
    _showNew() {
        Router.showModal(`
            <div class="modal-title">Nova Impressora</div>
            <div class="flex-col" style="gap:var(--sp-12)">
                <div class="field"><label>Modelo</label><input id="ni-modelo" placeholder="Ex: Creality Ender 3 V3 KE"></div>
                <div class="grid grid-2 gap-8">
                    <div class="field"><label>Potência (Watts)</label><input id="ni-watts" type="number" placeholder="Ex: 350"></div>
                    <div class="field"><label>Nozzle (mm)</label><input id="ni-nozzle" placeholder="Ex: 0.4"></div>
                </div>
                <div class="grid grid-3 gap-8">
                    <div class="field"><label>Filamento (g)</label><input id="ni-filamento" type="number" placeholder="Ex: 1000"></div>
                    <div class="field"><label>Tipo</label><input id="ni-tipo" placeholder="Ex: PLA"></div>
                    <div class="field"><label>Preço/Kg</label><input id="ni-preco" type="number" placeholder="Ex: 120"></div>
                </div>
                <div class="field"><label>Dimensões</label><input id="ni-dim" placeholder="Ex: 220x220x250"></div>
            </div>
            <div class="flex-end mt-16">
                <button class="btn btn-ghost" onclick="Router.hideModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="ImpressorasPage._submitNew()">Cadastrar</button>
            </div>
        `);
    },

    async _submitNew() {
        const modelo = Router.val('ni-modelo');
        if (!modelo) {
            Router.toast('Preencha o modelo da impressora', 'error');
            return;
        }

        await API.registerImpressora({
            modelo,
            watts: Router.int('ni-watts'),
            filamento: Router.int('ni-filamento'),
            filamentoPreco: Router.int('ni-preco'),
            filamentoTipo: Router.val('ni-tipo'),
            nozzle: Router.val('ni-nozzle'),
            diametro: Router.val('ni-dim'),
        });

        Router.hideModal();
        Router.toast('Impressora cadastrada!', 'success');
        await this.render();
    },

    // ── Editar ─────────────────────────────────────────────────────
    _edit() {
        const item = this.selected;
        if (!item) return;

        Router.showModal(`
            <div class="modal-title">Editar Impressora</div>
            <div class="flex-col" style="gap:var(--sp-12)">
                <div class="field"><label>Modelo</label><input id="ei-modelo" value="${Router.esc(item.modelo)}"></div>
                <div class="grid grid-2 gap-8">
                    <div class="field"><label>Potência (Watts)</label><input id="ei-watts" type="number" value="${item.watts}"></div>
                    <div class="field"><label>Nozzle (mm)</label><input id="ei-nozzle" value="${Router.esc(item.nozzle)}"></div>
                </div>
                <div class="grid grid-3 gap-8">
                    <div class="field"><label>Filamento (g)</label><input id="ei-filamento" type="number" value="${item.filamento}"></div>
                    <div class="field"><label>Filamento Total</label><input id="ei-fil-total" type="number" value="${item.filamento_total}"></div>
                    <div class="field"><label>Preço/Kg</label><input id="ei-preco" type="number" value="${item.filamento_preco}"></div>
                </div>
                <div class="grid grid-2 gap-8">
                    <div class="field"><label>Tipo</label><input id="ei-tipo" value="${Router.esc(item.filamento_tipo)}"></div>
                    <div class="field"><label>Dimensões</label><input id="ei-dim" value="${Router.esc(item.diametro)}"></div>
                </div>
            </div>
            <div class="flex-end mt-16">
                <button class="btn btn-ghost" onclick="Router.hideModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="ImpressorasPage._saveEdit()">Salvar</button>
            </div>
        `);
    },

    async _saveEdit() {
        if (!this.selected) return;

        await API.updateImpressora({
            id: this.selected.id,
            modelo: Router.optStr('ei-modelo'),
            watts: Router.optInt('ei-watts'),
            filamento: Router.optInt('ei-filamento'),
            filamentoTotal: Router.optInt('ei-fil-total'),
            filamentoPreco: Router.optInt('ei-preco'),
            filamentoTipo: Router.optStr('ei-tipo'),
            nozzle: Router.optStr('ei-nozzle'),
            diametro: Router.optStr('ei-dim'),
        });

        Router.hideModal();
        Router.toast('Impressora atualizada!', 'success');
        await this.render();
    },

    // ── Excluir ────────────────────────────────────────────────────
    _confirmDel() {
        if (!this.selected) return;

        UI.confirmModal(
            'Excluir Impressora',
            `Deseja excluir <strong style="color:var(--text)">${Router.esc(this.selected.modelo)}</strong>?`,
            () => ImpressorasPage._doDel(),
            'Excluir',
            true
        );
    },

    async _doDel() {
        if (!this.selected) return;
        await API.deleteImpressora(this.selected.id);
        Router.toast('Impressora excluída!', 'success');
        await this.render();
    },
};
