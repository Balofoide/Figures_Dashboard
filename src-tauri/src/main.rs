// =============================================================================
// Figure Manager — Tauri v2 Entry Point
// =============================================================================

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod commands;
mod models;
mod storage;

use commands::{calculator, clients, envio, estoque, gcode, printers, settings};
use storage::DataDir;
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Detectar o diretório correto para dados
            let data_dir = storage::detect_data_dir(app.handle());
            println!("[Figure Manager] Diretório de dados: {:?}", data_dir);
            app.manage(DataDir(Mutex::new(data_dir)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Pedidos
            clients::load_clients,
            clients::register_client,
            clients::update_client,
            clients::delete_client,
            clients::get_total_vendas,
            clients::get_vendas_mes,
            // Estoque
            estoque::load_estoque,
            estoque::register_estoque,
            estoque::update_estoque,
            estoque::delete_estoque,
            estoque::get_total_estoque,
            // Impressoras
            printers::load_impressoras,
            printers::register_impressora,
            printers::update_impressora,
            printers::delete_impressora,
            printers::get_total_filamento,
            printers::get_filament_price,
            printers::update_filament,
            // Calculadora
            calculator::calculate_price,
            // G-code
            gcode::import_gcode,
            // Configurações
            settings::load_settings,
            settings::save_settings,
            // Melhor Envio
            envio::get_auth_url,
            envio::exchange_auth_code,
            envio::refresh_access_token,
            envio::disconnect_melhor_envio,
            envio::lookup_cep,
            envio::calculate_shipping,
            envio::add_to_cart,
            envio::get_cart,
            envio::checkout_order,
            envio::get_labels,
            envio::generate_label,
            envio::print_label,
            envio::get_tracking,
            envio::cancel_label,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o Figure Manager");
}
