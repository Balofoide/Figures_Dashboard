// =============================================================================
// Commands — Calculadora de preço de impressão 3D
// =============================================================================

#[tauri::command]
pub fn calculate_price(
    material: f64,
    tempo: i32,
    filamento_preco: f64,
    energia: f64,
    lucro: i64,
    watts: i64,
) -> Result<f64, String> {
    // Custo do filamento: preço/kg → preço/g × gramas usadas
    let filament_gram = filamento_preco / 1000.0;
    let object_cost = material * filament_gram;

    // Custo de energia: watts → kW × horas × preço/kWh
    let kwatts = watts as f64 / 1000.0;
    let energy_cost = tempo as f64 * kwatts * energia;

    // Total com margem de lucro
    let total = (object_cost + energy_cost) * (1.0 + lucro as f64 / 100.0);
    Ok(total)
}
