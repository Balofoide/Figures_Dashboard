# Claybox³ᴰ

> Gerenciador completo para impressão 3D — Pedidos, Estoque, Impressoras e Envio em um único app.

[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white)](https://v2.tauri.app)
[![Rust](https://img.shields.io/badge/Rust-Backend-DEA584?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Sobre

**Claybox³ᴰ** é um aplicativo desktop multiplataforma (Windows / Linux) para makers e profissionais de impressão 3D. Centraliza o gerenciamento de pedidos, estoque de filamentos, impressoras e envios — tudo com uma interface moderna e responsiva.

Construído com **Tauri v2** (Rust no backend, HTML/CSS/JS no frontend), o app é leve, seguro e rápido.

## Funcionalidades
 
### 📊 Dashboard
- Visão geral com estatísticas de vendas (total e mensal)
- Consumo de filamento acumulado
- Gráfico de status dos pedidos
- Pedidos recentes com acesso rápido

### 📋 Pedidos
- CRUD completo de pedidos com busca e ordenação
- Importação automática de arquivos **G-code** e **3MF** (PrusaSlicer, BambuStudio, OrcaSlicer)
- Calculadora de preço de venda integrada (energia + filamento + lucro)
- Status rastreável: Pendente → Trabalhando → Concluído → Entregue

### 📦 Estoque
- Gerenciamento de filamentos com peso, preço e cor
- Barra de progresso visual de consumo
- Busca e ordenação por qualquer campo

### 🖨️ Impressoras
- Cadastro de impressoras com potência (kW) e filamento carregado
- Reabastecimento rápido vinculado ao estoque

### ✈️ Envio (Melhor Envio)
- Integração completa com a API do **Melhor Envio**
- Cotação de frete com CEPs e dimensões
- Criação de envios e carrinho de compras
- Geração e impressão de etiquetas
- Rastreamento de encomendas com timeline

### ⚙️ Configurações
- 8 temas visuais (dark, teal, pastel)
- Custos de energia configuráveis
- Dados do remetente para envios
- Conexão OAuth com Melhor Envio (Sandbox e Produção)

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| **Runtime** | [Tauri v2](https://v2.tauri.app) |
| **Backend** | Rust (serde, reqwest, chrono, uuid) |
| **Frontend** | HTML + Vanilla JS + CSS |
| **Storage** | Arquivos JSONL (sem banco de dados externo) |
| **API** | Melhor Envio (frete, etiquetas, rastreamento) |

## Instalação

### Pré-requisitos

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Dependências do Tauri v2:
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - **Windows**: WebView2 (incluso no Windows 10/11)

### Build de desenvolvimento

```bash
cd src-tauri
cargo tauri dev
```

### Build de produção

```bash
cd src-tauri
cargo tauri build
```

Os binários ficam em `src-tauri/target/release/bundle/`:
- **Linux**: `.deb` + `.AppImage`
- **Windows**: `.msi` + `.exe`




## Licença

[MIT](LICENSE)
