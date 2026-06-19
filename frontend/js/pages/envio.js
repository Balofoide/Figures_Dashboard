// =============================================================================
// Claybox³ᴰ — Página de Envio (Melhor Envio)
// Calcular frete, gerenciar carrinho, etiquetas e pedidos
// =============================================================================

const EnvioPage = {
    _tab: 'frete',          // frete | novo | carrinho | etiquetas
    _cotacoes: [],
    _carrinho: [],
    _etiquetas: [],
    _selectedTransport: null,
    _gcodeData: null,
    _pedidos: [],           // cached orders for selector
    _selectedPedido: null,  // currently selected order
    _novoServicos: [],      // shipping quotes for "Novo Envio" tab
    _novoServicoSel: null,  // selected service in "Novo Envio" tab
    _quotingNovo: false,    // loading state for novo envio quote

    async render() {
        this._settings = await API.loadSettings();
        this._pedidos = await API.loadClients();
        const el = Router.$('page-envio');
        if (!el) return;

        el.innerHTML = `
            <div class="page-content anim-fade-up">
                <!-- Header -->
                <div class="flex-between mb-24">
                    <div>
                        <h1 class="page-title">Envio</h1>
                        <p class="page-sub">Integração Melhor Envio — Frete, Carrinho e Etiquetas</p>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="envio-tabs mb-24">
                    ${['frete', 'novo', 'carrinho', 'etiquetas'].map(t => `
                        <button class="envio-tab ${this._tab === t ? 'active' : ''}"
                                onclick="EnvioPage._switchTab('${t}')">
                            ${t === 'frete' ? `${UI.icons.package} Calcular Frete` :
                              t === 'novo' ? `${UI.icons.plane} Novo Envio` :
                              t === 'carrinho' ? `${UI.icons.cart} Carrinho` :
                              `${UI.icons.tag} Etiquetas`}
                        </button>
                    `).join('')}
                </div>

                <!-- Tab Content -->
                <div id="envio-content"></div>
            </div>
        `;

        this._renderTab();
    },

    _switchTab(tab) {
        this._tab = tab;
        this.render();  // Re-render full page to update tab active state
    },

    async _renderTab() {
        const el = Router.$('envio-content');
        if (!el) return;

        // Check if ME is connected
        const s = this._settings;
        if (!s?.me_access_token) {
            el.innerHTML = `
                <div class="label-empty-state" style="padding:var(--sp-40) 0">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                    </svg>
                    <div class="empty-title">Conecte sua conta do Melhor Envio</div>
                    <div class="empty-sub" style="margin-bottom:var(--sp-16)">Para usar os recursos de envio, configure a integração nas Configurações.</div>
                    <button class="btn btn-primary" onclick="Router.navigate('settings')">
                        ${UI.icons.gear} Ir para Configurações
                    </button>
                </div>
            `;
            return;
        }

        switch (this._tab) {
            case 'frete':    this._showFrete(el); break;
            case 'novo':     this._showNovo(el); break;
            case 'carrinho': await this._renderCarrinho(el); break;
            case 'etiquetas': await this._renderEtiquetas(el); break;
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // TAB: Calcular Frete
    // ═══════════════════════════════════════════════════════════════════
    _showFrete(el) {
        el.innerHTML = `
            <div class="card" style="padding:var(--sp-24)">
                <div class="flex-between mb-16">
                    <span class="section-title" style="margin-bottom:0">Calcular Frete</span>
                    <button class="btn btn-accent btn-sm" onclick="EnvioPage._importGcodeEnvio('frete')" id="btn-import-frete" title="Importar .gcode ou .3mf para preencher peso">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="12" y1="18" x2="12" y2="12"/>
                            <polyline points="9 15 12 12 15 15"/>
                        </svg>
                        Importar Modelo
                    </button>
                </div>

                <!-- Gcode info card (hidden until import) -->
                <div id="frete-gcode-info" class="gcode-info-card hidden"></div>

                <div class="grid grid-2 gap-8">
                    <div class="field"><label>CEP Origem</label><input id="ef-cep-origem" placeholder="00000-000"></div>
                    <div class="field"><label>CEP Destino</label><input id="ef-cep-destino" placeholder="00000-000"></div>
                </div>

                <div class="section-title mt-16" style="font-size:var(--font-sm);margin-bottom:var(--sp-8)">Dimensões do Pacote</div>
                <div class="grid grid-4 gap-8">
                    <div class="field"><label>Largura (cm)</label><input id="ef-width" type="number" value="11"></div>
                    <div class="field"><label>Altura (cm)</label><input id="ef-height" type="number" value="2"></div>
                    <div class="field"><label>Comprimento (cm)</label><input id="ef-length" type="number" value="16"></div>
                    <div class="field"><label>Peso (kg)</label><input id="ef-weight" type="number" step="0.01" value="0.3"></div>
                </div>

                <div class="flex-end mt-16">
                    <button class="btn btn-primary" onclick="EnvioPage._calcularFrete()" id="btn-calc-frete">
                        ${UI.icons.package} Calcular Frete
                    </button>
                </div>
            </div>

            <!-- Resultados -->
            <div id="ef-resultados" style="margin-top:var(--sp-16)">
                ${this._cotacoes.length > 0 ? this._renderCotacoes() : ''}
            </div>
        `;

        // Apply input masks AFTER setting innerHTML
        UI.applyMask('ef-cep-origem', UI.maskCEP);
        UI.applyMask('ef-cep-destino', UI.maskCEP);

        // Pre-fill origin CEP from settings
        const cepOrigemEl = Router.$('ef-cep-origem');
        if (cepOrigemEl && this._settings?.remetente_cep) {
            cepOrigemEl.value = UI.maskCEP(this._settings.remetente_cep);
        }

        // Auto-fill weight from imported gcode
        if (this._gcodeData) {
            this._fillFreteFromGcode(this._gcodeData);
        }
    },

    _renderCotacoes() {
        return `
            <div class="card" style="padding:var(--sp-24)">
                <div class="flex-between mb-12">
                    <span class="section-title" style="margin-bottom:0">Opções de Envio</span>
                    <button class="btn btn-accent btn-sm" onclick="EnvioPage._useQuoteForNovo()" 
                            ${this._selectedTransport ? '' : 'disabled style="opacity:0.5;pointer-events:none"'}
                            title="Usar cotação selecionada no Novo Envio">
                        ${UI.icons.plane} Usar no Novo Envio
                    </button>
                </div>
                <div class="tbl-header" style="padding:8px 12px">
                    <span class="tbl-cell" style="flex:0.5">ID</span>
                    <span class="tbl-cell" style="flex:2">Transportadora</span>
                    <span class="tbl-cell" style="flex:1;text-align:center">Prazo</span>
                    <span class="tbl-cell" style="flex:1;text-align:right">Preço</span>
                </div>
                ${this._cotacoes.map(q => `
                    <div class="tbl-row ${this._selectedTransport && this._selectedTransport.id === q.id ? 'selected' : ''}"
                         onclick="EnvioPage._selectTransport(${q.id})"
                         style="cursor:pointer">
                        <span class="tbl-cell" style="flex:0.5;font-size:var(--font-xs);color:var(--text-3)">${q.id}</span>
                        <span class="tbl-cell" style="flex:2;font-weight:500">${Router.esc(q.name)}</span>
                        <span class="tbl-cell" style="flex:1;text-align:center">${q.delivery_time} dias</span>
                        <span class="tbl-cell" style="flex:1;text-align:right;color:var(--primary);font-weight:600">R$ ${Router.esc(q.price)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    _selectTransport(id) {
        this._selectedTransport = this._cotacoes.find(q => q.id === id) || null;
        const el = Router.$('ef-resultados');
        if (el) el.innerHTML = this._renderCotacoes();
    },

    // Transfer selected quote from Frete tab to Novo Envio tab
    _useQuoteForNovo() {
        if (!this._selectedTransport) return;
        // Pre-select the service for the Novo tab
        this._novoServicoSel = this._selectedTransport;
        // Copy all cotações as available services
        this._novoServicos = [...this._cotacoes];
        this._tab = 'novo';
        this.render();
        Router.toast('Cotação transferida para Novo Envio', 'success');
    },

    async _calcularFrete() {
        const cepOrigem = Router.val('ef-cep-origem');
        const cepDestino = Router.val('ef-cep-destino');

        if (!cepOrigem || !cepDestino) {
            Router.toast('Preencha os CEPs de origem e destino', 'error');
            return;
        }

        const btn = Router.$('btn-calc-frete');
        UI.setLoading(btn, true);

        const result = await API.calculateShipping({
            cepOrigem: cepOrigem.replace(/\D/g, ''),
            cepDestino: cepDestino.replace(/\D/g, ''),
            width: Router.num('ef-width'),
            height: Router.num('ef-height'),
            length: Router.num('ef-length'),
            weight: Router.num('ef-weight'),
        });

        UI.setLoading(btn, false);

        if (result && result.length > 0) {
            this._cotacoes = result;
            Router.toast(`${result.length} opções encontradas!`, 'success');
        } else {
            this._cotacoes = [];
            Router.toast('Nenhuma opção de frete encontrada', 'error');
        }

        const el = Router.$('ef-resultados');
        if (el) el.innerHTML = this._cotacoes.length > 0 ? this._renderCotacoes() : '';
    },

    // ═══════════════════════════════════════════════════════════════════
    // TAB: Novo Envio
    // ═══════════════════════════════════════════════════════════════════
    _showNovo(el) {
        const s = this._settings || {};

        // Build pedidos dropdown options
        const pedidoOpts = this._pedidos.map(p =>
            `<option value="${Router.esc(p.id)}" ${this._selectedPedido?.id === p.id ? 'selected' : ''}>${Router.esc(p.nome)} — ${Router.esc(p.modelo || 'Sem modelo')} (${UI.currency(p.preco)})</option>`
        ).join('');

        // Determine step states for stepper
        const hasAddresses = !!(s.remetente_cep || this._selectedPedido);
        const hasService = !!this._novoServicoSel;

        el.innerHTML = `
            <!-- Stepper -->
            <div class="envio-stepper anim-fade-in">
                <div class="envio-step active">
                    <span class="envio-step-number">1</span>
                    <span>Endereços</span>
                </div>
                <div class="envio-step-connector ${hasAddresses ? 'completed' : ''}"></div>
                <div class="envio-step ${hasAddresses ? 'active' : ''}">
                    <span class="envio-step-number">2</span>
                    <span>Pacote</span>
                </div>
                <div class="envio-step-connector"></div>
                <div class="envio-step ${hasService ? 'active' : ''}">
                    <span class="envio-step-number">3</span>
                    <span>Serviço</span>
                </div>
                <div class="envio-step-connector ${hasService ? 'completed' : ''}"></div>
                <div class="envio-step ${hasService ? 'active' : ''}">
                    <span class="envio-step-number">4</span>
                    <span>Confirmar</span>
                </div>
            </div>

            <!-- Order Selector -->
            <div class="order-selector anim-fade-in">
                <div class="order-selector-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                </div>
                <div class="field">
                    <label>Vincular Pedido</label>
                    <select id="en-pedido-select" onchange="EnvioPage._onPedidoSelect()">
                        <option value="">— Preencher manualmente —</option>
                        ${pedidoOpts}
                    </select>
                </div>
                <div id="en-pedido-badge"></div>
            </div>

            <div class="grid grid-2 gap-16">
                <!-- Remetente -->
                <div class="card" style="padding:var(--sp-20)">
                    <div class="section-header-icon">
                        <div class="icon-circle sender">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                            </svg>
                        </div>
                        <div class="section-header-text">
                            <span class="title">Remetente</span>
                            <span class="subtitle">Dados de quem envia</span>
                        </div>
                    </div>
                    <div class="flex-col" style="gap:var(--sp-8)">
                        <div class="field"><label>Nome</label><input id="en-from-nome" value="${Router.esc(s.remetente_nome || '')}"></div>
                        <div class="grid grid-2 gap-8">
                            <div class="field"><label>CPF/CNPJ</label><input id="en-from-cpf" value="${Router.esc(s.remetente_cpf || '')}"></div>
                            <div class="field"><label>Telefone</label><input id="en-from-tel" value="${Router.esc(s.remetente_telefone || '')}"></div>
                        </div>
                        <div class="grid grid-2 gap-8">
                            <div class="field"><label>CEP</label><input id="en-from-cep" value="${Router.esc(s.remetente_cep || '')}"></div>
                            <div class="field"><label>Número</label><input id="en-from-num" value="${Router.esc(s.remetente_numero || '')}"></div>
                        </div>
                        <div class="field"><label>Endereço</label><input id="en-from-end" value="${Router.esc(s.remetente_endereco || '')}"></div>
                        <div class="grid grid-2 gap-8">
                            <div class="field"><label>Cidade</label><input id="en-from-cidade" value="${Router.esc(s.remetente_cidade || '')}"></div>
                            <div class="field"><label>Estado (UF)</label><input id="en-from-estado" value="${Router.esc(s.remetente_estado || '')}" maxlength="2"></div>
                        </div>
                    </div>
                </div>

                <!-- Destinatário -->
                <div class="card" style="padding:var(--sp-20)">
                    <div class="section-header-icon">
                        <div class="icon-circle receiver">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                        </div>
                        <div class="section-header-text">
                            <span class="title">Destinatário</span>
                            <span class="subtitle">Dados de quem recebe</span>
                        </div>
                        <span id="en-dest-linked" class="order-linked-badge" style="display:none;margin-left:auto">Vinculado ao pedido</span>
                    </div>
                    <div class="flex-col" style="gap:var(--sp-8)">
                        <div class="field"><label>Nome</label><input id="en-to-nome"></div>
                        <div class="grid grid-2 gap-8">
                            <div class="field"><label>CPF/CNPJ</label><input id="en-to-cpf"></div>
                            <div class="field"><label>Telefone</label><input id="en-to-tel"></div>
                        </div>
                        <div class="grid grid-2 gap-8">
                            <div class="field"><label>CEP</label><input id="en-to-cep"></div>
                            <div class="field"><label>Número</label><input id="en-to-num"></div>
                        </div>
                        <div class="field"><label>Endereço</label><input id="en-to-end"></div>
                        <div class="grid grid-2 gap-8">
                            <div class="field"><label>Cidade</label><input id="en-to-cidade"></div>
                            <div class="field"><label>Estado (UF)</label><input id="en-to-estado" maxlength="2"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Pacote e Opções -->
            <div class="grid grid-2 gap-16 mt-16">
                <div class="card" style="padding:var(--sp-20)">
                    <div class="section-header-icon">
                        <div class="icon-circle package">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                <line x1="12" y1="22.08" x2="12" y2="12"/>
                            </svg>
                        </div>
                        <div class="section-header-text">
                            <span class="title">Pacote</span>
                            <span class="subtitle">Dimensões e peso</span>
                        </div>
                        <button class="btn btn-accent btn-sm" onclick="EnvioPage._importGcodeEnvio('novo')" id="btn-import-novo" title="Importar .gcode ou .3mf" style="margin-left:auto">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="12" y1="18" x2="12" y2="12"/>
                                <polyline points="9 15 12 12 15 15"/>
                            </svg>
                            Importar
                        </button>
                    </div>
                    <!-- Gcode info (hidden until import) -->
                    <div id="novo-gcode-info" class="gcode-info-card hidden"></div>
                    <div class="flex-col" style="gap:var(--sp-8)">
                        <div class="field"><label>Nome do Produto</label><input id="en-prod-nome"></div>
                        <div class="grid grid-2 gap-8">
                            <div class="field"><label>Quantidade</label><input id="en-prod-qtd" type="number" value="1"></div>
                            <div class="field"><label>Preço Unitário (R$)</label><input id="en-prod-preco" type="number" step="0.01"></div>
                        </div>
                        <div class="grid grid-4 gap-8">
                            <div class="field"><label>Largura (cm)</label><input id="en-pkg-w" type="number" value="11"></div>
                            <div class="field"><label>Altura (cm)</label><input id="en-pkg-h" type="number" value="2"></div>
                            <div class="field"><label>Comp. (cm)</label><input id="en-pkg-l" type="number" value="16"></div>
                            <div class="field"><label>Peso (kg)</label><input id="en-pkg-weight" type="number" step="0.01" value="0.3"></div>
                        </div>
                    </div>
                </div>

                <div class="card" style="padding:var(--sp-20)">
                    <div class="section-header-icon">
                        <div class="icon-circle service">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                        </div>
                        <div class="section-header-text">
                            <span class="title">Serviço de Envio</span>
                            <span class="subtitle">Selecione a transportadora</span>
                        </div>
                    </div>
                    <div class="flex-col" style="gap:var(--sp-8)">
                        <!-- Quote button -->
                        <button class="btn btn-primary btn-full" onclick="EnvioPage._cotarNovoEnvio()" id="btn-cotar-novo">
                            ${UI.icons.package} Cotar Frete
                        </button>

                        <!-- Dynamic services list -->
                        <div id="en-servicos-container">
                            ${this._renderNovoServicos()}
                        </div>

                        <!-- Extra options -->
                        <div class="field mt-8"><label>Valor Seguro (R$)</label><input id="en-seguro" type="number" step="0.01" value="0"></div>
                        <div style="display:flex;flex-direction:column;gap:var(--sp-8);margin-top:var(--sp-8)">
                            <label class="envio-checkbox">
                                <input type="checkbox" id="en-aviso"> Aviso de Recebimento
                            </label>
                            <label class="envio-checkbox">
                                <input type="checkbox" id="en-mao-propria"> Mão Própria
                            </label>
                            <label class="envio-checkbox">
                                <input type="checkbox" id="en-reversa"> Entrega Reversa
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Resumo do Envio (mostra quando serviço selecionado) -->
            <div id="en-resumo-container">
                ${this._renderEnvioResumo()}
            </div>

            <div class="flex-end mt-16">
                <button class="btn btn-primary" onclick="EnvioPage._enviar()" id="btn-enviar" style="min-width:200px"
                        ${!this._novoServicoSel ? 'disabled style="min-width:200px;opacity:0.5;pointer-events:none"' : ''}>
                    ${UI.icons.cart} Inserir no Carrinho
                </button>
            </div>
        `;

        // Apply input masks AFTER innerHTML
        UI.applyMask('en-from-cep', UI.maskCEP);
        UI.applyMask('en-from-tel', UI.maskPhone);
        UI.applyMask('en-from-cpf', UI.maskCPF);
        UI.applyMask('en-to-cep', UI.maskCEP);
        UI.applyMask('en-to-tel', UI.maskPhone);
        UI.applyMask('en-to-cpf', UI.maskCPF);

        // Auto-fill address from CEP (ViaCEP)
        this._setupCepLookup('en-from-cep', 'en-from-end', 'en-from-cidade', 'en-from-estado');
        this._setupCepLookup('en-to-cep', 'en-to-end', 'en-to-cidade', 'en-to-estado');

        // If a pedido was already selected, fill the form
        if (this._selectedPedido) {
            this._fillFromPedido(this._selectedPedido);
        }

        // Show linked badge if applicable
        this._updateLinkedBadge();
    },

    // ── CEP auto-lookup ─────────────────────────────────────────────
    _setupCepLookup(cepId, endId, cidadeId, estadoId) {
        const cepEl = Router.$(cepId);
        if (!cepEl) return;

        cepEl.addEventListener('blur', async () => {
            const cep = cepEl.value.replace(/\D/g, '');
            if (cep.length !== 8) return;

            try {
                const info = await API.lookupCep(cep);
                if (info) {
                    const endEl = Router.$(endId);
                    const cidEl = Router.$(cidadeId);
                    const estEl = Router.$(estadoId);

                    if (endEl && info.logradouro) endEl.value = info.logradouro;
                    if (cidEl && info.cidade) cidEl.value = info.cidade;
                    if (estEl && info.estado) estEl.value = info.estado;
                }
            } catch (e) {
                // CEP inválido — não preenche nada
            }
        });
    },

    // ── Render dynamic services list ────────────────────────────────
    _renderNovoServicos() {
        if (this._quotingNovo) {
            return `
                <div class="shipping-quote-empty">
                    <div class="spinner" style="width:24px;height:24px;border-width:2px"></div>
                    <span>Cotando serviços...</span>
                </div>
            `;
        }

        if (this._novoServicos.length === 0) {
            return `
                <div class="shipping-quote-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    <span>Preencha os CEPs e clique em<br><strong>"Cotar Frete"</strong> para ver serviços</span>
                </div>
            `;
        }

        return `
            <div class="shipping-quote-section anim-fade-in">
                <div class="shipping-quote-header">
                    <span class="section-title">Selecione o serviço</span>
                    <span style="font-size:var(--font-xs);color:var(--text-3)">${this._novoServicos.length} opções</span>
                </div>
                <div class="shipping-services">
                    ${this._novoServicos.map(svc => `
                        <div class="shipping-service-card ${this._novoServicoSel?.id === svc.id ? 'selected' : ''}"
                             onclick="EnvioPage._selectNovoServico(${svc.id})">
                            <div class="shipping-service-radio"></div>
                            <div class="shipping-service-info">
                                <div class="shipping-service-name">${Router.esc(svc.name)}</div>
                                <div class="shipping-service-delivery">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    ${svc.delivery_time} dia${svc.delivery_time !== 1 ? 's' : ''} útil${svc.delivery_time !== 1 ? 'eis' : ''}
                                </div>
                            </div>
                            <div class="shipping-service-price">R$ ${Router.esc(svc.price)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    _selectNovoServico(id) {
        this._novoServicoSel = this._novoServicos.find(s => s.id === id) || null;
        const container = Router.$('en-servicos-container');
        if (container) container.innerHTML = this._renderNovoServicos();
        // Update the summary
        const resumoEl = Router.$('en-resumo-container');
        if (resumoEl) resumoEl.innerHTML = this._renderEnvioResumo();
        // Update the submit button state
        const btnEnviar = Router.$('btn-enviar');
        if (btnEnviar) {
            if (this._novoServicoSel) {
                btnEnviar.disabled = false;
                btnEnviar.style.opacity = '1';
                btnEnviar.style.pointerEvents = 'auto';
            } else {
                btnEnviar.disabled = true;
                btnEnviar.style.opacity = '0.5';
                btnEnviar.style.pointerEvents = 'none';
            }
        }
    },

    async _cotarNovoEnvio() {
        const cepOrigem = Router.val('en-from-cep');
        const cepDestino = Router.val('en-to-cep');

        if (!cepOrigem || !cepDestino) {
            Router.toast('Preencha os CEPs do remetente e destinatário', 'error');
            return;
        }

        const btn = Router.$('btn-cotar-novo');
        UI.setLoading(btn, true);
        this._quotingNovo = true;
        const container = Router.$('en-servicos-container');
        if (container) container.innerHTML = this._renderNovoServicos();

        const result = await API.calculateShipping({
            cepOrigem: cepOrigem.replace(/\D/g, ''),
            cepDestino: cepDestino.replace(/\D/g, ''),
            width: Router.num('en-pkg-w'),
            height: Router.num('en-pkg-h'),
            length: Router.num('en-pkg-l'),
            weight: Router.num('en-pkg-weight'),
        });

        this._quotingNovo = false;
        UI.setLoading(btn, false);

        if (result && result.length > 0) {
            this._novoServicos = result;
            this._novoServicoSel = null; // reset selection
            Router.toast(`${result.length} serviços encontrados!`, 'success');
        } else {
            this._novoServicos = [];
            this._novoServicoSel = null;
            Router.toast('Nenhum serviço de envio encontrado', 'error');
        }

        // Re-query container after async operation (DOM might have changed)
        const updatedContainer = Router.$('en-servicos-container');
        if (updatedContainer) updatedContainer.innerHTML = this._renderNovoServicos();
    },

    // ── Order Selector ──────────────────────────────────────────────
    _onPedidoSelect() {
        const pedidoId = Router.val('en-pedido-select');
        if (!pedidoId) {
            this._selectedPedido = null;
            this._clearDestFields();
            this._updateLinkedBadge();
            return;
        }

        const pedido = this._pedidos.find(p => p.id === pedidoId);
        if (!pedido) return;

        this._selectedPedido = pedido;
        this._fillFromPedido(pedido);
        this._updateLinkedBadge();
        Router.toast(`Pedido de ${pedido.nome} vinculado!`, 'success');
    },

    _fillFromPedido(pedido) {
        // Destinatário — nome
        const nomeEl = Router.$('en-to-nome');
        if (nomeEl) nomeEl.value = pedido.nome || '';

        // Destinatário — CPF
        const cpfEl = Router.$('en-to-cpf');
        if (cpfEl) cpfEl.value = pedido.cpf ? UI.maskCPF(pedido.cpf) : '';

        // Destinatário — telefone
        const telEl = Router.$('en-to-tel');
        if (telEl) telEl.value = pedido.telefone ? UI.maskPhone(pedido.telefone) : '';

        // Destinatário — CEP
        const cepEl = Router.$('en-to-cep');
        if (cepEl) cepEl.value = pedido.cep ? UI.maskCEP(pedido.cep) : '';

        // Destinatário — endereço
        const endEl = Router.$('en-to-end');
        if (endEl) endEl.value = pedido.endereco || '';

        // Pacote — nome do produto (modelo)
        const prodNomeEl = Router.$('en-prod-nome');
        if (prodNomeEl) prodNomeEl.value = pedido.modelo || '';

        // Pacote — preço
        const precoEl = Router.$('en-prod-preco');
        if (precoEl && pedido.preco > 0) precoEl.value = pedido.preco;

        // Pacote — peso estimado do filamento gasto
        const weightEl = Router.$('en-pkg-weight');
        if (weightEl && pedido.filamento_gasto) {
            const gramas = parseFloat(pedido.filamento_gasto) || 0;
            if (gramas > 0) {
                const pesoKg = (gramas + 30) / 1000; // +30g embalagem
                weightEl.value = Math.max(0.3, pesoKg).toFixed(2);
            }
        }

        // Show linked badge on destinatário card
        const destLinked = Router.$('en-dest-linked');
        if (destLinked) destLinked.style.display = 'inline-flex';
    },

    _clearDestFields() {
        ['en-to-nome', 'en-to-cpf', 'en-to-tel', 'en-to-cep', 'en-to-num', 'en-to-end', 'en-to-cidade', 'en-to-estado'].forEach(id => {
            const el = Router.$(id);
            if (el) el.value = '';
        });
        ['en-prod-nome', 'en-prod-preco'].forEach(id => {
            const el = Router.$(id);
            if (el) el.value = '';
        });
        const destLinked = Router.$('en-dest-linked');
        if (destLinked) destLinked.style.display = 'none';
    },

    _updateLinkedBadge() {
        const badgeEl = Router.$('en-pedido-badge');
        if (!badgeEl) return;

        if (this._selectedPedido) {
            badgeEl.innerHTML = `<span class="order-linked-badge">Vinculado</span>`;
        } else {
            badgeEl.innerHTML = '';
        }
    },

    // ── Importar G-code/3MF para Envio ─────────────────────────────────
    async _importGcodeEnvio(context) {
        const btnId = context === 'frete' ? 'btn-import-frete' : 'btn-import-novo';
        const btn = Router.$(btnId);
        UI.setLoading(btn, true);

        const result = await API.importGcode();

        UI.setLoading(btn, false);

        if (!result) return;

        this._gcodeData = result;
        Router.toast('Modelo importado!', 'success');

        if (context === 'frete') {
            this._fillFreteFromGcode(result);
        } else {
            this._fillNovoFromGcode(result);
        }
    },

    _fillFreteFromGcode(data) {
        // Peso: filamento em gramas → kg (adicionar ~30g de embalagem)
        const weightEl = Router.$('ef-weight');
        if (weightEl && data.filamento_gramas > 0) {
            const pesoKg = (data.filamento_gramas + 30) / 1000;
            weightEl.value = Math.max(0.3, pesoKg).toFixed(2);
        }

        // Show info card
        const infoEl = Router.$('frete-gcode-info');
        if (infoEl) this._showGcodeInfoCard(infoEl, data);
    },

    _fillNovoFromGcode(data) {
        // Nome do produto
        const nomeEl = Router.$('en-prod-nome');
        if (nomeEl && data.nome_modelo) nomeEl.value = data.nome_modelo;

        // Peso: filamento + embalagem → kg
        const weightEl = Router.$('en-pkg-weight');
        if (weightEl && data.filamento_gramas > 0) {
            const pesoKg = (data.filamento_gramas + 30) / 1000;
            weightEl.value = Math.max(0.3, pesoKg).toFixed(2);
        }

        // Show info card
        const infoEl = Router.$('novo-gcode-info');
        if (infoEl) this._showGcodeInfoCard(infoEl, data);
    },

    _showGcodeInfoCard(infoEl, data) {
        const hours = Math.floor(data.tempo_horas);
        const mins = Math.round((data.tempo_horas - hours) * 60);
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        infoEl.classList.remove('hidden');
        infoEl.innerHTML = `
            <div class="flex-between" style="margin-bottom:var(--sp-4)">
                <div class="flex gap-8" style="align-items:center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span style="font-weight:600;font-size:var(--font-sm);color:var(--text)">${Router.esc(data.nome_modelo)}</span>
                </div>
            </div>
            <div class="flex gap-16" style="font-size:var(--font-xs);color:var(--text-3)">
                ${data.filamento_gramas > 0 ? `<span>${UI.icons.spool} ${Math.round(data.filamento_gramas)}g</span>` : ''}
                ${data.tempo_horas > 0 ? `<span>${UI.icons.timer} ${timeStr}</span>` : ''}
                ${data.filamento_tipo ? `<span>${UI.icons.palette} ${Router.esc(data.filamento_tipo)}</span>` : ''}
                ${data.slicer ? `<span>${UI.icons.gear} ${Router.esc(data.slicer)}</span>` : ''}
            </div>
        `;
    },

    // ── Render shipment summary ─────────────────────────────────────
    _renderEnvioResumo() {
        if (!this._novoServicoSel) return '';

        const svc = this._novoServicoSel;
        const fromNome = Router.val('en-from-nome') || this._settings?.remetente_nome || '—';
        const toNome = Router.val('en-to-nome') || '—';
        const prodNome = Router.val('en-prod-nome') || '—';

        return `
            <div class="envio-resumo anim-fade-in">
                <div class="envio-resumo-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span>Resumo do Envio</span>
                </div>
                <div class="envio-resumo-grid">
                    <div class="envio-resumo-item">
                        <span class="label">Remetente</span>
                        <span class="value">${Router.esc(fromNome)}</span>
                    </div>
                    <div class="envio-resumo-item">
                        <span class="label">Destinatário</span>
                        <span class="value">${Router.esc(toNome)}</span>
                    </div>
                    <div class="envio-resumo-divider"></div>
                    <div class="envio-resumo-item">
                        <span class="label">Produto</span>
                        <span class="value">${Router.esc(prodNome)}</span>
                    </div>
                    <div class="envio-resumo-item">
                        <span class="label">Transportadora</span>
                        <span class="value">${Router.esc(svc.name)}</span>
                    </div>
                    <div class="envio-resumo-item">
                        <span class="label">Prazo</span>
                        <span class="value">${svc.delivery_time} dia${svc.delivery_time !== 1 ? 's úteis' : ' útil'}</span>
                    </div>
                    <div class="envio-resumo-item">
                        <span class="label">Frete</span>
                        <span class="value primary">R$ ${Router.esc(svc.price)}</span>
                    </div>
                </div>
            </div>
        `;
    },

    async _enviar() {
        const toNome = Router.val('en-to-nome');
        if (!toNome) {
            Router.toast('Preencha o nome do destinatário', 'error');
            return;
        }

        // Use selected service from dynamic list, or fallback to null
        const servico = this._novoServicoSel?.id;
        if (!servico) {
            Router.toast('Selecione um serviço de envio (clique em "Cotar Frete" primeiro)', 'error');
            return;
        }

        const btn = Router.$('btn-enviar');
        UI.setLoading(btn, true);
        const cartData = {
            service: servico,
            fromCep: Router.val('en-from-cep').replace(/\D/g, ''),
            fromNome: Router.val('en-from-nome'),
            fromTelefone: Router.val('en-from-tel'),
            fromCpf: Router.val('en-from-cpf'),
            fromEndereco: Router.val('en-from-end'),
            fromNumero: Router.val('en-from-num'),
            fromCidade: Router.val('en-from-cidade'),
            fromEstado: Router.val('en-from-estado'),
            toCep: Router.val('en-to-cep').replace(/\D/g, ''),
            toNome: Router.val('en-to-nome'),
            toTelefone: Router.val('en-to-tel'),
            toCpf: Router.val('en-to-cpf'),
            toEndereco: Router.val('en-to-end'),
            toNumero: Router.val('en-to-num'),
            toCidade: Router.val('en-to-cidade'),
            toEstado: Router.val('en-to-estado'),
            width: Router.num('en-pkg-w'),
            height: Router.num('en-pkg-h'),
            length: Router.num('en-pkg-l'),
            weight: Router.num('en-pkg-weight'),
            produtoNome: Router.val('en-prod-nome'),
            quantidade: Router.num('en-prod-qtd'),
            precoUnitario: Router.num('en-prod-preco'),
            seguro: Router.num('en-seguro'),
            avisoRecebimento: Router.$('en-aviso')?.checked || false,
            maoPropria: Router.$('en-mao-propria')?.checked || false,
            reversa: Router.$('en-reversa')?.checked || false,
        };
        const result = await API.addToCart(cartData);

        UI.setLoading(btn, false);

        if (result) {
            Router.toast('Pedido inserido no carrinho!', 'success');
            // Reset state
            this._novoServicos = [];
            this._novoServicoSel = null;
            this._selectedPedido = null;
            this._tab = 'carrinho';
            this.render();
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // TAB: Carrinho
    // ═══════════════════════════════════════════════════════════════════
    async _renderCarrinho(el) {
        el.innerHTML = `<div class="empty"><span>Carregando carrinho...</span></div>`;

        this._carrinho = await API.getCart();

        if (!this._carrinho || this._carrinho.length === 0) {
            el.innerHTML = `
                <div class="card" style="padding:var(--sp-24)">
                    ${UI.empty('Carrinho vazio', '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>')}
                </div>
            `;
            return;
        }

        el.innerHTML = `
            <div class="card" style="padding:var(--sp-24)">
                <div class="flex-between mb-12">
                    <span class="section-title" style="margin-bottom:0">
                        ${UI.icons.cart} Carrinho (${this._carrinho.length})
                    </span>
                    <button class="btn btn-ghost btn-sm" onclick="EnvioPage._renderCarrinho(Router.$('envio-content'))">
                        Atualizar
                    </button>
                </div>

                <div class="tbl-header" style="padding:8px 12px">
                    <span class="tbl-cell" style="flex:2">Cliente</span>
                    <span class="tbl-cell" style="flex:2">Transportadora</span>
                    <span class="tbl-cell" style="flex:2">Produto</span>
                    <span class="tbl-cell" style="flex:1;text-align:right">Preço</span>
                    <span class="tbl-cell" style="flex:1;text-align:center">Ação</span>
                </div>

                ${this._carrinho.map(item => `
                    <div class="tbl-row">
                        <span class="tbl-cell" style="flex:2;font-weight:500">${Router.esc(item.nome_cliente)}</span>
                        <span class="tbl-cell" style="flex:2;color:var(--text-2)">${Router.esc(item.transportadora)}</span>
                        <span class="tbl-cell" style="flex:2;color:var(--text-2)">${Router.esc(item.produto)}</span>
                        <span class="tbl-cell" style="flex:1;text-align:right;color:var(--primary);font-weight:600">${UI.currency(item.preco)}</span>
                        <span class="tbl-cell" style="flex:1;text-align:center">
                            <button class="btn btn-primary btn-sm" onclick="EnvioPage._checkout('${Router.esc(item.id)}')" title="Finalizar">
                                ${UI.icons.check} Finalizar
                            </button>
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    async _checkout(orderId) {
        UI.confirmModal(
            'Finalizar Envio',
            'Deseja finalizar este envio? Isso irá gerar o pagamento.',
            async () => {
                Router.toast('Finalizando envio...', 'info');
                const result = await API.checkoutOrder(orderId);
                if (result) {
                    Router.toast('Envio finalizado com sucesso!', 'success');
                    await EnvioPage._renderCarrinho(Router.$('envio-content'));
                }
            },
            'Finalizar',
            false
        );
    },

    // ═══════════════════════════════════════════════════════════════════
    // TAB: Etiquetas
    // ═══════════════════════════════════════════════════════════════════
    _etiquetaFilter: 'all',  // all | pending | released | posted | delivered | canceled

    async _renderEtiquetas(el) {
        el.innerHTML = `<div class="empty"><span>Carregando etiquetas...</span></div>`;

        this._etiquetas = await API.getLabels();

        if (!this._etiquetas || this._etiquetas.length === 0) {
            el.innerHTML = `
                <div class="label-empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                        <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>
                    <span class="empty-title">Nenhuma etiqueta encontrada</span>
                    <span class="empty-sub">Finalize um envio no carrinho para ver suas etiquetas aqui</span>
                </div>
            `;
            return;
        }

        // Count by status
        const statusCounts = { all: this._etiquetas.length };
        for (const label of this._etiquetas) {
            const s = (label.status || '').toLowerCase();
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        }

        // Filter
        const filtered = this._etiquetaFilter === 'all'
            ? this._etiquetas
            : this._etiquetas.filter(l => (l.status || '').toLowerCase() === this._etiquetaFilter);

        const filterBtns = [
            { key: 'all', label: 'Todos' },
            { key: 'pending', label: 'Pendente' },
            { key: 'released', label: 'Liberado' },
            { key: 'posted', label: 'Postado' },
            { key: 'delivered', label: 'Entregue' },
            { key: 'canceled', label: 'Cancelado' },
        ];

        el.innerHTML = `
            <div class="flex-between mb-16">
                <div>
                    <span class="section-title" style="margin-bottom:0">
                        ${UI.icons.tag} Etiquetas
                    </span>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="EnvioPage._renderEtiquetas(Router.$('envio-content'))">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    Atualizar
                </button>
            </div>

            <!-- Status Filter Bar -->
            <div class="status-filter-bar">
                ${filterBtns.map(f => `
                    <button class="status-filter-btn ${this._etiquetaFilter === f.key ? 'active' : ''}"
                            onclick="EnvioPage._filterEtiquetas('${f.key}')">
                        ${f.label}
                        <span class="status-filter-count">${statusCounts[f.key] || 0}</span>
                    </button>
                `).join('')}
            </div>

            <!-- Label Cards Grid -->
            <div class="label-cards-grid">
                ${filtered.map(label => this._renderLabelCard(label)).join('')}
            </div>

            ${filtered.length === 0 ? `
                <div class="label-empty-state" style="padding:var(--sp-24)">
                    <span class="empty-title">Nenhuma etiqueta com este status</span>
                </div>
            ` : ''}
        `;
    },

    _filterEtiquetas(filter) {
        this._etiquetaFilter = filter;
        this._renderEtiquetas(Router.$('envio-content'));
    },

    _renderLabelCard(label) {
        const s = (label.status || '').toLowerCase();
        const initials = (label.cliente || '??').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const canGenerate = s === 'pending' || s === 'released';
        const canPrint = s === 'released' || s === 'posted' || s === 'delivered';
        const canTrack = s === 'posted' || s === 'delivered';
        const canCancel = s !== 'canceled' && s !== 'delivered';

        // Format date
        let dateStr = '';
        if (label.created_at) {
            try {
                const d = new Date(label.created_at);
                dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
            } catch { dateStr = label.created_at; }
        }

        return `
            <div class="label-card">
                <div class="label-card-header">
                    <div class="label-card-header-left">
                        <div class="label-card-avatar">${initials}</div>
                        <div class="label-card-client">
                            <span class="label-card-client-name">${Router.esc(label.cliente || '—')}</span>
                            <span class="label-card-client-product">${Router.esc(label.produto || 'Sem produto')}</span>
                        </div>
                    </div>
                    ${this._statusBadge(label.status)}
                </div>
                <div class="label-card-body">
                    <div class="label-card-info-grid">
                        <div class="label-card-info-item">
                            <span class="lci-label">Transportadora</span>
                            <span class="lci-value">${Router.esc(label.servico || '—')}</span>
                        </div>
                        <div class="label-card-info-item">
                            <span class="lci-label">Serviço</span>
                            <span class="lci-value">${Router.esc(label.servico_nome || '—')}</span>
                        </div>
                        <div class="label-card-info-item">
                            <span class="lci-label">CEP Destino</span>
                            <span class="lci-value">${Router.esc(label.cep_destino || '—')}</span>
                        </div>
                        <div class="label-card-info-item">
                            <span class="lci-label">Preço</span>
                            <span class="lci-value price">${UI.currency(label.preco)}</span>
                        </div>
                        ${dateStr ? `
                        <div class="label-card-info-item">
                            <span class="lci-label">Data</span>
                            <span class="lci-value">${dateStr}</span>
                        </div>` : ''}
                        <div class="label-card-info-item">
                            <span class="lci-label">ID</span>
                            <span class="label-card-id">${Router.esc(label.id).substring(0, 12)}…</span>
                        </div>
                    </div>
                    ${label.tracking ? `
                        <div class="label-card-tracking">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span class="tracking-code">${Router.esc(label.tracking)}</span>
                            <button class="btn-copy" onclick="EnvioPage._copyTracking(this, '${Router.esc(label.tracking)}')" title="Copiar código">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                            </button>
                        </div>
                    ` : ''}
                </div>
                <div class="label-card-actions">
                    ${canGenerate ? `
                        <button class="btn btn-accent btn-sm" onclick="EnvioPage._generateLabel('${Router.esc(label.id)}')">
                            ${UI.icons.tag} Gerar
                        </button>
                    ` : ''}
                    ${canPrint ? `
                        <button class="btn btn-primary btn-sm" onclick="EnvioPage._printLabel('${Router.esc(label.id)}')">
                            ${UI.icons.printer} Imprimir
                        </button>
                    ` : ''}
                    ${canTrack ? `
                        <button class="btn btn-ghost btn-sm" onclick="EnvioPage._trackLabel('${Router.esc(label.id)}')">
                            ${UI.icons.pin} Rastrear
                        </button>
                    ` : ''}
                    ${canCancel ? `
                        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="EnvioPage._cancelLabel('${Router.esc(label.id)}')">
                            ${UI.icons.close} Cancelar
                        </button>
                    ` : ''}
                    ${!canGenerate && !canPrint && !canTrack && !canCancel ? `
                        <span style="font-size:var(--font-xs);color:var(--text-3);padding:var(--sp-6)">Sem ações disponíveis</span>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // ── Label Actions ───────────────────────────────────────────────
    async _generateLabel(orderId) {
        Router.toast('Gerando etiqueta...', 'info');
        const result = await API.generateLabel(orderId);
        if (result) {
            Router.toast('Etiqueta gerada com sucesso!', 'success');
            await this._renderEtiquetas(Router.$('envio-content'));
        }
    },

    async _printLabel(orderId) {
        Router.toast('Obtendo etiqueta...', 'info');
        const url = await API.printLabel(orderId);
        if (url) {
            const modalHtml = `
                <div style="display:flex;flex-direction:column;gap:var(--sp-12)">
                    <div style="display:flex;align-items:center;gap:var(--sp-8)">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span style="font-weight:600;color:var(--text)">Etiqueta pronta!</span>
                    </div>
                    <p style="font-size:var(--font-sm);color:var(--text-2)">
                        Copie a URL abaixo e abra no navegador para visualizar e imprimir a etiqueta.
                    </p>
                    <div class="field">
                        <label>URL da etiqueta:</label>
                        <div style="display:flex;gap:var(--sp-6);align-items:center">
                            <input id="pdf-url-display" value="${url}" readonly style="flex:1;font-size:var(--font-xs);font-family:'JetBrains Mono',monospace;background:var(--surface-2);cursor:text">
                            <button class="btn btn-accent btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('pdf-url-display').value).then(()=>Router.toast('URL copiada!','success'))" style="white-space:nowrap">${UI.icons.clipboard} Copiar</button>
                        </div>
                    </div>
                </div>
            `;
            UI.infoModal('Imprimir Etiqueta', modalHtml);
            Router.toast('Etiqueta pronta! Copie a URL e abra no navegador.', 'success');
        }
    },

    async _trackLabel(orderId) {
        Router.toast('Buscando rastreamento...', 'info');
        const events = await API.getTracking(orderId);

        if (!events || events.length === 0) {
            // Show modal with empty state
            UI.infoModal(
                'Rastreamento',
                '<div style="text-align:center;padding:var(--sp-16);color:var(--text-3)"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:var(--sp-8)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><br>Nenhum evento de rastreamento encontrado ainda.<br><span style="font-size:var(--font-xs)">O rastreamento será atualizado após a postagem.</span></div>'
            );
            return;
        }

        // Build tracking timeline
        const timelineHtml = events.map(ev => `
            <div class="tracking-event">
                <div class="tracking-event-dot">
                    <div class="dot"></div>
                    <div class="line"></div>
                </div>
                <div class="tracking-event-content">
                    <div class="tracking-event-status">${Router.esc(ev.status)}</div>
                    <div class="tracking-event-description">${Router.esc(ev.description)}</div>
                    <div class="tracking-event-meta">
                        ${ev.date ? `<span>${UI.icons.calendar} ${Router.esc(ev.date)}</span>` : ''}
                        ${ev.city ? `<span>${UI.icons.pin} ${Router.esc(ev.city)}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        UI.infoModal(
            'Rastreamento',
            `<div class="tracking-timeline">${timelineHtml}</div>`
        );
    },

    async _cancelLabel(orderId) {
        UI.confirmModal(
            'Cancelar Envio',
            'Tem certeza que deseja cancelar este envio? Esta ação não pode ser desfeita.',
            async () => {
                Router.toast('Cancelando envio...', 'info');
                const result = await API.cancelLabel(orderId);
                if (result) {
                    Router.toast('Envio cancelado!', 'success');
                    await this._renderEtiquetas(Router.$('envio-content'));
                }
            },
            'Cancelar Envio',
            false
        );
    },

    _copyTracking(btn, code) {
        navigator.clipboard.writeText(code).then(() => {
            btn.classList.add('copied');
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                `;
            }, 2000);
            Router.toast('Código copiado!', 'success');
        });
    },

    _statusBadge(status) {
        const s = (status || '').toLowerCase();
        const cls = s === 'pending' ? 'badge-pendente'
            : s === 'released' ? 'badge-trabalhando'
            : s === 'posted' ? 'badge-concluido'
            : s === 'delivered' ? 'badge-entregue'
            : s === 'canceled' ? 'badge-pendente' : '';
        const label = s === 'pending' ? 'Pendente'
            : s === 'released' ? 'Liberado'
            : s === 'posted' ? 'Postado'
            : s === 'delivered' ? 'Entregue'
            : s === 'canceled' ? 'Cancelado'
            : Router.esc(status || '-');
        return `<span class="badge ${cls}">${label}</span>`;
    },
};
