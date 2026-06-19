// =============================================================================
// Claybox³ᴰ — Armazenamento JSONL genérico
// =============================================================================

use serde::{de::DeserializeOwned, Serialize};
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;

/// Estado gerenciado que armazena o diretório base dos dados.
/// Inicializado no main() com o caminho correto para dev ou produção.
pub struct DataDir(pub Mutex<PathBuf>);

/// Resolve o caminho do arquivo JSONL usando o diretório base configurado.
pub fn resolve_path(data_dir: &DataDir, filename: &str) -> PathBuf {
    let dir = data_dir.0.lock().unwrap();
    dir.join(filename)
}

/// Detecta o diretório de dados correto:
/// - Em dev: raiz do projeto (3 níveis acima do executável em target/debug/)
/// - Em produção: app_data_dir do Tauri (ex: ~/.local/share/com.claybox3d.app/)
pub fn detect_data_dir(app: &tauri::AppHandle) -> PathBuf {
    // Tentar usar o app_data_dir do Tauri (funciona em produção)
    if let Ok(app_data) = app.path().app_data_dir() {
        // Em dev mode, o app_data_dir ainda existe mas preferimos o projeto root
        // Checamos se estamos em dev olhando se o exe está em target/debug/
        if let Ok(exe) = std::env::current_exe() {
            let exe_str = exe.to_string_lossy();
            if exe_str.contains("target/debug") || exe_str.contains("target\\debug") {
                // Dev mode: usar raiz do projeto
                if let Some(dir) = exe.parent() {
                    let project_root = dir.join("..").join("..").join("..");
                    if let Ok(canonical) = project_root.canonicalize() {
                        return canonical;
                    }
                }
            }
        }

        // Produção: usar app_data_dir e garantir que existe
        std::fs::create_dir_all(&app_data).ok();

        // Migrar dados existentes do diretório do executável (se houver)
        migrate_data_if_needed(&app_data);

        return app_data;
    }

    // Fallback: diretório do executável (mesma lógica anterior)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let project_root = dir.join("..").join("..").join("..");
            if let Ok(canonical) = project_root.canonicalize() {
                return canonical;
            }
        }
    }

    // Último fallback: CWD
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

/// Migra arquivos .jsonl do diretório do executável para o app_data_dir
/// (executado apenas uma vez na primeira inicialização em produção)
fn migrate_data_if_needed(app_data: &Path) {
    let data_files = ["clientes.jsonl", "estoque.jsonl", "impressoras.jsonl", "settings.jsonl"];

    for filename in &data_files {
        let target = app_data.join(filename);
        if target.exists() {
            continue; // Já migrado
        }

        // Procurar no diretório do executável
        if let Ok(exe) = std::env::current_exe() {
            if let Some(exe_dir) = exe.parent() {
                let source = exe_dir.join(filename);
                if source.exists() {
                    std::fs::copy(&source, &target).ok();
                }
            }
        }
    }
}

/// Lê todos os registros de um arquivo JSONL
pub fn read_all<T: DeserializeOwned>(data_dir: &DataDir, filename: &str) -> Result<Vec<T>, String> {
    let path = resolve_path(data_dir, filename);

    let file = match OpenOptions::new().read(true).open(&path) {
        Ok(f) => f,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("Erro ao abrir {:?}: {}", path, e)),
    };

    let reader = BufReader::new(file);
    let mut records = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Erro ao ler linha: {}", e))?;
        if line.trim().is_empty() {
            continue;
        }
        let record: T =
            serde_json::from_str(&line).map_err(|e| format!("Erro ao parsear JSON: {}", e))?;
        records.push(record);
    }

    Ok(records)
}

/// Adiciona um único registro ao final de um arquivo JSONL
pub fn append<T: Serialize>(data_dir: &DataDir, filename: &str, record: &T) -> Result<(), String> {
    let path = resolve_path(data_dir, filename);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let mut file = OpenOptions::new()
        .append(true)
        .create(true)
        .open(&path)
        .map_err(|e| format!("Erro ao abrir {:?}: {}", path, e))?;

    let json = serde_json::to_string(record).map_err(|e| format!("Erro ao serializar: {}", e))?;
    writeln!(file, "{}", json).map_err(|e| format!("Erro ao escrever: {}", e))?;

    Ok(())
}

/// Sobrescreve o arquivo inteiro com uma lista de registros
pub fn write_all<T: Serialize>(data_dir: &DataDir, filename: &str, records: &[T]) -> Result<(), String> {
    let path = resolve_path(data_dir, filename);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let mut file = OpenOptions::new()
        .write(true)
        .truncate(true)
        .create(true)
        .open(&path)
        .map_err(|e| format!("Erro ao abrir {:?}: {}", path, e))?;

    for record in records {
        let json =
            serde_json::to_string(record).map_err(|e| format!("Erro ao serializar: {}", e))?;
        writeln!(file, "{}", json).map_err(|e| format!("Erro ao escrever: {}", e))?;
    }

    Ok(())
}
