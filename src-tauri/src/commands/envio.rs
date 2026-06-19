// =============================================================================
// Commands — Melhor Envio API Integration
// =============================================================================

use crate::models::{CartItem, Label, ShippingQuote};
use reqwest::header;
use serde::Serialize;

const BASE_URL: &str = "https://sandbox.melhorenvio.com.br";

fn get_token() -> Result<String, String> {
    dotenvy::dotenv().ok();
    std::env::var("ACCESS_TOKEN").map_err(|_| "ACCESS_TOKEN não configurado no .env".to_string())
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
    services: Vec<String>,
}

#[tauri::command]
pub async fn calculate_shipping(
    cep_origem: String,
    cep_destino: String,
    width: f64,
    height: f64,
    length: f64,
    weight: f64,
) -> Result<Vec<ShippingQuote>, String> {
    let token = get_token()?;

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
        services: vec![],
    };

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/v2/me/shipment/calculate", BASE_URL))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::ACCEPT, "application/json")
        .header(header::CONTENT_TYPE, "application/json")
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
    quantity: f64,
    unitary_value: f64,
}

#[derive(Serialize)]
struct CartOptions {
    insurance_value: f64,
    receipt: bool,
    own_hand: bool,
    reverse: bool,
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
    let token = get_token()?;

    let request = CartRequest {
        service,
        agency: None,
        from: CartAddress {
            postal_code: from_cep,
            name: from_nome,
            phone: from_telefone,
            email: String::new(),
            document: from_cpf,
            address: from_endereco,
            complement: String::new(),
            number: from_numero,
            district: String::new(),
            city: from_cidade,
            state_abbr: from_estado,
            country_id: "BR".to_string(),
        },
        to: CartAddress {
            postal_code: to_cep,
            name: to_nome,
            phone: to_telefone,
            email: String::new(),
            document: to_cpf,
            address: to_endereco,
            complement: String::new(),
            number: to_numero,
            district: String::new(),
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
            quantity: quantidade,
            unitary_value: preco_unitario,
        }],
        options: CartOptions {
            insurance_value: seguro,
            receipt: aviso_recebimento,
            own_hand: mao_propria,
            reverse: reversa,
        },
    };

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/v2/me/cart", BASE_URL))
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
pub async fn get_cart() -> Result<Vec<CartItem>, String> {
    let token = get_token()?;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/v2/me/cart", BASE_URL))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::ACCEPT, "application/json")
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
pub async fn checkout_order(order_id: String) -> Result<String, String> {
    let token = get_token()?;

    let client = reqwest::Client::new();
    let body = serde_json::json!({ "orders": [order_id] });

    let response = client
        .post(format!("{}/api/v2/me/shipment/checkout", BASE_URL))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::CONTENT_TYPE, "application/json")
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
pub async fn get_labels() -> Result<Vec<Label>, String> {
    let token = get_token()?;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/v2/me/orders", BASE_URL))
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header(header::ACCEPT, "application/json")
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
            });
        }
    }

    Ok(labels)
}
