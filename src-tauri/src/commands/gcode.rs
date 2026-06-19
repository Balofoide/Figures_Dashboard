// =============================================================================
// Commands — Importar e parsear arquivos G-code e 3MF
// Suporta: Cura, Creality Print, PrusaSlicer, OrcaSlicer, BambuStudio
// Formatos: .gcode, .gco, .g, .3mf
// =============================================================================

use crate::models::GcodeData;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

/// Constantes para cálculo de filamento metros → gramas
/// PLA: density ~1.24 g/cm³, diameter 1.75mm
/// cross_section = π * (0.875mm)² = 2.405 mm² = 0.02405 cm²
/// 1 metro = 100cm * 0.02405 cm² * 1.24 g/cm³ ≈ 2.98 g
const PLA_GRAMS_PER_METER: f64 = 2.98;

#[tauri::command]
pub async fn import_gcode(app: tauri::AppHandle) -> Result<Option<GcodeData>, String> {
    // Abrir diálogo de seleção de arquivo — aceita G-code e 3MF
    let file_path = app
        .dialog()
        .file()
        .add_filter("Modelos 3D", &["gcode", "gco", "g", "3mf"])
        .set_title("Importar arquivo G-code ou 3MF")
        .blocking_pick_file();

    let file_path = match file_path {
        Some(path) => path.into_path().map_err(|e| format!("Erro ao obter caminho: {}", e))?,
        None => return Ok(None), // Usuário cancelou
    };

    // Detectar formato pelo extensão
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let data = match ext.as_str() {
        "3mf" => parse_3mf_file(&file_path)?,
        _ => parse_gcode_file(&file_path)?,
    };

    Ok(Some(data))
}

/// Parseia um arquivo G-code e extrai metadados
fn parse_gcode_file(path: &Path) -> Result<GcodeData, String> {
    let file = std::fs::File::open(path)
        .map_err(|e| format!("Erro ao abrir arquivo: {}", e))?;

    let reader = BufReader::new(file);

    // Extrair nome do modelo a partir do nome do arquivo
    let nome_modelo = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Modelo")
        .to_string();

    let arquivo = path.to_string_lossy().to_string();

    let mut data = GcodeData {
        nome_modelo,
        tempo_horas: 0.0,
        filamento_gramas: 0.0,
        filamento_metros: 0.0,
        layer_height: 0.0,
        impressora: String::new(),
        filamento_tipo: String::new(),
        temperatura_nozzle: 0,
        temperatura_mesa: 0,
        slicer: String::new(),
        arquivo,
    };

    // Rastrear se já encontrou temperaturas (primeiro M104/M109 e M140/M190)
    let mut found_nozzle_temp = false;
    let mut found_bed_temp = false;

    for line_result in reader.lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue,
        };

        let trimmed = line.trim();

        // ── Linhas de comentário (metadados dos slicers) ────────────
        if trimmed.starts_with(';') {
            parse_comment(&mut data, trimmed);
            continue;
        }

        // ── Comandos G-code (temperaturas) ──────────────────────────
        if !found_nozzle_temp {
            if let Some(temp) = extract_nozzle_temp(trimmed) {
                if temp > 0 {
                    data.temperatura_nozzle = temp;
                    found_nozzle_temp = true;
                }
            }
        }

        if !found_bed_temp {
            if let Some(temp) = extract_bed_temp(trimmed) {
                if temp > 0 {
                    data.temperatura_mesa = temp;
                    found_bed_temp = true;
                }
            }
        }

        // Otimização: parar de buscar temperaturas após encontrar ambas
        // e se já temos os metadados principais (comments geralmente estão no topo)
        if found_nozzle_temp && found_bed_temp && data.tempo_horas > 0.0 && data.filamento_gramas > 0.0 {
            // Continuar lendo apenas se não temos informações do PrusaSlicer (que ficam no final)
            if !data.slicer.is_empty() {
                break;
            }
        }
    }

    // ── Conversões e fallbacks ──────────────────────────────────────

    // Se temos filamento em metros mas não em gramas, converter
    if data.filamento_gramas == 0.0 && data.filamento_metros > 0.0 {
        data.filamento_gramas = data.filamento_metros * PLA_GRAMS_PER_METER;
    }

    // Se temos filamento em gramas mas não em metros, converter inversamente
    if data.filamento_metros == 0.0 && data.filamento_gramas > 0.0 {
        data.filamento_metros = data.filamento_gramas / PLA_GRAMS_PER_METER;
    }

    // Arredondar valores para apresentação
    data.filamento_gramas = (data.filamento_gramas * 100.0).round() / 100.0;
    data.filamento_metros = (data.filamento_metros * 100.0).round() / 100.0;
    data.tempo_horas = (data.tempo_horas * 100.0).round() / 100.0;

    Ok(data)
}

// =============================================================================
// Parser de arquivos 3MF (Creality Print / OrcaSlicer / BambuStudio)
// 3MF = ZIP contendo XMLs e JSONs com metadados de impressão
// =============================================================================

/// Parseia um arquivo .3mf e extrai metadados de impressão
fn parse_3mf_file(path: &Path) -> Result<GcodeData, String> {
    let file = std::fs::File::open(path)
        .map_err(|e| format!("Erro ao abrir arquivo 3MF: {}", e))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Erro ao ler arquivo 3MF (não é um ZIP válido): {}", e))?;

    let nome_modelo = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Modelo")
        .to_string();

    let arquivo = path.to_string_lossy().to_string();

    let mut data = GcodeData {
        nome_modelo,
        tempo_horas: 0.0,
        filamento_gramas: 0.0,
        filamento_metros: 0.0,
        layer_height: 0.0,
        impressora: String::new(),
        filamento_tipo: String::new(),
        temperatura_nozzle: 0,
        temperatura_mesa: 0,
        slicer: String::new(),
        arquivo,
    };

    // ── 1. Ler slice_info.config (dados principais) ─────────────────
    if let Ok(content) = read_zip_text(&mut archive, "Metadata/slice_info.config") {
        parse_slice_info(&mut data, &content);
    }

    // ── 2. Ler creality.config (info do slicer) ─────────────────────
    if let Ok(content) = read_zip_text(&mut archive, "Metadata/creality.config") {
        parse_creality_config(&mut data, &content);
    }

    // ── 3. Ler project_settings.config (JSON com temperaturas) ──────
    if let Ok(content) = read_zip_text(&mut archive, "Metadata/project_settings.config") {
        parse_project_settings(&mut data, &content);
    }

    // ── Conversões e fallbacks ──────────────────────────────────────
    if data.filamento_gramas == 0.0 && data.filamento_metros > 0.0 {
        data.filamento_gramas = data.filamento_metros * PLA_GRAMS_PER_METER;
    }
    if data.filamento_metros == 0.0 && data.filamento_gramas > 0.0 {
        data.filamento_metros = data.filamento_gramas / PLA_GRAMS_PER_METER;
    }

    // Arredondar
    data.filamento_gramas = (data.filamento_gramas * 100.0).round() / 100.0;
    data.filamento_metros = (data.filamento_metros * 100.0).round() / 100.0;
    data.tempo_horas = (data.tempo_horas * 100.0).round() / 100.0;

    Ok(data)
}

/// Lê um arquivo texto de dentro do ZIP
fn read_zip_text(archive: &mut zip::ZipArchive<std::fs::File>, name: &str) -> Result<String, String> {
    let mut file = archive
        .by_name(name)
        .map_err(|e| format!("Arquivo '{}' não encontrado no 3MF: {}", name, e))?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| format!("Erro ao ler '{}': {}", name, e))?;
    Ok(content)
}

/// Extrai um atributo XML de uma tag: <tag key="X" value="Y"/>
/// Procura por: key="key_name" value="..."
fn extract_xml_attr(line: &str, key_name: &str) -> Option<String> {
    // Procura por: key="key_name" value="..."
    let key_pattern = format!("key=\"{}\"", key_name);
    if !line.contains(&key_pattern) {
        return None;
    }
    // Extrair o valor do atributo value="..."
    if let Some(start) = line.find("value=\"") {
        let rest = &line[start + 7..]; // skip 'value="'
        if let Some(end) = rest.find('"') {
            return Some(rest[..end].to_string());
        }
    }
    None
}

/// Extrai atributo de uma tag XML inline: <filament type="PLA" used_g="72.52" />
fn extract_inline_attr(line: &str, attr_name: &str) -> Option<String> {
    let pattern = format!("{}=\"", attr_name);
    if let Some(start) = line.find(&pattern) {
        let rest = &line[start + pattern.len()..];
        if let Some(end) = rest.find('"') {
            return Some(rest[..end].to_string());
        }
    }
    None
}

/// Parseia o slice_info.config XML
/// Contém: prediction (tempo), weight (gramas), printer_model_id, nozzle_diameters
/// E tags <filament type="PLA" used_m="24.31" used_g="72.52"/>
fn parse_slice_info(data: &mut GcodeData, content: &str) {
    for line in content.lines() {
        let trimmed = line.trim();

        // <metadata key="prediction" value="12523"/> (tempo em segundos)
        if let Some(val) = extract_xml_attr(trimmed, "prediction") {
            if let Ok(secs) = val.parse::<f64>() {
                data.tempo_horas = secs / 3600.0;
            }
        }

        // <metadata key="weight" value="72.52"/> (gramas)
        if let Some(val) = extract_xml_attr(trimmed, "weight") {
            if let Ok(g) = val.parse::<f64>() {
                if g > 0.0 {
                    data.filamento_gramas = g;
                }
            }
        }

        // <metadata key="printer_model_id" value="Creality_Ender_3_V3_KE"/>
        if let Some(val) = extract_xml_attr(trimmed, "printer_model_id") {
            if !val.is_empty() {
                // Converter underscores para espaços para ficar legível
                data.impressora = val.replace('_', " ");
            }
        }

        // <metadata key="nozzle_diameters" value="0.4"/>
        // (informativo, não temos campo no GcodeData)

        // <filament id="1" tray_info_idx="..." type="PLA" color="#FFF" used_m="24.31" used_g="72.52" />
        if trimmed.starts_with("<filament") || trimmed.contains("<filament ") {
            if let Some(ft) = extract_inline_attr(trimmed, "type") {
                if !ft.is_empty() && data.filamento_tipo.is_empty() {
                    data.filamento_tipo = ft;
                }
            }
            if let Some(um) = extract_inline_attr(trimmed, "used_m") {
                if let Ok(m) = um.parse::<f64>() {
                    data.filamento_metros = m;
                }
            }
            if let Some(ug) = extract_inline_attr(trimmed, "used_g") {
                if let Ok(g) = ug.parse::<f64>() {
                    if g > 0.0 {
                        data.filamento_gramas = g;
                    }
                }
            }
        }

        // <object identify_id="817" name="RearTopLeft_v1_0.stl" />
        // (nomes dos objetos — podemos concatenar ao nome do modelo no futuro)
    }
}

/// Parseia o creality.config XML
/// Contém: Application, AppVersion
fn parse_creality_config(data: &mut GcodeData, content: &str) {
    let mut app_name = String::new();
    let mut app_version = String::new();

    for line in content.lines() {
        let trimmed = line.trim();

        if let Some(val) = extract_xml_attr(trimmed, "Application") {
            app_name = val.replace('_', " ");
        }
        if let Some(val) = extract_xml_attr(trimmed, "AppVersion") {
            app_version = val;
        }
    }

    if !app_name.is_empty() {
        if !app_version.is_empty() {
            data.slicer = format!("{} {}", app_name, app_version);
        } else {
            data.slicer = app_name;
        }
    }
}

/// Parseia o project_settings.config (JSON)
/// Contém: layer_height, nozzle_temperature, hot_plate_temp, filament_type
fn parse_project_settings(data: &mut GcodeData, content: &str) {
    // O arquivo é JSON, mas usar serde_json aqui seria pesado.
    // Fazemos parsing simplificado por linha, suficiente para os campos que precisamos.

    let mut next_is_nozzle_temp = false;
    let mut next_is_bed_temp = false;
    let mut next_is_filament_type = false;

    for line in content.lines() {
        let trimmed = line.trim();

        // "layer_height": "0.2",
        if trimmed.starts_with("\"layer_height\"") && data.layer_height == 0.0 {
            if let Some(val) = extract_json_string_value(trimmed) {
                if let Ok(lh) = val.parse::<f64>() {
                    data.layer_height = lh;
                }
            }
        }

        // "nozzle_temperature": [   (próxima linha tem o valor)
        if trimmed == "\"nozzle_temperature\": [" {
            next_is_nozzle_temp = true;
            continue;
        }
        if next_is_nozzle_temp {
            next_is_nozzle_temp = false;
            let val = trimmed.trim_matches(|c: char| c == '"' || c == ',' || c.is_whitespace());
            if let Ok(temp) = val.parse::<i32>() {
                if temp > 0 && data.temperatura_nozzle == 0 {
                    data.temperatura_nozzle = temp;
                }
            }
        }

        // "hot_plate_temp": [   (próxima linha tem o valor)
        if trimmed == "\"hot_plate_temp\": [" {
            next_is_bed_temp = true;
            continue;
        }
        if next_is_bed_temp {
            next_is_bed_temp = false;
            let val = trimmed.trim_matches(|c: char| c == '"' || c == ',' || c.is_whitespace());
            if let Ok(temp) = val.parse::<i32>() {
                if temp > 0 && data.temperatura_mesa == 0 {
                    data.temperatura_mesa = temp;
                }
            }
        }

        // "filament_type": [   (próxima linha tem o valor)
        if trimmed == "\"filament_type\": [" {
            next_is_filament_type = true;
            continue;
        }
        if next_is_filament_type {
            next_is_filament_type = false;
            let val = trimmed.trim_matches(|c: char| c == '"' || c == ',' || c.is_whitespace());
            if !val.is_empty() && data.filamento_tipo.is_empty() {
                data.filamento_tipo = val.to_string();
            }
        }
    }
}

/// Extrai valor de string JSON simples: "key": "value", → value
fn extract_json_string_value(line: &str) -> Option<String> {
    let parts: Vec<&str> = line.splitn(2, ':').collect();
    if parts.len() < 2 {
        return None;
    }
    let val = parts[1].trim().trim_matches(|c: char| c == '"' || c == ',' || c.is_whitespace());
    if val.is_empty() {
        None
    } else {
        Some(val.to_string())
    }
}

/// Parseia uma linha de comentário e extrai metadados
fn parse_comment(data: &mut GcodeData, line: &str) {
    // Remove o ';' inicial e espaços
    let content = line.trim_start_matches(';').trim();

    // ═══════════════════════════════════════════════════════════════
    // Formato Cura / Creality Print
    // ═══════════════════════════════════════════════════════════════

    // ;TIME:7036 (tempo em segundos)
    if let Some(val) = strip_prefix_ci(content, "TIME:") {
        if let Ok(secs) = val.trim().parse::<f64>() {
            data.tempo_horas = secs / 3600.0;
        }
        return;
    }

    // ;Filament used: 1.20047m
    if let Some(val) = strip_prefix_ci(content, "Filament used:") {
        let val = val.trim();
        if let Some(meters_str) = val.strip_suffix('m') {
            if let Ok(meters) = meters_str.trim().parse::<f64>() {
                data.filamento_metros = meters;
            }
        }
        return;
    }

    // ;Layer height: 0.12
    if let Some(val) = strip_prefix_ci(content, "Layer height:") {
        if let Ok(lh) = val.trim().parse::<f64>() {
            data.layer_height = lh;
        }
        return;
    }

    // ;TARGET_MACHINE.NAME:Creality Ender-3 V3 KE
    if let Some(val) = strip_prefix_ci(content, "TARGET_MACHINE.NAME:") {
        let name = val.trim();
        if !name.is_empty() {
            data.impressora = name.to_string();
        }
        return;
    }

    // ;Generated with Cura_SteamEngine 5.6.0
    if let Some(val) = strip_prefix_ci(content, "Generated with") {
        data.slicer = val.trim().to_string();
        return;
    }

    // ;Filament weight: 10.4g  (some Cura versions)
    if let Some(val) = strip_prefix_ci(content, "Filament weight:") {
        let val = val.trim();
        if let Some(grams_str) = val.strip_suffix('g') {
            if let Ok(grams) = grams_str.trim().parse::<f64>() {
                if grams > 0.0 {
                    data.filamento_gramas = grams;
                }
            }
        }
        return;
    }

    // ;MATERIAL:PLA  (some Creality Print versions)
    if let Some(val) = strip_prefix_ci(content, "MATERIAL:") {
        let val = val.trim();
        if !val.is_empty() {
            data.filamento_tipo = val.to_string();
        }
        return;
    }

    // ═══════════════════════════════════════════════════════════════
    // Formato PrusaSlicer / OrcaSlicer / BambuStudio
    // (geralmente no final do arquivo)
    // ═══════════════════════════════════════════════════════════════

    // ; estimated printing time (normal mode) = 2h 30m 15s
    // ; estimated printing time = 2h 30m 15s
    if content.starts_with("estimated printing time") {
        if let Some(time_str) = content.split('=').nth(1) {
            data.tempo_horas = parse_time_string(time_str.trim());
        }
        return;
    }

    // ; filament used [g] = 15.60
    // ; total filament used [g] = 15.60
    if (content.starts_with("filament used [g]") || content.starts_with("total filament used [g]"))
        && content.contains('=')
    {
        if let Some(val) = content.split('=').nth(1) {
            if let Ok(grams) = val.trim().parse::<f64>() {
                if grams > 0.0 {
                    data.filamento_gramas = grams;
                }
            }
        }
        return;
    }

    // ; filament used [mm] = 5200.00
    if content.starts_with("filament used [mm]") && content.contains('=') {
        if let Some(val) = content.split('=').nth(1) {
            if let Ok(mm) = val.trim().parse::<f64>() {
                data.filamento_metros = mm / 1000.0; // mm → m
            }
        }
        return;
    }

    // ; filament used [m] = 5.200
    if content.starts_with("filament used [m]") && content.contains('=') {
        if let Some(val) = content.split('=').nth(1) {
            if let Ok(m) = val.trim().parse::<f64>() {
                data.filamento_metros = m;
            }
        }
        return;
    }

    // ; filament_type = PLA
    if content.starts_with("filament_type") && content.contains('=') {
        if let Some(val) = content.split('=').nth(1) {
            let val = val.trim();
            if !val.is_empty() && data.filamento_tipo.is_empty() {
                data.filamento_tipo = val.to_string();
            }
        }
        return;
    }

    // ; layer_height = 0.2
    if content.starts_with("layer_height") && content.contains('=') && data.layer_height == 0.0 {
        if let Some(val) = content.split('=').nth(1) {
            if let Ok(lh) = val.trim().parse::<f64>() {
                data.layer_height = lh;
            }
        }
        return;
    }

    // ; nozzle_diameter = 0.4
    // (não temos campo para isso no GcodeData, mas pode ser útil no futuro)

    // ; generated by PrusaSlicer 2.7.1
    // ; generated by OrcaSlicer 2.0.0
    // ; generated by BambuStudio 1.9.0
    if content.starts_with("generated by") {
        let slicer_name = content.strip_prefix("generated by").unwrap_or("").trim();
        if !slicer_name.is_empty() {
            data.slicer = slicer_name.to_string();
        }
        return;
    }

    // ; printer_model = ...
    if content.starts_with("printer_model") && content.contains('=') {
        if let Some(val) = content.split('=').nth(1) {
            let val = val.trim();
            if !val.is_empty() && data.impressora.is_empty() {
                data.impressora = val.to_string();
            }
        }
    }
}

/// Parseia string de tempo como "2h 30m 15s" ou "1d 2h 30m 15s" para horas decimais
fn parse_time_string(s: &str) -> f64 {
    let mut hours = 0.0;

    for part in s.split_whitespace() {
        if let Some(num_str) = part.strip_suffix('d') {
            if let Ok(d) = num_str.parse::<f64>() {
                hours += d * 24.0;
            }
        } else if let Some(num_str) = part.strip_suffix('h') {
            if let Ok(h) = num_str.parse::<f64>() {
                hours += h;
            }
        } else if let Some(num_str) = part.strip_suffix('m') {
            if let Ok(m) = num_str.parse::<f64>() {
                hours += m / 60.0;
            }
        } else if let Some(num_str) = part.strip_suffix('s') {
            if let Ok(sec) = num_str.parse::<f64>() {
                hours += sec / 3600.0;
            }
        }
    }

    hours
}

/// Extrai temperatura do nozzle de comandos M104 (set) ou M109 (set+wait)
/// Formato: M104 S200 ou M109 S200
fn extract_nozzle_temp(line: &str) -> Option<i32> {
    if line.starts_with("M104") || line.starts_with("M109") {
        return extract_s_param(line);
    }
    None
}

/// Extrai temperatura da mesa de comandos M140 (set) ou M190 (set+wait)
/// Formato: M140 S60 ou M190 S60
fn extract_bed_temp(line: &str) -> Option<i32> {
    if line.starts_with("M140") || line.starts_with("M190") {
        return extract_s_param(line);
    }
    None
}

/// Extrai parâmetro S de um comando G-code (ex: "M104 S200" → 200)
fn extract_s_param(line: &str) -> Option<i32> {
    for part in line.split_whitespace() {
        if let Some(val_str) = part.strip_prefix('S') {
            if let Ok(val) = val_str.parse::<f64>() {
                return Some(val as i32);
            }
        }
    }
    None
}

/// Case-insensitive prefix strip
fn strip_prefix_ci<'a>(s: &'a str, prefix: &str) -> Option<&'a str> {
    let s_lower = s.to_lowercase();
    let prefix_lower = prefix.to_lowercase();
    if s_lower.starts_with(&prefix_lower) {
        Some(&s[prefix.len()..])
    } else {
        None
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_time_string() {
        assert!((parse_time_string("2h 30m 15s") - 2.504).abs() < 0.01);
        assert!((parse_time_string("1d 2h") - 26.0).abs() < 0.01);
        assert!((parse_time_string("45m") - 0.75).abs() < 0.01);
        assert!((parse_time_string("3600s") - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_extract_s_param() {
        assert_eq!(extract_s_param("M104 S200"), Some(200));
        assert_eq!(extract_s_param("M140 S60"), Some(60));
        assert_eq!(extract_s_param("M109 S210 T0"), Some(210));
        assert_eq!(extract_s_param("G28"), None);
    }

    #[test]
    fn test_strip_prefix_ci() {
        assert_eq!(strip_prefix_ci("TIME:7036", "TIME:"), Some("7036"));
        assert_eq!(strip_prefix_ci("time:7036", "TIME:"), Some("7036"));
        assert_eq!(strip_prefix_ci("Layer height: 0.2", "Layer height:"), Some(" 0.2"));
        assert_eq!(strip_prefix_ci("NotMatching", "TIME:"), None);
    }

    #[test]
    fn test_parse_cura_comments() {
        let mut data = GcodeData {
            nome_modelo: String::new(),
            tempo_horas: 0.0,
            filamento_gramas: 0.0,
            filamento_metros: 0.0,
            layer_height: 0.0,
            impressora: String::new(),
            filamento_tipo: String::new(),
            temperatura_nozzle: 0,
            temperatura_mesa: 0,
            slicer: String::new(),
            arquivo: String::new(),
        };

        parse_comment(&mut data, ";TIME:7036");
        assert!((data.tempo_horas - 1.954).abs() < 0.01);

        parse_comment(&mut data, ";Filament used: 1.20047m");
        assert!((data.filamento_metros - 1.20047).abs() < 0.001);

        parse_comment(&mut data, ";Layer height: 0.12");
        assert!((data.layer_height - 0.12).abs() < 0.001);

        parse_comment(&mut data, ";TARGET_MACHINE.NAME:Creality Ender-3 V3 KE");
        assert_eq!(data.impressora, "Creality Ender-3 V3 KE");

        parse_comment(&mut data, ";Generated with Cura_SteamEngine 5.6.0");
        assert_eq!(data.slicer, "Cura_SteamEngine 5.6.0");
    }

    #[test]
    fn test_parse_prusaslicer_comments() {
        let mut data = GcodeData {
            nome_modelo: String::new(),
            tempo_horas: 0.0,
            filamento_gramas: 0.0,
            filamento_metros: 0.0,
            layer_height: 0.0,
            impressora: String::new(),
            filamento_tipo: String::new(),
            temperatura_nozzle: 0,
            temperatura_mesa: 0,
            slicer: String::new(),
            arquivo: String::new(),
        };

        parse_comment(&mut data, "; estimated printing time (normal mode) = 2h 30m 15s");
        assert!((data.tempo_horas - 2.504).abs() < 0.01);

        parse_comment(&mut data, "; filament used [g] = 15.60");
        assert!((data.filamento_gramas - 15.60).abs() < 0.01);

        parse_comment(&mut data, "; filament used [mm] = 5200.00");
        assert!((data.filamento_metros - 5.2).abs() < 0.01);

        parse_comment(&mut data, "; filament_type = PLA");
        assert_eq!(data.filamento_tipo, "PLA");

        parse_comment(&mut data, "; generated by PrusaSlicer 2.7.1");
        assert_eq!(data.slicer, "PrusaSlicer 2.7.1");

        parse_comment(&mut data, "; printer_model = MK3S");
        assert_eq!(data.impressora, "MK3S");
    }

    // ── Testes 3MF ────────────────────────────────────────────────

    #[test]
    fn test_extract_xml_attr() {
        let line = r#"<metadata key="prediction" value="12523"/>"#;
        assert_eq!(extract_xml_attr(line, "prediction"), Some("12523".to_string()));
        assert_eq!(extract_xml_attr(line, "weight"), None);

        let line2 = r#"<metadata key="printer_model_id" value="Creality_Ender_3_V3_KE"/>"#;
        assert_eq!(extract_xml_attr(line2, "printer_model_id"), Some("Creality_Ender_3_V3_KE".to_string()));
    }

    #[test]
    fn test_extract_inline_attr() {
        let line = r##"<filament id="1" tray_info_idx="01001" type="PLA" color="#FFFFFF" used_m="24.31" used_g="72.52" />"##;
        assert_eq!(extract_inline_attr(line, "type"), Some("PLA".to_string()));
        assert_eq!(extract_inline_attr(line, "used_m"), Some("24.31".to_string()));
        assert_eq!(extract_inline_attr(line, "used_g"), Some("72.52".to_string()));
        assert_eq!(extract_inline_attr(line, "color"), Some("#FFFFFF".to_string()));
        assert_eq!(extract_inline_attr(line, "nonexistent"), None);
    }

    #[test]
    fn test_parse_slice_info() {
        let xml = r##"<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-CX-Client-Type" value="creality_print"/>
    <header_item key="X-CX-Client-Version" value="06.02.02.3203"/>
  </header>
  <plate>
    <metadata key="index" value="6"/>
    <metadata key="printer_model_id" value="Creality_Ender_3_V3_KE"/>
    <metadata key="nozzle_diameters" value="0.4"/>
    <metadata key="prediction" value="12523"/>
    <metadata key="weight" value="72.52"/>
    <object identify_id="817" name="RearTopLeft_v1_0.stl" skipped="false" />
    <filament id="1" tray_info_idx="01001" type="PLA" color="#FFFFFF" used_m="24.31" used_g="72.52" />
  </plate>
</config>"##;

        let mut data = GcodeData {
            nome_modelo: String::new(),
            tempo_horas: 0.0,
            filamento_gramas: 0.0,
            filamento_metros: 0.0,
            layer_height: 0.0,
            impressora: String::new(),
            filamento_tipo: String::new(),
            temperatura_nozzle: 0,
            temperatura_mesa: 0,
            slicer: String::new(),
            arquivo: String::new(),
        };

        parse_slice_info(&mut data, xml);

        // prediction = 12523 segundos = 3.478 horas
        assert!((data.tempo_horas - 3.478).abs() < 0.01);
        // weight & used_g
        assert!((data.filamento_gramas - 72.52).abs() < 0.01);
        // used_m
        assert!((data.filamento_metros - 24.31).abs() < 0.01);
        // printer_model_id (underscores → spaces)
        assert_eq!(data.impressora, "Creality Ender 3 V3 KE");
        // filament type
        assert_eq!(data.filamento_tipo, "PLA");
    }

    #[test]
    fn test_parse_creality_config() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<config>
    <metadata key="Company" value="Creality"/>
    <metadata key="Application" value="Creality_Print"/>
    <metadata key="AppVersion" value="6.2.2.3203"/>
    <metadata key="AppStage" value="Release"/>
</config>"#;

        let mut data = GcodeData {
            nome_modelo: String::new(),
            tempo_horas: 0.0,
            filamento_gramas: 0.0,
            filamento_metros: 0.0,
            layer_height: 0.0,
            impressora: String::new(),
            filamento_tipo: String::new(),
            temperatura_nozzle: 0,
            temperatura_mesa: 0,
            slicer: String::new(),
            arquivo: String::new(),
        };

        parse_creality_config(&mut data, xml);
        assert_eq!(data.slicer, "Creality Print 6.2.2.3203");
    }

    #[test]
    fn test_parse_project_settings() {
        let json = r#"{
    "filament_type": [
        "PLA"
    ],
    "layer_height": "0.2",
    "nozzle_temperature": [
        "220"
    ],
    "hot_plate_temp": [
        "50"
    ]
}"#;

        let mut data = GcodeData {
            nome_modelo: String::new(),
            tempo_horas: 0.0,
            filamento_gramas: 0.0,
            filamento_metros: 0.0,
            layer_height: 0.0,
            impressora: String::new(),
            filamento_tipo: String::new(),
            temperatura_nozzle: 0,
            temperatura_mesa: 0,
            slicer: String::new(),
            arquivo: String::new(),
        };

        parse_project_settings(&mut data, json);
        assert!((data.layer_height - 0.2).abs() < 0.001);
        assert_eq!(data.temperatura_nozzle, 220);
        assert_eq!(data.temperatura_mesa, 50);
        assert_eq!(data.filamento_tipo, "PLA");
    }

    #[test]
    fn test_extract_json_string_value() {
        assert_eq!(
            extract_json_string_value(r#""layer_height": "0.2","#),
            Some("0.2".to_string())
        );
        assert_eq!(
            extract_json_string_value(r#""some_key": "hello world","#),
            Some("hello world".to_string())
        );
        assert_eq!(extract_json_string_value(r#""empty": "","#), None);
    }
}
