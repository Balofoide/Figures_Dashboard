// =============================================================================
// Commands — Estoque CRUD
// =============================================================================

use crate::models::Estoque;
use crate::storage::{self, DataDir};
use tauri::State;
use uuid::Uuid;

const FILE: &str = "estoque.jsonl";

#[tauri::command]
pub fn load_estoque(data_dir: State<DataDir>) -> Result<Vec<Estoque>, String> {
    storage::read_all(&data_dir, FILE)
}

#[tauri::command]
pub fn register_estoque(
    data_dir: State<DataDir>,
    material: String,
    quantidade: f64,
    quantidade_total: i32,
    medida: String,
    preco: f64,
) -> Result<Estoque, String> {
    let item = Estoque {
        id: Uuid::new_v4().to_string(),
        material,
        quantidade,
        quantidade_total,
        medida,
        preco,
    };

    storage::append(&data_dir, FILE, &item)?;
    Ok(item)
}

#[tauri::command]
pub fn update_estoque(
    data_dir: State<DataDir>,
    id: String,
    material: Option<String>,
    quantidade: Option<f64>,
    quantidade_total: Option<i32>,
    medida: Option<String>,
    preco: Option<f64>,
) -> Result<Estoque, String> {
    let mut items: Vec<Estoque> = storage::read_all(&data_dir, FILE)?;

    let item = items
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or("Item não encontrado")?;

    if let Some(v) = material {
        if !v.is_empty() { item.material = v; }
    }
    if let Some(v) = quantidade {
        item.quantidade = v;
    }
    if let Some(v) = quantidade_total {
        if v != 0 { item.quantidade_total = v; }
    }
    if let Some(v) = medida {
        if !v.is_empty() { item.medida = v; }
    }
    if let Some(v) = preco {
        item.preco = v;
    }

    let updated = item.clone();
    storage::write_all(&data_dir, FILE, &items)?;
    Ok(updated)
}

#[tauri::command]
pub fn delete_estoque(data_dir: State<DataDir>, id: String) -> Result<(), String> {
    let items: Vec<Estoque> = storage::read_all(&data_dir, FILE)?;
    let filtered: Vec<Estoque> = items.into_iter().filter(|e| e.id != id).collect();
    storage::write_all(&data_dir, FILE, &filtered)
}

#[tauri::command]
pub fn get_total_estoque(data_dir: State<DataDir>) -> Result<f64, String> {
    let items: Vec<Estoque> = storage::read_all(&data_dir, FILE)?;
    Ok(items.iter().map(|i| i.preco).sum())
}
