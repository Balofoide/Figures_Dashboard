// =============================================================================
// Claybox³ᴰ — Dashboard Page
// Visão geral com stats, estoque, gráfico de status e pedidos recentes
// =============================================================================

const DashboardPage = {
    async render() {
        const el = Router.$('page-dashboard');
        if (!el) return;

        await Store.loadAll();

        const clients = Store.get('clients');
        const estoque = Store.get('estoque');
        const totalVendas = Store.get('totalVendas');
        const vendasMes = Store.get('vendasMes');
        const totalFilamento = Store.get('totalFilamento');
        const totalEstoque = Store.get('totalEstoque');
        const impressoras = Store.get('impressoras');

        // Filament percentage (assuming 1kg rolls, total as grams)
        const filPct = impressoras.length > 0
            ? Math.min((totalFilamento / (impressoras.reduce((s, i) => s + i.filamento_total, 0) || 1)) * 100, 100)
            : 0;

        // Status distribution
        const statusCounts = { Pendente: 0, Trabalhando: 0, Concluido: 0, Entregue: 0 };
        clients.forEach(c => {
            const s = (c.status || '').trim();
            if (statusCounts[s] !== undefined) statusCounts[s]++;
        });
        const maxCount = Math.max(...Object.values(statusCounts), 1);

        el.innerHTML = `
            <div class="page-header anim-fade-up">
                <h1 class="page-title">Dashboard</h1>
                <p class="page-sub">Visão geral do seu negócio de impressão 3D</p>
            </div>

            <!-- Stats Row -->
            <div class="grid grid-4 mb-24">
                ${UI.statCard(
                    'Total de Pedidos',
                    clients.length,
                    UI.icons.orders,
                    'primary',
                    1
                )}
                ${UI.statCard(
                    'Vendas no Mês',
                    UI.currency(vendasMes),
                    UI.icons.chart,
                    'accent',
                    2
                )}
                ${UI.statCard(
                    'Faturamento Total',
                    UI.currency(totalVendas),
                    UI.icons.money,
                    'primary',
                    3
                )}
                ${UI.statCard(
                    'Estoque (Valor)',
                    UI.currency(totalEstoque),
                    UI.icons.stock,
                    'secondary',
                    4
                )}
            </div>

            <!-- Content Row -->
            <div class="flex gap-24" style="height:calc(100vh - 320px)">
                <!-- Left Column: Estoque + Status Chart -->
                <div class="flex-1" style="display:flex;flex-direction:column;gap:var(--sp-16)">
                    <!-- Estoque Panel -->
                    <div class="card anim-fade-up stagger-5" style="display:flex;flex-direction:column;overflow:hidden;flex:1">
                        <div class="flex-between mb-16">
                            <div class="section-title" style="margin:0">Estoque</div>
                            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('estoque')">Ver tudo</button>
                        </div>
                        <div class="flex-col" style="flex:1;overflow-y:auto;gap:16px" id="dash-estoque">
                            ${estoque.length === 0
                                ? UI.empty('Nenhum material cadastrado', '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>')
                                : estoque.map(item => {
                                    const qty = item.quantidade || 0;
                                    const total = item.quantidade_total || 1;
                                    const pct = Math.min((qty / total) * 100, 100);
                                    return `
                                        <div>
                                            <div class="flex-between" style="margin-bottom:6px">
                                                <span class="detail-value">${Router.esc(item.material)}</span>
                                                <span style="font-size:var(--font-xs);color:var(--text-3)">${qty}/${total}${Router.esc(item.medida)}</span>
                                            </div>
                                            ${UI.progressBar(pct)}
                                        </div>
                                    `;
                                }).join('')
                            }
                        </div>

                        <!-- Filament Summary -->
                        ${impressoras.length > 0 ? `
                            <div style="border-top:1px solid var(--border);margin-top:var(--sp-16);padding-top:var(--sp-16)">
                                <div class="flex-between" style="margin-bottom:8px">
                                    <span style="font-size:var(--font-sm);color:var(--text-2)">Filamento Total</span>
                                    <span style="font-size:var(--font-sm);font-weight:600">${totalFilamento}g</span>
                                </div>
                                ${UI.progressBar(filPct)}
                            </div>
                        ` : ''}
                    </div>

                    <!-- Status Chart -->
                    <div class="card anim-fade-up stagger-6" style="min-height:180px">
                        <div class="section-title" style="margin-bottom:var(--sp-12)">Distribuição por Status</div>
                        <div class="status-chart">
                            ${Object.entries(statusCounts).map(([status, count]) => {
                                const pct = (count / maxCount) * 100;
                                const colors = {
                                    Pendente: 'var(--warning)',
                                    Trabalhando: 'var(--info)',
                                    Concluido: 'var(--success)',
                                    Entregue: 'var(--secondary)',
                                };
                                return `
                                    <div class="status-bar-group">
                                        <span class="status-bar-value">${count}</span>
                                        <div class="status-bar" style="height:${Math.max(pct, 5)}%;background:${colors[status] || 'var(--primary)'}"></div>
                                        <span class="status-bar-label">${status}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- Orders Panel -->
                <div class="card flex-2 anim-fade-up stagger-6" style="display:flex;flex-direction:column;overflow:hidden">
                    <div class="flex-between mb-16">
                        <div class="section-title" style="margin:0">Pedidos Recentes</div>
                        <button class="btn btn-primary btn-sm" onclick="Router.navigate('pedidos')">
                            ${UI.icons.plus} Novo Pedido
                        </button>
                    </div>
                    <div class="tbl-head">
                        <span class="tbl-cell" style="flex:2">Nome</span>
                        <span class="tbl-cell" style="flex:1;text-align:center">Status</span>
                        <span class="tbl-cell" style="flex:1;text-align:center">Data</span>
                        <span class="tbl-cell" style="flex:1;text-align:right">Preço</span>
                    </div>
                    <div class="tbl-sep"></div>
                    <div class="tbl-body" style="flex:1;overflow-y:auto">
                        ${clients.length === 0
                            ? UI.empty('Nenhum pedido cadastrado', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>')
                            : clients.slice().reverse().slice(0, 15).map(c => `
                                <div class="tbl-row" onclick="Router.navigate('pedidos')">
                                    <span class="tbl-cell" style="flex:2;font-weight:500">${Router.esc(c.nome)}</span>
                                    <span class="tbl-cell" style="flex:1;text-align:center">${UI.badge(c.status)}</span>
                                    <span class="tbl-cell" style="flex:1;text-align:center;font-size:var(--font-sm);color:var(--text-2)">${c.data_criacao || '-'}</span>
                                    <span class="tbl-cell" style="flex:1;text-align:right;color:var(--primary);font-weight:600">${UI.currency(c.preco)}</span>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        `;
    }
};
