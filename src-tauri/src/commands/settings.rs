// =============================================================================
// Commands — Configurações
// =============================================================================

use crate::models::Settings;
use crate::storage::{self, DataDir};
use tauri::State;

const FILE: &str = "settings.jsonl";

fn default_settings() -> Settings {
    Settings {
        energia: 0.92,
        lucro: 30.0,
        tema: "midnight".into(),
        remetente_nome: String::new(),
        remetente_cpf: String::new(),
        remetente_cep: String::new(),
        remetente_endereco: String::new(),
        remetente_estado: String::new(),
        remetente_cidade: String::new(),
        remetente_numero: String::new(),
        remetente_telefone: String::new(),
        // Melhor Envio
        me_ambiente: "sandbox".into(),
        me_client_id: String::new(),
        me_client_secret: String::new(),
        me_redirect_uri: "http://localhost:7879/callback".into(),
        me_access_token: String::new(),
        me_refresh_token: String::new(),
        me_token_expires: 0,
    }
}

#[tauri::command]
pub fn load_settings(data_dir: State<DataDir>) -> Result<Settings, String> {
    let items: Vec<Settings> = storage::read_all(&data_dir, FILE)?;
    Ok(items.into_iter().next().unwrap_or_else(default_settings))
}

#[tauri::command]
pub fn save_settings(
    data_dir: State<DataDir>,
    energia: f64,
    lucro: f64,
    tema: String,
    remetente_nome: Option<String>,
    remetente_cpf: Option<String>,
    remetente_cep: Option<String>,
    remetente_endereco: Option<String>,
    remetente_estado: Option<String>,
    remetente_cidade: Option<String>,
    remetente_numero: Option<String>,
    remetente_telefone: Option<String>,
    // Melhor Envio
    me_ambiente: Option<String>,
    me_client_id: Option<String>,
    me_client_secret: Option<String>,
    me_redirect_uri: Option<String>,
    me_access_token: Option<String>,
    me_refresh_token: Option<String>,
    me_token_expires: Option<i64>,
) -> Result<(), String> {
    // Carregar settings atuais para preservar campos não enviados
    let current = load_settings(data_dir.clone()).unwrap_or_else(|_| default_settings());

    let settings = Settings {
        energia,
        lucro,
        tema,
        remetente_nome: remetente_nome.unwrap_or(current.remetente_nome),
        remetente_cpf: remetente_cpf.unwrap_or(current.remetente_cpf),
        remetente_cep: remetente_cep.unwrap_or(current.remetente_cep),
        remetente_endereco: remetente_endereco.unwrap_or(current.remetente_endereco),
        remetente_estado: remetente_estado.unwrap_or(current.remetente_estado),
        remetente_cidade: remetente_cidade.unwrap_or(current.remetente_cidade),
        remetente_numero: remetente_numero.unwrap_or(current.remetente_numero),
        remetente_telefone: remetente_telefone.unwrap_or(current.remetente_telefone),
        // Melhor Envio
        me_ambiente: me_ambiente.unwrap_or(current.me_ambiente),
        me_client_id: me_client_id.unwrap_or(current.me_client_id),
        me_client_secret: me_client_secret.unwrap_or(current.me_client_secret),
        me_redirect_uri: me_redirect_uri.unwrap_or(current.me_redirect_uri),
        me_access_token: me_access_token.unwrap_or(current.me_access_token),
        me_refresh_token: me_refresh_token.unwrap_or(current.me_refresh_token),
        me_token_expires: me_token_expires.unwrap_or(current.me_token_expires),
    };
    storage::write_all(&data_dir, FILE, &[settings])
}
