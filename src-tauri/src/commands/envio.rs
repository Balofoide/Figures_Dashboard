// =============================================================================
// Commands — Melhor Envio API Integration
// Credenciais são lidas do settings.jsonl (não mais do .env)
// =============================================================================

use crate::models::{CartItem, Label, Settings, ShippingQuote, TrackingEvent};
use crate::storage::{self, DataDir};
use reqwest::header;
use serde::Serialize;
use tauri::State;

const SETTINGS_FILE: &str = "settings.jsonl";
const ALL_SCOPES: &str = "cart-read cart-write shipping-calculate shipping-checkout orders-read shipping-generate shipping-print shipping-tracking shipping-cancel";

/// Lê as settings do arquivo settings.jsonl
fn load_me_settings(data_dir: &DataDir) -> Result<Settings, String> {
    let items: Vec<Settings> = storage::read_all(data_dir, SETTINGS_FILE)?;
    items.into_iter().next().ok_or("Nenhuma configuração encontrada. Vá em Configurações e configure a integração.".to_string())
}

/// Retorna a base URL conforme o ambiente configurado
fn base_url(settings: &Settings) -> &str {
    if settings.me_ambiente == "production" {
        "https://melhorenvio.com.br"
    } else {
        "https://sandbox.melhorenvio.com.br"
    }
}

/// Obtém o access token das configurações
fn get_token(data_dir: &DataDir) -> Result<(String, String), String> {
    let settings = load_me_settings(data_dir)?;
    let token = &settings.me_access_token;
    if token.is_empty() {
        return Err("Token não configurado. Vá em Configurações → Integração Melhor Envio e conecte sua conta.".to_string());
    }
    Ok((token.clone(), base_url(&settings).to_string()))
}

/// Salva os tokens de volta no settings.jsonl, preservando todos os outros campos
fn save_tokens(data_dir: &DataDir, access: &str, refresh: &str, expires_in: i64) -> Result<(), String> {
    let mut settings = load_me_settings(data_dir)?;
    settings.me_access_token = access.to_string();
    if !refresh.is_empty() {
        settings.me_refresh_token = refresh.to_string();
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    settings.me_token_expires = now + expires_in;
    storage::write_all(data_dir, SETTINGS_FILE, &[settings])
}

// =============================================================================
// OAuth — Autorização com Melhor Envio
// =============================================================================

/// Retorna a URL de autorização para o usuário abrir no navegador
#[tauri::command]
pub fn get_auth_url(data_dir: State<'_, DataDir>) -> Result<String, String> {
    let settings = load_me_settings(&data_dir)?;

    if settings.me_client_id.is_empty() || settings.me_client_secret.is_empty() {
        return Err("Configure o Client ID e Client Secret antes de conectar.".to_string());
    }

    let redirect_uri = if settings.me_redirect_uri.is_empty() {
        "https://exemple.com/token".to_string()
    } else {
        settings.me_redirect_uri.clone()
    };

    let base = base_url(&settings);
    let url = format!(
        "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&scope={}",
        base,
        settings.me_client_id,
        urlencoded(&redirect_uri),
        ALL_SCOPES.replace(' ', "%20")
    );

    Ok(url)
}

/// Troca o code de autorização por access_token
#[tauri::command]
pub async fn exchange_auth_code(
    data_dir: State<'_, DataDir>,
    code: String,
) -> Result<String, String> {
    let settings = load_me_settings(&data_dir)?;
    let base = base_url(&settings).to_string();

    let redirect_uri = if settings.me_redirect_uri.is_empty() {
        "https://exemple.com/token".to_string()
    } else {
        settings.me_redirect_uri.clone()
    };

    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "authorization_code"),
        ("client_id", settings.me_client_id.as_str()),
        ("client_secret", settings.me_client_secret.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("code", code.as_str()),
    ];

    let response = client
        .post(format!("{}/oauth/token", base))
        .header(header::ACCEPT, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erro ao deserializar: {}", e))?;

    let access_token = json.get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("access_token não encontrado na resposta")?
        .to_string();

    let refresh_token = json.get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let expires_in = json.get("expires_in")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    save_tokens(&data_dir, &access_token, &refresh_token, expires_in)?;

    Ok(format!("Conectado com sucesso! Token expira em {} dias.", expires_in / 86400))
}

/// URL-encode simples para o redirect_uri
fn urlencoded(s: &str) -> String {
    s.replace(':', "%3A").replace('/', "%2F")
}

/// Renova o token existente (sem mudar escopos)
#[tauri::command]
pub async fn refresh_access_token(data_dir: State<'_, DataDir>) -> Result<String, String> {
    let settings = load_me_settings(&data_dir)?;
    let base = base_url(&settings).to_string();

    if settings.me_refresh_token.is_empty() {
        return Err("Nenhum refresh token disponível. Reconecte sua conta.".to_string());
    }

    let client = reqwest::Client::new();
    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", settings.me_refresh_token.as_str()),
        ("client_id", settings.me_client_id.as_str()),
        ("client_secret", settings.me_client_secret.as_str()),
    ];

    let response = client
        .post(format!("{}/oauth/token", base))
        .header(header::ACCEPT, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Erro na requisição de refresh: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erro ao deserializar: {}", e))?;

    let new_access = json.get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("access_token não encontrado na resposta")?
        .to_string();

    let new_refresh = json.get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let expires_in = json.get("expires_in")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    save_tokens(&data_dir, &new_access, &new_refresh, expires_in)?;

    Ok(format!("Token renovado! Expira em {} dias.", expires_in / 86400))
}

/// Desconecta a conta removendo os tokens
#[tauri::command]
pub fn disconnect_melhor_envio(data_dir: State<'_, DataDir>) -> Result<String, String> {
    let mut settings = load_me_settings(&data_dir)?;
    settings.me_access_token = String::new();
    settings.me_refresh_token = String::new();
    settings.me_token_expires = 0;
    storage::write_all(&data_dir, SETTINGS_FILE, &[settings])?;
    Ok("Conta desconectada com sucesso".to_string())
}

// =============================================================================
// Consulta CEP (ViaCEP)
// =============================================================================

#[derive(Serialize, Clone)]
pub struct CepInfo {
    pub cep: String,
    pub logradouro: String,
    pub bairro: String,
    pub cidade: String,
    pub estado: String,
}

#[tauri::command]
pub async fn lookup_cep(cep: String) -> Result<CepInfo, String> {
    let cep_clean: String = cep.chars().filter(|c| c.is_ascii_digit()).collect();
    if cep_clean.len() != 8 {
        return Err("CEP deve ter 8 dígitos".to_string());
    }

    let url = format!("https://viacep.com.br/ws/{}/json/", cep_clean);
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Erro ao consultar CEP: {}", e))?;

    if !response.status().is_success() {
        return Err("CEP não encontrado".to_string());
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erro ao ler resposta: {}", e))?;

    if json.get("erro").is_some() {
        return Err("CEP não encontrado".to_string());
    }

    Ok(CepInfo {
        cep: cep_clean,
        logradouro: json["logradouro"].as_str().unwrap_or("").to_string(),
        bairro: json["bairro"].as_str().unwrap_or("").to_string(),
        cidade: json["localidade"].as_str().unwrap_or("").to_string(),
        estado: json["uf"].as_str().unwrap_or("").to_string(),
    })
}

// =============================================================================
// Calcular Frete
// =============================================================================

#[derive(Serialize)]
struct FreteLocation {
    postal_code: String,
}

#[derive(Serialize)]
struct FreteProduct {
    width: f64,
    height: f64,
    length: f64,
    weight: f64,
    quantity: u32,
}

#[derive(Serialize)]
struct FreteOptions {
    insurance_value: f64,
    receipt: bool,
    own_hand: bool,
    reverse: bool,
    non_commercial: bool,
}

#[derive(Serialize)]
struct FreteRequest {
    from: FreteLocation,
    to: FreteLocation,
    products: Vec<FreteProduct>,
    options: FreteOptions,
    services: String,
}

#[tauri::command]
pub async fn calculate_shipping(
    data_dir: State<'_, DataDir>,
    cep_origem: String,
    cep_destino: String,
    width: f64,
    height: f64,
    length: f64,
    weight: f64,
) -> Result<Vec<ShippingQuote>, String> {
    let (token, base) = get_token(&data_dir)?;

    let request = FreteRequest {
        from: FreteLocation { postal_code: cep_origem },
        to: FreteLocation { postal_code: cep_destino },
        products: vec![FreteProduct {
            width,
            height,
            length,
            weight,
            quantity: 1,
        }],
        options: FreteOptions {
            insurance_value: 0.0,
            receipt: false,
            own_hand: false,
            reverse: false,
            non_commercial: false,
        },
        services: String::new(),
    };

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/v2/me/shipment/calculate", base))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::ACCEPT, "application/json")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erro ao deserializar: {}", e))?;

    let mut quotes = Vec::new();
    if let Some(array) = json.as_array() {
        for item in array {
            let price = item["price"].as_str().unwrap_or("-");
            if price == "-" {
                continue;
            }
            quotes.push(ShippingQuote {
                id: item["id"].as_i64().unwrap_or(0) as i32,
                name: item["name"].as_str().unwrap_or("-").to_string(),
                price: price.to_string(),
                delivery_time: item["delivery_time"].as_i64().unwrap_or(0) as i32,
            });
        }
    }

    Ok(quotes)
}

// =============================================================================
// Adicionar ao Carrinho
// =============================================================================

#[derive(Serialize)]
struct CartAddress {
    postal_code: String,
    name: String,
    phone: String,
    email: String,
    document: String,
    company_document: String,
    state_register: String,
    address: String,
    complement: String,
    number: String,
    district: String,
    city: String,
    state_abbr: String,
    country_id: String,
}

#[derive(Serialize)]
struct CartVolume {
    height: f64,
    width: f64,
    length: f64,
    weight: f64,
}

#[derive(Serialize)]
struct CartProduct {
    name: String,
    quantity: String,
    unitary_value: String,
}

#[derive(Serialize)]
struct CartOptions {
    insurance_value: f64,
    receipt: bool,
    own_hand: bool,
    reverse: bool,
    non_commercial: bool,
}

#[derive(Serialize)]
struct CartRequest {
    service: u32,
    agency: Option<u32>,
    from: CartAddress,
    to: CartAddress,
    volumes: Vec<CartVolume>,
    products: Vec<CartProduct>,
    options: CartOptions,
}

#[tauri::command]
pub async fn add_to_cart(
    data_dir: State<'_, DataDir>,
    service: u32,
    // Remetente
    from_cep: String,
    from_nome: String,
    from_telefone: String,
    from_cpf: String,
    from_endereco: String,
    from_numero: String,
    from_cidade: String,
    from_estado: String,
    // Destinatário
    to_cep: String,
    to_nome: String,
    to_telefone: String,
    to_cpf: String,
    to_endereco: String,
    to_numero: String,
    to_cidade: String,
    to_estado: String,
    // Pacote
    width: f64,
    height: f64,
    length: f64,
    weight: f64,
    produto_nome: String,
    quantidade: f64,
    preco_unitario: f64,
    seguro: f64,
    // Opções
    aviso_recebimento: bool,
    mao_propria: bool,
    reversa: bool,
) -> Result<String, String> {
    let (token, base) = get_token(&data_dir)?;

    // Sanitizar CEPs — remover tudo que não é dígito
    let from_cep_clean: String = from_cep.chars().filter(|c| c.is_ascii_digit()).collect();
    let to_cep_clean: String = to_cep.chars().filter(|c| c.is_ascii_digit()).collect();

    let request = CartRequest {
        service,
        agency: None,
        from: CartAddress {
            postal_code: from_cep_clean,
            name: from_nome,
            phone: from_telefone,
            email: String::new(),
            document: from_cpf,
            company_document: String::new(),
            state_register: "ISENTO".to_string(),
            address: from_endereco,
            complement: String::new(),
            number: from_numero,
            district: from_cidade.clone(),
            city: from_cidade,
            state_abbr: from_estado,
            country_id: "BR".to_string(),
        },
        to: CartAddress {
            postal_code: to_cep_clean,
            name: to_nome,
            phone: to_telefone,
            email: String::new(),
            document: to_cpf,
            company_document: String::new(),
            state_register: String::new(),
            address: to_endereco,
            complement: String::new(),
            number: to_numero,
            district: to_cidade.clone(),
            city: to_cidade,
            state_abbr: to_estado,
            country_id: "BR".to_string(),
        },
        volumes: vec![CartVolume {
            height,
            width,
            length,
            weight,
        }],
        products: vec![CartProduct {
            name: produto_nome,
            quantity: format!("{}", quantidade as u32),
            unitary_value: format!("{:.2}", preco_unitario),
        }],
        options: CartOptions {
            insurance_value: seguro,
            receipt: aviso_recebimento,
            own_hand: mao_propria,
            reverse: reversa,
            non_commercial: true,
        },
    };

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/v2/me/cart", base))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erro ao deserializar: {}", e))?;

    let id = json["id"].as_str().unwrap_or("").to_string();
    Ok(id)
}

// =============================================================================
// Listar Carrinho
// =============================================================================

#[tauri::command]
pub async fn get_cart(data_dir: State<'_, DataDir>) -> Result<Vec<CartItem>, String> {
    let (token, base) = get_token(&data_dir)?;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/v2/me/cart", base))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::ACCEPT, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erro ao deserializar: {}", e))?;

    let mut items = Vec::new();
    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
        for item in data {
            items.push(CartItem {
                id: item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                nome_cliente: item.get("to")
                    .and_then(|t| t.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string(),
                transportadora: item.get("service")
                    .and_then(|s| s.get("company"))
                    .and_then(|c| c.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string(),
                produto: item.get("products")
                    .and_then(|p| p.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|prod| prod.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string(),
                preco: item.get("price").and_then(|p| p.as_f64()).unwrap_or(0.0),
            });
        }
    }

    Ok(items)
}

// =============================================================================
// Finalizar Pedido (Checkout)
// =============================================================================

#[tauri::command]
pub async fn checkout_order(data_dir: State<'_, DataDir>, order_id: String) -> Result<String, String> {
    let (token, base) = get_token(&data_dir)?;

    let client = reqwest::Client::new();
    let body = serde_json::json!({ "orders": [order_id] });

    let response = client
        .post(format!("{}/api/v2/me/shipment/checkout", base))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    Ok("Envio finalizado com sucesso".to_string())
}

// =============================================================================
// Listar Etiquetas (Orders)
// =============================================================================

#[tauri::command]
pub async fn get_labels(data_dir: State<'_, DataDir>) -> Result<Vec<Label>, String> {
    let (token, base) = get_token(&data_dir)?;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/v2/me/orders", base))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::ACCEPT, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erro ao deserializar: {}", e))?;

    let mut labels = Vec::new();
    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
        for item in data {
            let status = item.get("status").and_then(|s| s.as_str()).unwrap_or("").to_string();
            
            let tracking = item.get("tracking")
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string();

            let created_at = item.get("created_at")
                .and_then(|c| c.as_str())
                .unwrap_or("")
                .to_string();

            let cep_destino = item.get("to")
                .and_then(|t| t.get("postal_code"))
                .and_then(|c| c.as_str())
                .unwrap_or("")
                .to_string();

            let servico_nome = item.get("service")
                .and_then(|s| s.get("name"))
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .to_string();

            labels.push(Label {
                id: item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                status,
                cliente: item.get("to")
                    .and_then(|t| t.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string(),
                produto: item.get("products")
                    .and_then(|p| p.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|prod| prod.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string(),
                preco: item.get("price").and_then(|p| p.as_f64()).unwrap_or(0.0),
                servico: item.get("service")
                    .and_then(|s| s.get("company"))
                    .and_then(|c| c.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string(),
                tracking,
                created_at,
                cep_destino,
                servico_nome,
            });
        }
    }

    Ok(labels)
}

// =============================================================================
// Gerar Etiqueta
// =============================================================================

#[tauri::command]
pub async fn generate_label(data_dir: State<'_, DataDir>, order_id: String) -> Result<String, String> {
    let (token, base) = get_token(&data_dir)?;

    let client = reqwest::Client::new();
    let body = serde_json::json!({ "orders": [order_id] });

    let response = client
        .post(format!("{}/api/v2/me/shipment/generate", base))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    Ok("Etiqueta gerada com sucesso".to_string())
}

// =============================================================================
// Imprimir Etiqueta (retorna URL para abrir no navegador)
// =============================================================================

#[tauri::command]
pub async fn print_label(data_dir: State<'_, DataDir>, order_id: String) -> Result<String, String> {
    let (token, base) = get_token(&data_dir)?;

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "mode": "private",
        "orders": [order_id]
    });

    let response = client
        .post(format!("{}/api/v2/me/shipment/print", base))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erro ao deserializar: {}", e))?;

    let url = json.get("url")
        .and_then(|u| u.as_str())
        .unwrap_or("")
        .to_string();

    if url.is_empty() {
        return Err("URL da etiqueta não encontrada na resposta".to_string());
    }

    Ok(url)
}

// =============================================================================
// Rastreamento
// =============================================================================

#[tauri::command]
pub async fn get_tracking(data_dir: State<'_, DataDir>, order_id: String) -> Result<Vec<TrackingEvent>, String> {
    let (token, base) = get_token(&data_dir)?;

    let client = reqwest::Client::new();
    let body = serde_json::json!({ "orders": [order_id] });

    let response = client
        .post(format!("{}/api/v2/me/shipment/tracking", base))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erro ao deserializar: {}", e))?;

    let mut events = Vec::new();

    if let Some(order_data) = json.get(&order_id) {
        if let Some(tracking_arr) = order_data.get("tracking").and_then(|t| t.as_array()) {
            for event in tracking_arr {
                events.push(TrackingEvent {
                    status: event.get("status").and_then(|s| s.as_str()).unwrap_or("").to_string(),
                    description: event.get("description").and_then(|d| d.as_str()).unwrap_or("").to_string(),
                    date: event.get("date").and_then(|d| d.as_str()).unwrap_or("").to_string(),
                    city: event.get("city").and_then(|c| c.as_str()).unwrap_or("").to_string(),
                });
            }
        }
    }

    Ok(events)
}

// =============================================================================
// Cancelar Envio
// =============================================================================

#[tauri::command]
pub async fn cancel_label(data_dir: State<'_, DataDir>, order_id: String) -> Result<String, String> {
    let (token, base) = get_token(&data_dir)?;

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "order": {
            "id": order_id,
            "reason_id": 2,
            "description": "Cancelado pelo usuário"
        }
    });

    let response = client
        .post(format!("{}/api/v2/me/shipment/cancel", base))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "application/json")
        .header(header::USER_AGENT, "FigureManager (contato@figuremanager.com)")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro {}: {}", status, body));
    }

    Ok("Envio cancelado com sucesso".to_string())
}
