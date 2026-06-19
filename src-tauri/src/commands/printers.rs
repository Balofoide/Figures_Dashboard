// =============================================================================
// Commands — Impressoras CRUD
// =============================================================================

use crate::models::Impressora;
use crate::storage::{self, DataDir};
use tauri::State;
use uuid::Uuid;

const FILE: &str = "impressoras.jsonl";

#[tauri::command]
pub fn load_impressoras(data_dir: State<DataDir>) -> Result<Vec<Impressora>, String> {
    storage::read_all(&data_dir, FILE)
}

#[tauri::command]
pub fn register_impressora(
    data_dir: State<DataDir>,
    modelo: String,
    watts: i32,
    filamento: i32,
    filamento_preco: i32,
    filamento_tipo: String,
    nozzle: String,
    diametro: String,
) -> Result<Impressora, String> {
    let imp = Impressora {
        id: Uuid::new_v4().to_string(),
        modelo,
        watts,
        filamento,
        filamento_total: filamento,
        filamento_preco,
        filamento_tipo,
        nozzle,
        diametro,
    };

    storage::append(&data_dir, FILE, &imp)?;
    Ok(imp)
}

#[tauri::command]
pub fn update_impressora(
    data_dir: State<DataDir>,
    id: String,
    modelo: Option<String>,
    watts: Option<i32>,
    filamento: Option<i32>,
    filamento_total: Option<i32>,
    filamento_preco: Option<i32>,
    filamento_tipo: Option<String>,
    nozzle: Option<String>,
    diametro: Option<String>,
) -> Result<Impressora, String> {
    let mut items: Vec<Impressora> = storage::read_all(&data_dir, FILE)?;

    let item = items
        .iter_mut()
        .find(|i| i.id == id)
        .ok_or("Impressora não encontrada")?;

    if let Some(v) = modelo {
        if !v.is_empty() { item.modelo = v; }
    }
    if let Some(v) = watts {
        if v != 0 { item.watts = v; }
    }
    if let Some(v) = filamento {
        item.filamento = v;
    }
    if let Some(v) = filamento_total {
        if v != 0 { item.filamento_total = v; }
    }
    if let Some(v) = filamento_preco {
        if v != 0 { item.filamento_preco = v; }
    }
    if let Some(v) = filamento_tipo {
        if !v.is_empty() { item.filamento_tipo = v; }
    }
    if let Some(v) = nozzle {
        if !v.is_empty() { item.nozzle = v; }
    }
    if let Some(v) = diametro {
        if !v.is_empty() { item.diametro = v; }
    }

    let updated = item.clone();
    storage::write_all(&data_dir, FILE, &items)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_impressora(data_dir: State<DataDir>, id: String) -> Result<(), String> {
    let items: Vec<Impressora> = storage::read_all(&data_dir, FILE)?;
    let filtered: Vec<Impressora> = items.into_iter().filter(|i| i.id != id).collect();
    storage::write_all(&data_dir, FILE, &filtered)
}

#[tauri::command]
pub fn get_total_filamento(data_dir: State<DataDir>) -> Result<i32, String> {
    let items: Vec<Impressora> = storage::read_all(&data_dir, FILE)?;
    Ok(items.iter().map(|i| i.filamento).sum())
}

#[tauri::command]
pub fn get_filament_price(data_dir: State<DataDir>, modelo: String) -> Result<i32, String> {
    let items: Vec<Impressora> = storage::read_all(&data_dir, FILE)?;
    items
        .iter()
        .find(|i| i.modelo == modelo)
        .map(|i| i.filamento_preco)
        .ok_or("Impressora não encontrada".into())
}

#[tauri::command]
pub fn update_filament(data_dir: State<DataDir>, modelo: String, gasto: i32) -> Result<(), String> {
    let mut items: Vec<Impressora> = storage::read_all(&data_dir, FILE)?;

    if let Some(imp) = items.iter_mut().find(|i| i.modelo == modelo) {
        imp.filamento = (imp.filamento - gasto).max(0);
    }

    storage::write_all(&data_dir, FILE, &items)
}
