// =============================================================================
// Claybox³ᴰ — Settings Page
// Configurações de custo + seleção de tema + dados do remetente + integração ME
// =============================================================================

const SettingsPage = {
    settings: null,

    async render() {
        this.settings = await API.loadSettings();
        this._renderMain();
    },

    _renderMain() {
        const el = Router.$('page-settings');
        if (!el) return;

        const s = this.settings || { energia: 0.92, lucro: 30, tema: 'midnight' };

        // Gerar cards de tema
        const themeCards = Themes.available.map(t => {
            const isActive = Themes.current === t.id;
            return `
                <div class="card card-sm ${isActive ? 'theme-card-active' : 'theme-card'}" data-theme-id="${t.id}"
                     style="cursor:pointer;position:relative;overflow:hidden;${isActive ? 'border-color:var(--primary);box-shadow:0 0 12px var(--primary-glow)' : ''}">
                    <!-- Preview colors -->
                    <div style="display:flex;gap:6px;margin-bottom:var(--sp-10)">
                        ${t.preview.map(c => `<div style="width:24px;height:24px;border-radius:var(--radius-xs);background:${c};border:1px solid rgba(255,255,255,0.1)"></div>`).join('')}
                    </div>
                    <div style="font-weight:600;margin-bottom:var(--sp-2)">${t.name}</div>
                    <div style="font-size:var(--font-xs);color:var(--text-2)">${t.description}</div>
                    ${isActive ? `<div style="position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:var(--primary);box-shadow:0 0 8px var(--primary-glow)"></div>` : ''}
                </div>
            `;
        }).join('');

        // Melhor Envio integration status
        const meConnected = !!(s.me_access_token && s.me_access_token.length > 10);
        const meExpires = s.me_token_expires || 0;
        const now = Math.floor(Date.now() / 1000);
        const daysLeft = meExpires > now ? Math.ceil((meExpires - now) / 86400) : 0;
        const meExpired = meExpires > 0 && meExpires <= now;
        const meAmbiente = s.me_ambiente || 'sandbox';

        el.innerHTML = `
            <div class="page-header anim-fade-up">
                <h1 class="page-title">Configurações</h1>
                <p class="page-sub">Personalize o Claybox³ᴰ</p>
            </div>

            <div class="flex gap-24">
                <!-- Custos padrão -->
                <div class="card flex-1 anim-fade-up stagger-1">
                    <div class="section-title">Custos Padrão</div>
                    <p style="font-size:var(--font-sm);color:var(--text-2);margin-bottom:var(--sp-20)">
                        Valores padrão usados ao calcular o preço de novos pedidos.
                    </p>
                    <div class="flex-col" style="gap:var(--sp-16)">
                        <div class="field">
                            <label>Preço da Energia (R$/kWh)</label>
                            <input id="s-energia" type="number" step="0.01" value="${s.energia}" placeholder="Ex: 0.92">
                        </div>
                        <div class="field">
                            <label>Margem de Lucro (%)</label>
                            <input id="s-lucro" type="number" value="${s.lucro}" placeholder="Ex: 30">
                        </div>

                        <button class="btn btn-primary mt-16" onclick="SettingsPage._save()">
                            Salvar Configurações
                        </button>
                    </div>
                </div>

                <!-- Temas -->
                <div class="card flex-1 anim-fade-up stagger-2">
                    <div class="section-title">Aparência</div>
                    <p style="font-size:var(--font-sm);color:var(--text-2);margin-bottom:var(--sp-20)">
                        Escolha um tema visual para a aplicação.
                    </p>
                    <div class="grid grid-2 gap-12">
                        ${themeCards}
                    </div>
                </div>
            </div>

            <!-- Integração Melhor Envio -->
            <div class="card anim-fade-up stagger-3" style="margin-top:var(--sp-20)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-16)">
                    <div style="display:flex;align-items:center;gap:var(--sp-10)">
                        <div style="width:40px;height:40px;border-radius:var(--radius-sm);background:linear-gradient(135deg,#6c5ce7,#a29bfe);display:flex;align-items:center;justify-content:center">${UI.icons.package}</div>
                        <div>
                            <div class="section-title" style="margin:0">Integração Melhor Envio</div>
                            <p style="font-size:var(--font-xs);color:var(--text-3);margin:0">Conecte sua conta para envios automáticos</p>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:var(--sp-8)">
                        ${meConnected && !meExpired ? `
                            <span class="badge badge-concluido" style="display:flex;align-items:center;gap:4px">
                                <span style="width:6px;height:6px;border-radius:50%;background:var(--success);display:inline-block"></span>
                                Conectado ${daysLeft > 0 ? `· ${daysLeft}d restantes` : ''}
                            </span>
                        ` : meExpired ? `
                            <span class="badge badge-pendente" style="display:flex;align-items:center;gap:4px">
                                <span style="width:6px;height:6px;border-radius:50%;background:var(--warning);display:inline-block"></span>
                                Token expirado
                            </span>
                        ` : `
                            <span class="badge" style="display:flex;align-items:center;gap:4px;opacity:0.6">
                                <span style="width:6px;height:6px;border-radius:50%;background:var(--text-3);display:inline-block"></span>
                                Desconectado
                            </span>
                        `}
                    </div>
                </div>

                <!-- Ambiente -->
                <div style="display:flex;gap:var(--sp-8);margin-bottom:var(--sp-16)">
                    <button class="btn btn-sm ${meAmbiente === 'sandbox' ? 'btn-accent' : 'btn-ghost'}" 
                            onclick="SettingsPage._setAmbiente('sandbox')" style="flex:1">
                        ${UI.icons.beaker} Sandbox
                    </button>
                    <button class="btn btn-sm ${meAmbiente === 'production' ? 'btn-accent' : 'btn-ghost'}" 
                            onclick="SettingsPage._setAmbiente('production')" style="flex:1">
                        ${UI.icons.rocket} Produção
                    </button>
                </div>

                <!-- Credenciais -->
                <div class="grid grid-2 gap-8" style="margin-bottom:var(--sp-8)">
                    <div class="field">
                        <label>Client ID</label>
                        <input id="s-me-client-id" value="${Router.esc(s.me_client_id || '')}" placeholder="Ex: 6118">
                    </div>
                    <div class="field">
                        <label>Client Secret</label>
                        <input id="s-me-client-secret" type="password" value="${Router.esc(s.me_client_secret || '')}" placeholder="Seu client secret">
                    </div>
                </div>
                <div class="field" style="margin-bottom:var(--sp-12)">
                    <label>Redirect URI <span style="font-weight:400;color:var(--text-3)">(mesma configurada no painel do Melhor Envio)</span></label>
                    <input id="s-me-redirect-uri" value="${Router.esc(s.me_redirect_uri || 'https://exemple.com/token')}" placeholder="https://...">
                </div>

                <button class="btn btn-primary btn-sm" onclick="SettingsPage._saveMeCredentials()" style="margin-bottom:var(--sp-20)">
                    Salvar Credenciais
                </button>

                <!-- Ações de Conexão -->
                <div style="border-top:1px solid var(--border);padding-top:var(--sp-16);display:flex;gap:var(--sp-8);flex-wrap:wrap">
                    ${!meConnected || meExpired ? `
                        <button class="btn btn-primary" onclick="SettingsPage._connectMelhorEnvio()" id="me-connect-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                            </svg>
                            Conectar com Melhor Envio
                        </button>
                    ` : `
                        <button class="btn btn-accent" onclick="SettingsPage._refreshMeToken()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                            </svg>
                            Renovar Token
                        </button>
                        <button class="btn btn-ghost" style="color:var(--danger)" onclick="SettingsPage._disconnectMelhorEnvio()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                            Desconectar
                        </button>
                    `}
                </div>

                <div id="me-auth-status" style="margin-top:var(--sp-12)"></div>
            </div>

            <!-- Dados do Remetente -->
            <div class="card anim-fade-up stagger-4" style="margin-top:var(--sp-20)">
                <div class="section-title">${UI.icons.upload} Dados do Remetente</div>
                <p style="font-size:var(--font-sm);color:var(--text-2);margin-bottom:var(--sp-20)">
                    Preencha seus dados de remetente para envios via Melhor Envio. Esses dados serão carregados automaticamente ao criar novos envios.
                </p>
                <div class="grid grid-2 gap-8">
                    <div class="field"><label>Nome</label><input id="s-rem-nome" value="${Router.esc(s.remetente_nome || '')}"></div>
                    <div class="field"><label>Telefone</label><input id="s-rem-tel" value="${Router.esc(s.remetente_telefone || '')}"></div>
                </div>
                <div class="grid grid-3 gap-8" style="margin-top:var(--sp-8)">
                    <div class="field"><label>CPF/CNPJ</label><input id="s-rem-cpf" value="${Router.esc(s.remetente_cpf || '')}"></div>
                    <div class="field"><label>CEP</label><input id="s-rem-cep" value="${Router.esc(s.remetente_cep || '')}"></div>
                    <div class="field"><label>Número</label><input id="s-rem-num" value="${Router.esc(s.remetente_numero || '')}"></div>
                </div>
                <div class="field" style="margin-top:var(--sp-8)"><label>Endereço</label><input id="s-rem-end" value="${Router.esc(s.remetente_endereco || '')}"></div>
                <div class="grid grid-2 gap-8" style="margin-top:var(--sp-8)">
                    <div class="field"><label>Cidade</label><input id="s-rem-cidade" value="${Router.esc(s.remetente_cidade || '')}"></div>
                    <div class="field"><label>Estado (UF)</label><input id="s-rem-estado" value="${Router.esc(s.remetente_estado || '')}" maxlength="2"></div>
                </div>
                <button class="btn btn-primary mt-16" onclick="SettingsPage._saveRemetente()">
                    Salvar Dados do Remetente
                </button>
            </div>
        `;

        // Apply input masks
        UI.applyMask('s-rem-cep', UI.maskCEP);
        UI.applyMask('s-rem-tel', UI.maskPhone);
        UI.applyMask('s-rem-cpf', UI.maskCPF);

        // Bind theme card clicks via event delegation (more reliable on Windows WebView2)
        el.querySelectorAll('[data-theme-id]').forEach(card => {
            card.addEventListener('click', () => {
                SettingsPage._selectTheme(card.dataset.themeId);
            });
        });
    },

    // ── Melhor Envio Actions ───────────────────────────────────────────

    async _setAmbiente(ambiente) {
        const energia = Router.num('s-energia') || this.settings?.energia || 0.92;
        const lucro = Router.num('s-lucro') || this.settings?.lucro || 30;
        await API.saveSettings({
            energia,
            lucro,
            tema: Themes.current,
            meAmbiente: ambiente,
        });
        this.settings = await API.loadSettings();
        this._renderMain();
        Router.toast(`Ambiente alterado para ${ambiente === 'production' ? 'Produção' : 'Sandbox'}`, 'success');
    },

    async _saveMeCredentials() {
        const clientId = Router.val('s-me-client-id');
        const clientSecret = Router.val('s-me-client-secret');
        const redirectUri = Router.val('s-me-redirect-uri');

        if (!clientId || !clientSecret) {
            Router.toast('Preencha Client ID e Client Secret', 'error');
            return;
        }

        const energia = Router.num('s-energia') || this.settings?.energia || 0.92;
        const lucro = Router.num('s-lucro') || this.settings?.lucro || 30;

        await API.saveSettings({
            energia,
            lucro,
            tema: Themes.current,
            meClientId: clientId,
            meClientSecret: clientSecret,
            meRedirectUri: redirectUri || 'https://exemple.com/token',
        });

        this.settings = await API.loadSettings();
        Router.toast('Credenciais salvas!', 'success');
    },

    async _connectMelhorEnvio() {
        // Ensure credentials are saved first
        const clientId = Router.val('s-me-client-id');
        const clientSecret = Router.val('s-me-client-secret');

        if (!clientId || !clientSecret) {
            Router.toast('Preencha e salve o Client ID e Client Secret primeiro', 'error');
            return;
        }

        // Save credentials first
        await this._saveMeCredentials();

        Router.toast('Gerando URL de autorização...', 'info');
        const authUrl = await API.getAuthUrl();
        if (!authUrl) return;

        const redirectUri = this.settings?.me_redirect_uri || 'https://exemple.com/token';

        const modalHtml = `
            <div style="display:flex;flex-direction:column;gap:var(--sp-12)">
                <p style="color:var(--text-2);font-size:var(--font-sm);line-height:1.5">
                    <strong>Passo 1:</strong> Copie a URL abaixo e abra no navegador para autorizar o aplicativo.
                </p>
                <div style="display:flex;gap:var(--sp-6);align-items:center">
                    <input id="me-auth-url" value="${authUrl}" readonly style="flex:1;font-size:var(--font-xs);font-family:'JetBrains Mono',monospace;background:var(--surface-2);cursor:text">
                    <button class="btn btn-accent btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('me-auth-url').value).then(()=>Router.toast('URL copiada!','success'))" style="white-space:nowrap">${UI.icons.clipboard} Copiar</button>
                </div>
                <hr style="border:none;border-top:1px solid var(--border);margin:var(--sp-4) 0">
                <p style="color:var(--text-2);font-size:var(--font-sm);line-height:1.5">
                    <strong>Passo 2:</strong> Após autorizar, você será redirecionado. Copie o <code style="background:var(--surface-2);padding:2px 6px;border-radius:4px;font-size:var(--font-xs)">code</code> da URL e cole abaixo.
                </p>
                <div style="padding:var(--sp-10);background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:var(--font-xs);color:var(--text-3)">
                    <strong>Exemplo da URL de redirect:</strong><br>
                    <code>${redirectUri}?code=<span style="color:var(--primary);font-weight:700">COPIE_ESTE_CODE</span>&state=...</code>
                </div>
                <div class="field">
                    <label>Cole o code aqui:</label>
                    <input id="me-auth-code" placeholder="Cole o code da URL aqui..." style="font-family:'JetBrains Mono',monospace;font-size:var(--font-xs)">
                </div>
            </div>
        `;

        UI.confirmModal(
            UI.icons.link + ' Conectar com Melhor Envio',
            modalHtml,
            async () => {
                const code = Router.val('me-auth-code');
                if (!code) {
                    Router.toast('Cole o code antes de confirmar', 'error');
                    return;
                }
                Router.toast('Trocando code por token...', 'info');
                const result = await API.exchangeAuthCode(code);
                if (result) {
                    Router.toast(result, 'success');
                    SettingsPage.settings = await API.loadSettings();
                    SettingsPage._renderMain();
                }
            },
            'Conectar',
            false
        );
    },

    async _refreshMeToken() {
        Router.toast('Renovando token...', 'info');
        const result = await API.refreshToken();
        if (result) {
            Router.toast(result, 'success');
            this.settings = await API.loadSettings();
            this._renderMain();
        }
    },

    async _disconnectMelhorEnvio() {
        UI.confirmModal(
            UI.icons.warning + ' Desconectar Melhor Envio',
            '<p style="color:var(--text-2)">Tem certeza que deseja desconectar sua conta do Melhor Envio? Você precisará reconectar para usar os recursos de envio.</p>',
            async () => {
                const result = await API.disconnectMelhorEnvio();
                if (result) {
                    Router.toast('Conta desconectada', 'success');
                    this.settings = await API.loadSettings();
                    this._renderMain();
                }
            },
            'Desconectar',
            false
        );
    },

    // ── Theme & Settings ──────────────────────────────────────────────

    _selectTheme(themeId) {
        // Preservar valores antes do re-render destruir os inputs
        const energia = Router.num('s-energia') || this.settings?.energia || 0.92;
        const lucro = Router.num('s-lucro') || this.settings?.lucro || 30;

        Themes.apply(themeId);
        this._renderMain();

        // Restaurar valores nos novos inputs
        const eEl = Router.$('s-energia');
        const lEl = Router.$('s-lucro');
        if (eEl) eEl.value = energia;
        if (lEl) lEl.value = lucro;

        // Auto-save with new theme
        this._saveThemeDirect(energia, lucro, themeId);
    },

    async _saveThemeDirect(energia, lucro, themeId) {
        await API.saveSettings({
            energia: parseFloat(energia) || 0.92,
            lucro: parseFloat(lucro) || 30,
            tema: themeId,
        });
    },

    async _save() {
        const energia = Router.num('s-energia');
        const lucro = Router.num('s-lucro');

        if (!energia || !lucro) {
            Router.toast('Preencha todos os campos', 'error');
            return;
        }

        await API.saveSettings({
            energia,
            lucro,
            tema: Themes.current,
        });

        this.settings = await API.loadSettings();
        Router.toast('Configurações salvas!', 'success');
    },

    async _saveRemetente() {
        await API.saveSettings({
            energia: Router.num('s-energia') || this.settings?.energia || 0.92,
            lucro: Router.num('s-lucro') || this.settings?.lucro || 30,
            tema: Themes.current,
            remetenteNome: Router.val('s-rem-nome'),
            remetenteCpf: Router.val('s-rem-cpf').replace(/\D/g, ''),
            remetenteCep: Router.val('s-rem-cep').replace(/\D/g, ''),
            remetenteEndereco: Router.val('s-rem-end'),
            remetenteEstado: Router.val('s-rem-estado'),
            remetenteCidade: Router.val('s-rem-cidade'),
            remetenteNumero: Router.val('s-rem-num'),
            remetenteTelefone: Router.val('s-rem-tel').replace(/\D/g, ''),
        });

        this.settings = await API.loadSettings();
        Router.toast('Dados do remetente salvos!', 'success');
    },
};
