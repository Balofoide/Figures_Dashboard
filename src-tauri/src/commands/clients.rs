// =============================================================================
// Commands — Pedidos (Clients) CRUD
// =============================================================================

use crate::models::Client;
use crate::storage::{self, DataDir};
use chrono::{Datelike, Utc};
use tauri::State;
use uuid::Uuid;

const FILE: &str = "clientes.jsonl";

#[tauri::command]
pub fn load_clients(data_dir: State<DataDir>) -> Result<Vec<Client>, String> {
    storage::read_all(&data_dir, FILE)
}

#[tauri::command]
pub fn register_client(
    data_dir: State<DataDir>,
    nome: String,
    endereco: String,
    entrega: String,
    preco: f64,
    modelo: String,
    observacao: String,
    status: String,
    filamento_gasto: String,
    cep: String,
    telefone: String,
    cpf: String,
) -> Result<Client, String> {
    let client = Client {
        id: Uuid::new_v4().to_string(),
        nome,
        endereco,
        entrega,
        preco,
        modelo,
        observacao,
        status,
        filamento_gasto,
        data_criacao: Utc::now().date_naive().format("%d-%m-%Y").to_string(),
        cep,
        telefone,
        cpf,
    };

    storage::append(&data_dir, FILE, &client)?;
    Ok(client)
}

#[tauri::command]
pub fn update_client(
    data_dir: State<DataDir>,
    id: String,
    nome: Option<String>,
    endereco: Option<String>,
    entrega: Option<String>,
    preco: Option<f64>,
    observacao: Option<String>,
    status: Option<String>,
    cep: Option<String>,
    telefone: Option<String>,
    cpf: Option<String>,
) -> Result<Client, String> {
    let mut clients: Vec<Client> = storage::read_all(&data_dir, FILE)?;

    let client = clients
        .iter_mut()
        .find(|c| c.id == id)
        .ok_or("Cliente não encontrado")?;

    if let Some(v) = nome {
        if !v.is_empty() { client.nome = v; }
    }
    if let Some(v) = endereco {
        if !v.is_empty() { client.endereco = v; }
    }
    if let Some(v) = entrega {
        if !v.is_empty() { client.entrega = v; }
    }
    if let Some(v) = preco {
        if v > 0.0 { client.preco = v; }
    }
    if let Some(v) = observacao {
        if !v.is_empty() { client.observacao = v; }
    }
    if let Some(v) = status {
        if !v.is_empty() { client.status = v; }
    }
    if let Some(v) = cep {
        if !v.is_empty() { client.cep = v; }
    }
    if let Some(v) = telefone {
        if !v.is_empty() { client.telefone = v; }
    }
    if let Some(v) = cpf {
        if !v.is_empty() { client.cpf = v; }
    }

    let updated = client.clone();
    storage::write_all(&data_dir, FILE, &clients)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_client(data_dir: State<DataDir>, id: String) -> Result<(), String> {
    let clients: Vec<Client> = storage::read_all(&data_dir, FILE)?;
    let filtered: Vec<Client> = clients.into_iter().filter(|c| c.id != id).collect();
    storage::write_all(&data_dir, FILE, &filtered)
}

#[tauri::command]
pub fn get_total_vendas(data_dir: State<DataDir>) -> Result<f64, String> {
    let clients: Vec<Client> = storage::read_all(&data_dir, FILE)?;
    Ok(clients.iter().map(|c| c.preco).sum())
}

#[tauri::command]
pub fn get_vendas_mes(data_dir: State<DataDir>) -> Result<f64, String> {
    let clients: Vec<Client> = storage::read_all(&data_dir, FILE)?;
    let current_month = Utc::now().month();
    let current_year = Utc::now().year();

    let total: f64 = clients
        .iter()
        .filter_map(|c| {
            chrono::NaiveDate::parse_from_str(&c.data_criacao, "%d-%m-%Y")
                .ok()
                .filter(|d| d.month() == current_month && d.year() == current_year)
                .map(|_| c.preco)
        })
        .sum();

    Ok(total)
}
