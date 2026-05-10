// System tray — credit balance widget + show/hide window + quit.
// @version v0.1
//
// v0.1 ships the menu structure but the credit-balance label is a
// placeholder (TODO: poll the local relay's /credits endpoint and
// re-set the title text on each tick once MentionFox MCP exposes a
// real balance method).

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show FoxAPIs Desktop", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide window", true, None::<&str>)?;
    let credits = MenuItem::with_id(app, "credits", "Credits: —", false, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&credits, &show, &hide, &quit])?;

    let _tray = TrayIconBuilder::with_id("foxapis-tray")
        .tooltip("FoxAPIs Desktop")
        .menu(&menu)
        .on_menu_event(|app, evt| match evt.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "hide" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, evt| {
            if let TrayIconEvent::Click { .. } = evt {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
