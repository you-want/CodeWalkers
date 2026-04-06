use tauri::{Manager, Emitter, menu::{MenuBuilder, MenuItemBuilder, CheckMenuItemBuilder, SubmenuBuilder}, tray::TrayIconBuilder};

mod providers;
mod session;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn set_ignore_cursor_events(app: tauri::AppHandle, ignore: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
fn get_mouse_pos(app: tauri::AppHandle, window: tauri::Window) -> Result<(f64, f64), String> {
    match app.cursor_position() {
        Ok(pos) => {
            let scale_factor = window.scale_factor().unwrap_or(1.0);
            
            // Both are physical, convert to logical
            let screen_logical = pos.to_logical::<f64>(scale_factor);
            
            let window_physical = window.inner_position().unwrap_or(tauri::PhysicalPosition::new(0, 0));
            let window_logical = window_physical.to_logical::<f64>(scale_factor);
            
            // Client coordinates
            let client_x = screen_logical.x - window_logical.x;
            let client_y = screen_logical.y - window_logical.y;
            
            Ok((client_x, client_y))
        }
        Err(e) => {
            // Fallback to mouse-position crate if app.cursor_position fails
            use mouse_position::mouse_position::Mouse;
            match Mouse::get_mouse_position() {
                Mouse::Position { x, y } => {
                    // CoreGraphics on macOS returns logical points (x, y)
                    let screen_x_logical = x as f64;
                    let screen_y_logical = y as f64;
                    
                    let scale_factor = window.scale_factor().unwrap_or(1.0);
                    let window_physical = window.inner_position().unwrap_or(tauri::PhysicalPosition::new(0, 0));
                    let window_logical = window_physical.to_logical::<f64>(scale_factor);
                    
                    let client_x = screen_x_logical - window_logical.x;
                    let client_y = screen_y_logical - window_logical.y;
                    
                    Ok((client_x, client_y))
                }
                Mouse::Error => Err(e.to_string())
            }
        }
    }
}

#[tauri::command]
fn set_display_mode(app: tauri::AppHandle, mode: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if mode == "primary" {
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let position = monitor.position();
                let size = monitor.size();
                window.set_size(*size).unwrap_or_default();
                window.set_position(*position).unwrap_or_default();
            }
        } else if mode == "all" {
            if let Ok(monitors) = window.available_monitors() {
                if monitors.is_empty() {
                    return Ok(());
                }
                let mut min_x = monitors[0].position().x;
                let mut min_y = monitors[0].position().y;
                let mut max_x = min_x + monitors[0].size().width as i32;
                let mut max_y = min_y + monitors[0].size().height as i32;

                for m in monitors.iter().skip(1) {
                    let pos = m.position();
                    let size = m.size();
                    min_x = min_x.min(pos.x);
                    min_y = min_y.min(pos.y);
                    max_x = max_x.max(pos.x + size.width as i32);
                    max_y = max_y.max(pos.y + size.height as i32);
                }

                let width = (max_x - min_x) as u32;
                let height = (max_y - min_y) as u32;
                window.set_size(tauri::PhysicalSize::new(width, height)).unwrap_or_default();
                window.set_position(tauri::PhysicalPosition::new(min_x, min_y)).unwrap_or_default();
            }
        } else if mode.starts_with("monitor_") {
            if let Ok(idx) = mode.replace("monitor_", "").parse::<usize>() {
                if let Ok(monitors) = window.available_monitors() {
                    if let Some(monitor) = monitors.get(idx) {
                        let position = monitor.position();
                        let size = monitor.size();
                        window.set_size(*size).unwrap_or_default();
                        window.set_position(*position).unwrap_or_default();
                    }
                }
            }
        }
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let char_bruce = CheckMenuItemBuilder::new("Bruce").id("char_bruce").accelerator("CmdOrCtrl+1").checked(true).build(app)?;
            let char_jazz = CheckMenuItemBuilder::new("Jazz").id("char_jazz").accelerator("CmdOrCtrl+2").checked(true).build(app)?;
            
            let sounds_item = CheckMenuItemBuilder::new("Sounds").id("sounds").checked(true).build(app)?;
            
            let provider_status = providers::check_providers();
            
            let mut provider_items = Vec::new();
            for p in provider_status {
                let id = format!("prov_{}", p.name.to_lowercase());
                
                let item = CheckMenuItemBuilder::new(&p.name)
                    .id(&id)
                    .enabled(p.is_installed)
                    .checked(false)
                    .build(app)?;
                provider_items.push(item);
            }
            
            // Set the first installed provider as checked
            if let Some(first_installed) = provider_items.iter().find(|i| i.is_enabled().unwrap_or(false)) {
                let _ = first_installed.set_checked(true);
            }

            let mut provider_submenu_builder = SubmenuBuilder::new(app, "Provider");
            for item in &provider_items {
                provider_submenu_builder = provider_submenu_builder.item(item);
            }
            let provider_submenu = provider_submenu_builder.build()?;
            
            let size_small = CheckMenuItemBuilder::new("Small").id("size_small").checked(false).build(app)?;
            let size_medium = CheckMenuItemBuilder::new("Medium").id("size_medium").checked(true).build(app)?;
            let size_large = CheckMenuItemBuilder::new("Large").id("size_large").checked(false).build(app)?;
            let size_submenu = SubmenuBuilder::new(app, "Size")
                .item(&size_small)
                .item(&size_medium)
                .item(&size_large)
                .build()?;
                
            let style_midnight = CheckMenuItemBuilder::new("Midnight").id("style_midnight").checked(true).build(app)?;
            let style_peach = CheckMenuItemBuilder::new("Peach").id("style_peach").checked(false).build(app)?;
            let style_cloud = CheckMenuItemBuilder::new("Cloud").id("style_cloud").checked(false).build(app)?;
            let style_moss = CheckMenuItemBuilder::new("Moss").id("style_moss").checked(false).build(app)?;
            let style_submenu = SubmenuBuilder::new(app, "Style")
                .item(&style_midnight)
                .item(&style_peach)
                .item(&style_cloud)
                .item(&style_moss)
                .build()?;
                
            /* Display menu commented out temporarily
            let disp_primary = CheckMenuItemBuilder::new("Primary").id("disp_primary").checked(true).build(app)?;
            let disp_all = CheckMenuItemBuilder::new("All Displays").id("disp_all").checked(false).build(app)?;
            
            let mut display_submenu_builder = SubmenuBuilder::new(app, "Display")
                .item(&disp_primary)
                .item(&disp_all);
                
            let mut displays = vec![disp_primary, disp_all];
            
            // Auto-detect extra monitors
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(monitors) = window.available_monitors() {
                    if monitors.len() > 1 {
                        display_submenu_builder = display_submenu_builder.separator();
                        for (i, monitor) in monitors.iter().enumerate() {
                            let name = monitor.name().map(|n| n.to_string()).unwrap_or_else(|| format!("Monitor {}", i + 1));
                            let id = format!("disp_monitor_{}", i);
                            let disp_item = CheckMenuItemBuilder::new(&name).id(&id).checked(false).build(app)?;
                            display_submenu_builder = display_submenu_builder.item(&disp_item);
                            displays.push(disp_item);
                        }
                    }
                }
            }
                
            let display_submenu = display_submenu_builder.build()?;
            */
                
            let quit_i = MenuItemBuilder::with_id("quit", "Quit").accelerator("CmdOrCtrl+Q").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&char_bruce)
                .item(&char_jazz)
                .separator()
                .item(&sounds_item)
                .item(&provider_submenu)
                .item(&size_submenu)
                .item(&style_submenu)
                // .item(&display_submenu)
                .separator()
                .item(&quit_i)
                .build()?;

            let chars = vec![char_bruce, char_jazz];
            let providers = provider_items;
            let sizes = vec![size_small, size_medium, size_large];
            let styles = vec![style_midnight, style_peach, style_cloud, style_moss];
            let sounds_item_clone = sounds_item.clone();
            
            let bruce_checked = std::sync::Arc::new(std::sync::Mutex::new(true));
            let jazz_checked = std::sync::Arc::new(std::sync::Mutex::new(true));
            let sounds_checked = std::sync::Arc::new(std::sync::Mutex::new(true));
            
            let bruce_c = bruce_checked.clone();
            let jazz_c = jazz_checked.clone();
            let sounds_c = sounds_checked.clone();
            
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app: &tauri::AppHandle, event| {
                    let id = event.id.as_ref();
                    println!("Tray menu clicked: '{}'", id);
                    
                    if id == "char_bruce" {
                        let mut b = bruce_c.lock().unwrap();
                        *b = !*b;
                        for c in &chars {
                            if c.id().0 == "char_bruce" {
                                let _ = c.set_checked(*b);
                            }
                        }
                    } else if id == "char_jazz" {
                        let mut j = jazz_c.lock().unwrap();
                        *j = !*j;
                        for c in &chars {
                            if c.id().0 == "char_jazz" {
                                let _ = c.set_checked(*j);
                            }
                        }
                    } else if id.starts_with("prov_") {
                        for p in &providers {
                            let _ = p.set_checked(p.id().0 == id);
                        }
                    } else if id.starts_with("size_") {
                        for s in &sizes {
                            let _ = s.set_checked(s.id().0 == id);
                        }
                    } else if id.starts_with("style_") {
                        for s in &styles {
                            let _ = s.set_checked(s.id().0 == id);
                        }
                    /* Display commented out
                    } else if id.starts_with("disp_") {
                        for d in &displays {
                            let _ = d.set_checked(d.id().0 == id);
                        }
                    */
                    } else if id == "sounds" {
                        let mut s = sounds_c.lock().unwrap();
                        *s = !*s;
                        let _ = sounds_item_clone.set_checked(*s);
                    } else if id == "quit" {
                        std::process::exit(0);
                    }
                    
                    app.emit("tray_event", id).unwrap_or_default();
                })
                .build(app)?;

            let window = app.get_webview_window("main").unwrap();
            
            // Try to make the window cover the primary monitor
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let size = monitor.size();
                // Set size to full screen
                window.set_size(*size).unwrap();
                window.set_position(tauri::PhysicalPosition::new(0, 0)).unwrap();
            } else {
                window.maximize().unwrap();
            }

            Ok(())
        })
        .manage(session::SessionState {
            stdin_txs: std::sync::Mutex::new(std::collections::HashMap::new()),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_mouse_pos,
            providers::check_providers,
            providers::install_provider,
            session::start_session,
            session::send_message,
            set_ignore_cursor_events,
            set_display_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
