// =============================================================================
// Claybox³ᴰ — API Layer
// Wrapper para comunicação com o backend Tauri v2
// =============================================================================

const API = {
    async _invoke(cmd, args = {}) {
        if (window.__TAURI__ && window.__TAURI__.core) {
            return await window.__TAURI__.core.invoke(cmd, args);
        }
        throw new Error('Tauri runtime não disponível');
    },

    // Invoke que mostra erros ao usuário (para operações de escrita)
    async invoke(cmd, args = {}) {
        try {
            return await this._invoke(cmd, args);
        } catch (e) {
            console.error(`[API] ${cmd}:`, e);
            if (typeof Router !== 'undefined' && Router.toast) {
                Router.toast(`Erro: ${e}`, 'error');
            }
            return null;
        }
    },

    // Invoke silencioso (para operações de leitura — erros vão só pro console)
    async invokeQuiet(cmd, args = {}) {
        try {
            return await this._invoke(cmd, args);
        } catch (e) {
            console.error(`[API] ${cmd}:`, e);
            return null;
        }
    },

    // ── Pedidos (Clients) ──────────────────────────────────────────────
    async loadClients() {
        return (await this.invokeQuiet('load_clients')) || [];
    },
    async registerClient(data) {
        return await this.invoke('register_client', data);
    },
    async updateClient(data) {
        return await this.invoke('update_client', data);
    },
    async deleteClient(id) {
        return await this.invoke('delete_client', { id });
    },
    async getTotalVendas() {
        return (await this.invokeQuiet('get_total_vendas')) || 0;
    },
    async getVendasMes() {
        return (await this.invokeQuiet('get_vendas_mes')) || 0;
    },

    // ── Estoque ────────────────────────────────────────────────────────
    async loadEstoque() {
        return (await this.invokeQuiet('load_estoque')) || [];
    },
    async registerEstoque(data) {
        return await this.invoke('register_estoque', data);
    },
    async updateEstoque(data) {
        return await this.invoke('update_estoque', data);
    },
    async deleteEstoque(id) {
        return await this.invoke('delete_estoque', { id });
    },
    async getTotalEstoque() {
        return (await this.invokeQuiet('get_total_estoque')) || 0;
    },

    // ── Impressoras ────────────────────────────────────────────────────
    async loadImpressoras() {
        return (await this.invokeQuiet('load_impressoras')) || [];
    },
    async registerImpressora(data) {
        return await this.invoke('register_impressora', data);
    },
    async updateImpressora(data) {
        return await this.invoke('update_impressora', data);
    },
    async deleteImpressora(id) {
        return await this.invoke('delete_impressora', { id });
    },
    async getTotalFilamento() {
        return (await this.invokeQuiet('get_total_filamento')) || 0;
    },
    async getFilamentPrice(modelo) {
        return (await this.invokeQuiet('get_filament_price', { modelo })) || 0;
    },
    async updateFilament(modelo, gasto) {
        return await this.invoke('update_filament', { modelo, gasto });
    },

    // ── Calculadora ────────────────────────────────────────────────────
    async calculatePrice(data) {
        return (await this.invokeQuiet('calculate_price', data)) || 0;
    },

    // ── G-code Import ──────────────────────────────────────────────────
    async importGcode() {
        return await this.invoke('import_gcode');
    },

    // ── Configurações ──────────────────────────────────────────────────
    async loadSettings() {
        return (await this.invokeQuiet('load_settings')) || {
            energia: 0.92,
            lucro: 30,
            tema: 'midnight'
        };
    },
    async saveSettings(data) {
        return await this.invoke('save_settings', data);
    },

    // ── Melhor Envio ───────────────────────────────────────────────────
    async getAuthUrl() {
        return await this.invoke('get_auth_url');
    },
    async exchangeAuthCode(code) {
        return await this.invoke('exchange_auth_code', { code });
    },
    async refreshToken() {
        return await this.invoke('refresh_access_token');
    },
    async disconnectMelhorEnvio() {
        return await this.invoke('disconnect_melhor_envio');
    },
    async lookupCep(cep) {
        return await this.invoke('lookup_cep', { cep });
    },
    async calculateShipping(data) {
        return (await this.invoke('calculate_shipping', data)) || [];
    },
    async addToCart(data) {
        return await this.invoke('add_to_cart', data);
    },
    async getCart() {
        return (await this.invokeQuiet('get_cart')) || [];
    },
    async checkoutOrder(orderId) {
        return await this.invoke('checkout_order', { orderId });
    },
    async getLabels() {
        return (await this.invokeQuiet('get_labels')) || [];
    },
    async generateLabel(orderId) {
        return await this.invoke('generate_label', { orderId });
    },
    async printLabel(orderId) {
        return await this.invoke('print_label', { orderId });
    },
    async getTracking(orderId) {
        return (await this.invokeQuiet('get_tracking', { orderId })) || [];
    },
    async cancelLabel(orderId) {
        return await this.invoke('cancel_label', { orderId });
    },
};
