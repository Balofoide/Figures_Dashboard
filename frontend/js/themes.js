// =============================================================================
// Claybox³ᴰ — Theme System
// Múltiplos temas com persistência
// =============================================================================

const Themes = {
    available: [
        {
            id: 'midnight',
            name: 'Midnight',
            description: 'Azul escuro com acentos cyan',
            preview: ['#0a0f1e', '#38bdf8', '#818cf8'],
        },
        {
            id: 'forge',
            name: 'Forge',
            description: 'Industrial com acentos âmbar',
            preview: ['#171310', '#fb923c', '#fbbf24'],
        },
        {
            id: 'aurora',
            name: 'Aurora',
            description: 'Neon com acentos violeta',
            preview: ['#0e0a1a', '#d946ef', '#f472b6'],
        },
        {
            id: 'arctic',
            name: 'Arctic',
            description: 'Tema claro com acentos azul',
            preview: ['#f6f8fb', '#2563eb', '#7c3aed'],
        },
        {
            id: 'teal-sunset-dark',
            name: 'Teal Sunset',
            description: 'Teal e dourado escuro',
            preview: ['#100f17', '#309898', '#FF9F00'],
        },
        {
            id: 'teal-sunset-light',
            name: 'Teal Sunset Light',
            description: 'Teal e dourado claro',
            preview: ['#ffffff', '#309898', '#F4631E'],
        },
        {
            id: 'pastel-dream-dark',
            name: 'Pastel Dream',
            description: 'Lavanda e rosa pastel escuro',
            preview: ['#100f17', '#B5A7F5', '#FFB3D1'],
        },
        {
            id: 'pastel-dream-light',
            name: 'Pastel Dream Light',
            description: 'Lavanda e rosa claro',
            preview: ['#ffffff', '#B5A7F5', '#FFD8B3'],
        },
    ],

    current: 'midnight',

    init(themeId) {
        this.apply(themeId || 'midnight');
    },

    apply(themeId) {
        const theme = this.available.find(t => t.id === themeId);
        if (!theme) return;

        this.current = themeId;
        document.documentElement.setAttribute('data-theme', themeId);
    },

    getCurrent() {
        return this.available.find(t => t.id === this.current);
    },
};
