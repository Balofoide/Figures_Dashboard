// =============================================================================
// Claybox³ᴰ — Modelos de dados
// =============================================================================

use serde::{Deserialize, Deserializer, Serialize};

/// Desserializa um valor que pode vir como String ou número para f64.
/// Permite compatibilidade com dados existentes (ex: "120.50" ou 120.50).
fn string_or_f64<'de, D>(deserializer: D) -> Result<f64, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de;

    struct StringOrF64;

    impl<'de> de::Visitor<'de> for StringOrF64 {
        type Value = f64;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a number or string containing a number")
        }

        fn visit_f64<E: de::Error>(self, v: f64) -> Result<f64, E> {
            Ok(v)
        }

        fn visit_i64<E: de::Error>(self, v: i64) -> Result<f64, E> {
            Ok(v as f64)
        }

        fn visit_u64<E: de::Error>(self, v: u64) -> Result<f64, E> {
            Ok(v as f64)
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<f64, E> {
            v.trim()
                .parse::<f64>()
                .map_err(|_| de::Error::invalid_value(de::Unexpected::Str(v), &self))
        }
    }

    deserializer.deserialize_any(StringOrF64)
}

/// Desserializa um valor que pode vir como String ou número para i32.
fn string_or_i32<'de, D>(deserializer: D) -> Result<i32, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de;

    struct StringOrI32;

    impl<'de> de::Visitor<'de> for StringOrI32 {
        type Value = i32;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a number or string containing a number")
        }

        fn visit_i64<E: de::Error>(self, v: i64) -> Result<i32, E> {
            Ok(v as i32)
        }

        fn visit_u64<E: de::Error>(self, v: u64) -> Result<i32, E> {
            Ok(v as i32)
        }

        fn visit_f64<E: de::Error>(self, v: f64) -> Result<i32, E> {
            Ok(v as i32)
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<i32, E> {
            v.trim()
                .parse::<f64>()
                .map(|f| f as i32)
                .map_err(|_| de::Error::invalid_value(de::Unexpected::Str(v), &self))
        }
    }

    deserializer.deserialize_any(StringOrI32)
}

/// Pedido de impressão 3D
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Client {
    pub id: String,
    pub nome: String,
    pub endereco: String,
    pub entrega: String,
    #[serde(deserialize_with = "string_or_f64")]
    pub preco: f64,
    pub modelo: String,
    pub observacao: String,
    pub status: String,
    pub filamento_gasto: String,
    pub data_criacao: String,
    #[serde(default)]
    pub cep: String,
    #[serde(default)]
    pub telefone: String,
    #[serde(default)]
    pub cpf: String,
}

/// Item de estoque (materiais, insumos)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Estoque {
    pub id: String,
    pub material: String,
    #[serde(deserialize_with = "string_or_f64")]
    pub quantidade: f64,
    #[serde(deserialize_with = "string_or_i32")]
    pub quantidade_total: i32,
    pub medida: String,
    #[serde(deserialize_with = "string_or_f64")]
    pub preco: f64,
}

/// Impressora 3D registrada
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Impressora {
    pub id: String,
    pub modelo: String,
    #[serde(deserialize_with = "string_or_i32")]
    pub watts: i32,
    #[serde(deserialize_with = "string_or_i32")]
    pub filamento: i32,
    #[serde(deserialize_with = "string_or_i32")]
    pub filamento_total: i32,
    #[serde(deserialize_with = "string_or_i32")]
    pub filamento_preco: i32,
    pub filamento_tipo: String,
    pub nozzle: String,
    pub diametro: String,
}

/// Configurações da aplicação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(deserialize_with = "string_or_f64")]
    pub energia: f64,
    #[serde(deserialize_with = "string_or_f64")]
    pub lucro: f64,
    pub tema: String,
    // Dados do remetente (para Melhor Envio)
    #[serde(default)]
    pub remetente_nome: String,
    #[serde(default)]
    pub remetente_cpf: String,
    #[serde(default)]
    pub remetente_cep: String,
    #[serde(default)]
    pub remetente_endereco: String,
    #[serde(default)]
    pub remetente_estado: String,
    #[serde(default)]
    pub remetente_cidade: String,
    #[serde(default)]
    pub remetente_numero: String,
    #[serde(default)]
    pub remetente_telefone: String,
    // Integração Melhor Envio — OAuth
    #[serde(default)]
    pub me_ambiente: String,         // "sandbox" | "production"
    #[serde(default)]
    pub me_client_id: String,
    #[serde(default)]
    pub me_client_secret: String,
    #[serde(default)]
    pub me_redirect_uri: String,
    #[serde(default)]
    pub me_access_token: String,
    #[serde(default)]
    pub me_refresh_token: String,
    #[serde(default)]
    pub me_token_expires: i64,       // unix timestamp
}

// =============================================================================
// Modelos — Melhor Envio API
// =============================================================================

/// Cotação de frete retornada pela API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShippingQuote {
    pub id: i32,
    pub name: String,
    pub price: String,
    pub delivery_time: i32,
}

/// Item no carrinho do Melhor Envio
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CartItem {
    pub id: String,
    pub nome_cliente: String,
    pub transportadora: String,
    pub produto: String,
    pub preco: f64,
}

/// Etiqueta/Order do Melhor Envio
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Label {
    pub id: String,
    pub status: String,
    pub cliente: String,
    pub produto: String,
    pub preco: f64,
    pub servico: String,
    pub tracking: String,
    pub created_at: String,
    pub cep_destino: String,
    pub servico_nome: String,
}

/// Evento de rastreamento
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackingEvent {
    pub status: String,
    pub description: String,
    pub date: String,
    pub city: String,
}

// =============================================================================
// Modelos — G-code Parser
// =============================================================================

/// Dados extraídos de um arquivo G-code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcodeData {
    /// Nome do modelo (extraído do nome do arquivo)
    pub nome_modelo: String,
    /// Tempo de impressão em horas (decimal)
    pub tempo_horas: f64,
    /// Filamento gasto em gramas
    pub filamento_gramas: f64,
    /// Filamento gasto em metros (se disponível)
    pub filamento_metros: f64,
    /// Altura da camada (mm)
    pub layer_height: f64,
    /// Nome da impressora detectada no G-code
    pub impressora: String,
    /// Tipo de filamento (PLA, PETG, ABS, etc.)
    pub filamento_tipo: String,
    /// Temperatura do nozzle (°C)
    pub temperatura_nozzle: i32,
    /// Temperatura da mesa (°C)
    pub temperatura_mesa: i32,
    /// Slicer que gerou o arquivo
    pub slicer: String,
    /// Caminho do arquivo importado
    pub arquivo: String,
}

// =============================================================================
// Tests — Backwards compatibility with existing JSONL data
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estoque_string_fields() {
        // Existing data has quantidade and preco as strings
        let json = r#"{"id":"dfd800f9-27b1-49a3-bead-8ee81b8fdc58","material":"Tinta","quantidade":"164","quantidade_total":200,"medida":"","preco":"20"}"#;
        let item: Estoque = serde_json::from_str(json).expect("Failed to parse estoque");
        assert_eq!(item.quantidade, 164.0);
        assert_eq!(item.preco, 20.0);
        assert_eq!(item.quantidade_total, 200);
    }

    #[test]
    fn test_estoque_numeric_fields() {
        // New data will have numeric fields
        let json = r#"{"id":"test","material":"PLA","quantidade":500.5,"quantidade_total":1000,"medida":"g","preco":120.50}"#;
        let item: Estoque = serde_json::from_str(json).expect("Failed to parse estoque");
        assert_eq!(item.quantidade, 500.5);
        assert_eq!(item.preco, 120.50);
    }

    #[test]
    fn test_impressora_string_watts() {
        // Existing data has watts as string
        let json = r#"{"id":"70b0cd4b","modelo":"Creality","watts":"350","filamento":1000,"filamento_total":1000,"filamento_preco":120,"filamento_tipo":"PLA","nozzle":"0.4","diametro":"220x220x250"}"#;
        let imp: Impressora = serde_json::from_str(json).expect("Failed to parse impressora");
        assert_eq!(imp.watts, 350);
        assert_eq!(imp.filamento, 1000);
    }

    #[test]
    fn test_impressora_numeric_watts() {
        // New data will have watts as int
        let json = r#"{"id":"test","modelo":"Test","watts":200,"filamento":500,"filamento_total":1000,"filamento_preco":100,"filamento_tipo":"PETG","nozzle":"0.6","diametro":"300x300x400"}"#;
        let imp: Impressora = serde_json::from_str(json).expect("Failed to parse impressora");
        assert_eq!(imp.watts, 200);
    }

    #[test]
    fn test_client_with_new_fields() {
        // Client with optional new fields (cep, telefone, cpf)
        let json = r#"{"id":"4c357253","nome":"Test","endereco":"Rua A","entrega":"","preco":1516.35,"modelo":"Ghost","observacao":"","status":"Concluido","filamento_gasto":"1000","data_criacao":"19-06-2026"}"#;
        let client: Client = serde_json::from_str(json).expect("Failed to parse client");
        assert_eq!(client.preco, 1516.35);
        assert_eq!(client.cep, "");  // default
        assert_eq!(client.telefone, "");  // default
    }

    #[test]
    fn test_settings_string_fields() {
        // Existing settings data has energia and lucro as strings
        let json = r#"{"energia":"0.85","lucro":"1000","tema":"pastel-dream-dark","remetente_nome":"","remetente_cpf":"","remetente_cep":"","remetente_endereco":"","remetente_estado":"","remetente_cidade":"","remetente_numero":"","remetente_telefone":""}"#;
        let s: Settings = serde_json::from_str(json).expect("Failed to parse settings");
        assert_eq!(s.energia, 0.85);
        assert_eq!(s.lucro, 1000.0);
    }

    #[test]
    fn test_settings_numeric_fields() {
        // New settings will have numeric fields
        let json = r#"{"energia":0.92,"lucro":30.0,"tema":"midnight","remetente_nome":"","remetente_cpf":"","remetente_cep":"","remetente_endereco":"","remetente_estado":"","remetente_cidade":"","remetente_numero":"","remetente_telefone":""}"#;
        let s: Settings = serde_json::from_str(json).expect("Failed to parse settings");
        assert_eq!(s.energia, 0.92);
        assert_eq!(s.lucro, 30.0);
    }
}
