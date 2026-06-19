// =============================================================================
// Claybox³ᴰ — Router
// Navegação SPA com transições
// =============================================================================

const Router = {
    currentPage: 'dashboard',

    init() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page) this.navigate(page);
            });
        });

        // Modal: fechar ao clicar no overlay
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', e => {
                if (e.target === e.currentTarget) this.hideModal();
            });
            // Fechar com ESC
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
                    this.hideModal();
                }
            });
        }
    },

    async navigate(page) {
        this.currentPage = page;

        // Atualizar estado ativo do nav
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });

        // Mostrar página correta com animação
        document.querySelectorAll('.page').forEach(p => {
            const isTarget = p.id === `page-${page}`;
            p.classList.toggle('active', isTarget);
        });

        // Renderizar conteúdo
        try {
            switch (page) {
                case 'dashboard':
                    await DashboardPage.render();
                    break;
                case 'pedidos':
                    await PedidosPage.render();
                    break;
                case 'estoque':
                    await EstoquePage.render();
                    break;
                case 'impressoras':
                    await ImpressorasPage.render();
                    break;
                case 'envio':
                    await EnvioPage.render();
                    break;
                case 'settings':
                    await SettingsPage.render();
                    break;
            }
        } catch (e) {
            console.error(`[Router] Erro ao renderizar ${page}:`, e);
            const el = document.getElementById(`page-${page}`);
            if (el) {
                el.innerHTML = `
                    <div class="page-header">
                        <h1 class="page-title">Erro</h1>
                        <p class="page-sub">Não foi possível carregar a página: ${e.message}</p>
                    </div>
                `;
            }
        }
    },

    // ── Modal ──────────────────────────────────────────────────────────
    showModal(html) {
        const content = document.getElementById('modal-content');
        const overlay = document.getElementById('modal-overlay');
        if (content) content.innerHTML = html;
        if (overlay) overlay.classList.remove('hidden');
    },

    hideModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    // ── Toast ──────────────────────────────────────────────────────────
    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${type === 'success'
                    ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
                    : type === 'error'
                    ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
                    : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
                }
            </svg>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // ── Helpers ─────────────────────────────────────────────────────
    $(id) { return document.getElementById(id); },
    val(id) { return (document.getElementById(id)?.value || '').trim(); },
    num(id) { return parseFloat(document.getElementById(id)?.value || '0') || 0; },
    int(id) { return parseInt(document.getElementById(id)?.value || '0') || 0; },

    // Retorna null se campo vazio, para Optional<i32> no backend
    optInt(id) {
        const v = (document.getElementById(id)?.value || '').trim();
        if (v === '') return null;
        const n = parseInt(v);
        return isNaN(n) ? null : n;
    },

    // Retorna null se campo vazio, para Optional<String> no backend
    optStr(id) {
        const v = (document.getElementById(id)?.value || '').trim();
        return v === '' ? null : v;
    },

    // badge() → use UI.badge() from components.js

    // ── XSS Protection ─────────────────────────────────────────────
    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    // ── Debounce ────────────────────────────────────────────────────
    _timers: {},
    debounce(key, fn, ms = 300) {
        clearTimeout(this._timers[key]);
        this._timers[key] = setTimeout(fn, ms);
    },
};
