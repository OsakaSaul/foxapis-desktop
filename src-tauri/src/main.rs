// FoxAPIs Desktop — Tauri shell entry point.
// @version v0.1
//
// Boots the local MCP relay on 127.0.0.1:8732, sets up the system
// tray, registers the auto-start plugin, and emits relay events to
// the frontend so the Activity Log can render them live.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mcp_relay;
mod tray;

use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct AppState {
    pub bearer: Arc<Mutex<Option<String>>>,
    pub offline_mode: Arc<Mutex<bool>>,
    pub last_call_at: Arc<Mutex<Option<String>>>,
    pub cache_dir: std::path::PathBuf,
    pub events: Arc<Mutex<Vec<mcp_relay::RelayEvent>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let cache_dir = app
                .path()
                .app_cache_dir()
                .unwrap_or(std::env::temp_dir().join("foxapis-desktop"));
            let _ = std::fs::create_dir_all(&cache_dir);

            let state = AppState {
                bearer: Arc::new(Mutex::new(None)),
                offline_mode: Arc::new(Mutex::new(false)),
                last_call_at: Arc::new(Mutex::new(None)),
                cache_dir,
                events: Arc::new(Mutex::new(Vec::new())),
            };
            app.manage(state.clone());

            // System tray icon — credit balance + quick toggles.
            tray::install(app.handle())?;

            // Spawn the MCP relay on a background tokio task.
            let app_handle = app.handle().clone();
            let st = state.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = mcp_relay::serve(st, app_handle.clone()).await {
                    log::error!("mcp_relay exited: {e}");
                    let _ = app_handle.emit(
                        "mcp-relay-fatal",
                        serde_json::json!({ "error": format!("{e}") }),
                    );
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            connector_install,
            relay_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}

// ───────────────────────────────────────────────────────────────────
// Tauri commands
// ───────────────────────────────────────────────────────────────────

#[tauri::command]
async fn relay_status(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let last = state.last_call_at.lock().await.clone();
    Ok(serde_json::json!({
        "ok": true,
        "last_call_at": last,
    }))
}

/// Writes the FoxAPIs MCP entry into the named connector's config file.
/// Detects the platform, resolves the canonical config path, reads the
/// existing JSON/YAML (if present) and merges. Falls back to a write-
/// new-file path when the directory exists but the file doesn't.
#[tauri::command]
async fn connector_install(connector: String) -> Result<String, String> {
    use std::fs;
    use std::path::PathBuf;

    let url = "http://127.0.0.1:8732/mcp";
    let home = dirs::home_dir().ok_or("no home dir")?;
    let appdata = dirs::config_dir().unwrap_or(home.clone());

    // Map (connector, platform) -> path
    let path: PathBuf = match connector.as_str() {
        "claude-desktop" => {
            #[cfg(target_os = "macos")]
            {
                home.join("Library/Application Support/Claude/claude_desktop_config.json")
            }
            #[cfg(target_os = "windows")]
            {
                appdata.join("Claude/claude_desktop_config.json")
            }
            #[cfg(target_os = "linux")]
            {
                appdata.join("Claude/claude_desktop_config.json")
            }
        }
        "cursor" => home.join(".cursor/mcp.json"),
        "continue" => home.join(".continue/config.json"),
        other => return Err(format!("connector '{other}' is scaffold-only in v0.1; install manually")),
    };

    // Ensure parent dir exists.
    if let Some(p) = path.parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }

    let existing: serde_json::Value = if path.exists() {
        let txt = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&txt).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let merged = merge_connector_config(connector.as_str(), existing, url);

    let pretty = serde_json::to_string_pretty(&merged).map_err(|e| e.to_string())?;
    fs::write(&path, pretty).map_err(|e| e.to_string())?;

    Ok(format!("wrote {}", path.display()))
}

fn merge_connector_config(connector: &str, mut existing: serde_json::Value, url: &str) -> serde_json::Value {
    use serde_json::json;
    match connector {
        "claude-desktop" => {
            let entry = json!({
                "command": "node",
                "args": ["-e", format!("require('http').get('{url}/health', () => process.exit(0))")],
                "env": {}
            });
            let servers = existing
                .get_mut("mcpServers")
                .and_then(|v| v.as_object_mut());
            if let Some(map) = servers {
                map.insert("foxapis".into(), entry);
            } else {
                existing
                    .as_object_mut()
                    .unwrap()
                    .insert("mcpServers".into(), json!({ "foxapis": entry }));
            }
        }
        "cursor" => {
            let entry = json!({ "url": url });
            let servers = existing
                .get_mut("mcpServers")
                .and_then(|v| v.as_object_mut());
            if let Some(map) = servers {
                map.insert("foxapis".into(), entry);
            } else {
                existing
                    .as_object_mut()
                    .unwrap()
                    .insert("mcpServers".into(), json!({ "foxapis": entry }));
            }
        }
        "continue" => {
            let mut exp = existing
                .get("experimental")
                .cloned()
                .unwrap_or(json!({}));
            let mut servers = exp
                .get("modelContextProtocolServers")
                .cloned()
                .unwrap_or(json!([]));
            let entry = json!({
                "name": "foxapis",
                "transport": { "type": "http", "url": url }
            });
            if let Some(arr) = servers.as_array_mut() {
                arr.retain(|v| v.get("name").and_then(|n| n.as_str()) != Some("foxapis"));
                arr.push(entry);
            }
            exp["modelContextProtocolServers"] = servers;
            existing["experimental"] = exp;
        }
        _ => {}
    }
    existing
}
