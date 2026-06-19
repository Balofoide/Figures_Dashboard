// =============================================================================
// Claybox³ᴰ — Store
// Estado global simples e reativo
// =============================================================================

const Store = {
    _data: {
        clients: [],
        estoque: [],
        impressoras: [],
        settings: null,
        totalVendas: 0,
        vendasMes: 0,
        totalFilamento: 0,
        totalEstoque: 0,
    },
    _listeners: [],

    get(key) {
        return this._data[key];
    },

    set(key, value) {
        this._data[key] = value;
        this._notify(key);
    },

    onChange(callback) {
        this._listeners.push(callback);
    },

    _notify(key) {
        this._listeners.forEach(cb => cb(key, this._data[key]));
    },

    // ── Carregar todos os dados do backend ─────────────────────────
    async loadAll() {
        const [clients, estoque, impressoras, settings, totalVendas, vendasMes, totalFilamento, totalEstoque] =
            await Promise.all([
                API.loadClients(),
                API.loadEstoque(),
                API.loadImpressoras(),
                API.loadSettings(),
                API.getTotalVendas(),
                API.getVendasMes(),
                API.getTotalFilamento(),
                API.getTotalEstoque(),
            ]);

        this._data = {
            clients,
            estoque,
            impressoras,
            settings,
            totalVendas,
            vendasMes,
            totalFilamento,
            totalEstoque,
        };

        this._listeners.forEach(cb => cb('all', this._data));
    },

    // ── Recarregar uma categoria específica ────────────────────────
    async refreshClients() {
        const [clients, totalVendas, vendasMes] = await Promise.all([
            API.loadClients(),
            API.getTotalVendas(),
            API.getVendasMes(),
        ]);
        this.set('clients', clients);
        this.set('totalVendas', totalVendas);
        this.set('vendasMes', vendasMes);
    },

    async refreshEstoque() {
        const [estoque, totalEstoque] = await Promise.all([
            API.loadEstoque(),
            API.getTotalEstoque(),
        ]);
        this.set('estoque', estoque);
        this.set('totalEstoque', totalEstoque);
    },

    async refreshImpressoras() {
        const [impressoras, totalFilamento] = await Promise.all([
            API.loadImpressoras(),
            API.getTotalFilamento(),
        ]);
        this.set('impressoras', impressoras);
        this.set('totalFilamento', totalFilamento);
    },
};
