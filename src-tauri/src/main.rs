#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
#[cfg(target_os = "macos")]
mod macos_overlay;

use db::Db;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_positioner::{Position, WindowExt};

#[cfg(target_os = "macos")]
use tauri::RunEvent;

static QUICK_SHOWN: AtomicBool = AtomicBool::new(false);

fn show_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// 显示 / 隐藏快速记账窗口
fn toggle_quick(app: &AppHandle) {
    let Some(win) = app.get_webview_window("quick") else {
        return;
    };

    if QUICK_SHOWN.load(Ordering::Relaxed) && win.is_visible().unwrap_or(false) {
        QUICK_SHOWN.store(false, Ordering::Relaxed);
        let _ = win.hide();
        return;
    }

    // 贴到菜单栏图标下方；拿不到托盘位置时退回屏幕右上角
    if win.move_window(Position::TrayBottomCenter).is_err() {
        let _ = win.move_window(Position::TopRight);
    }

    QUICK_SHOWN.store(true, Ordering::Relaxed);

    #[cfg(target_os = "macos")]
    {
        macos_overlay::show(&win);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = win.show();
        let _ = win.set_focus();
    }

    let _ = win.emit("quick-focus", ());
}

fn hide_quick(app: &AppHandle) {
    QUICK_SHOWN.store(false, Ordering::Relaxed);
    if let Some(win) = app.get_webview_window("quick") {
        let _ = win.hide();
    }
}

/// 启动时的每日自动备份
fn daily_backup(app: &AppHandle) {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };

    let need = {
        let state = app.state::<Db>();
        let guard = state.0.lock();
        match guard {
            Ok(conn) => db::meta_get(&conn, "last_backup_at").as_deref() != Some(today.as_str()),
            Err(_) => false,
        }
    };
    if !need {
        return;
    }

    if let Ok(conn) = app.state::<Db>().0.lock() {
        if db::backup_to(&conn, &dir.join("backups")).is_ok() {
            let _ = db::meta_set(&conn, "last_backup_at", &today);
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        toggle_quick(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            // ---------- 数据库 ----------
            let dir = match std::env::var("INK_LEDGER_DATA_DIR") {
                Ok(p) if !p.trim().is_empty() => std::path::PathBuf::from(p),
                _ => app.path().app_data_dir()?,
            };
            std::fs::create_dir_all(&dir)?;
            let db_path = dir.join("ledger.db");
            let conn = db::open(&db_path)?;
            db::seed_if_empty(&conn)?;
            let _ = db::meta_set(&conn, "db_path", &db_path.to_string_lossy());
            app.manage(Db(Mutex::new(conn)));

            daily_backup(app.handle());

            // ---------- 菜单栏 ----------
            let show_item = MenuItem::with_id(app, "show", "打开墨账", true, None::<&str>)?;
            let quick_item = MenuItem::with_id(app, "quick", "快速记一笔", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出墨账", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quick_item, &quit_item])?;

            let mut tray = TrayIconBuilder::with_id("ink-ledger-tray")
                .tooltip("墨账")
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quick" => toggle_quick(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_quick(tray.app_handle());
                    }
                });

            match tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png")) {
                Ok(icon) => tray = tray.icon(icon),
                Err(_) => {
                    if let Some(icon) = app.default_window_icon() {
                        tray = tray.icon(icon.clone());
                    }
                }
            }
            tray.build(app)?;

            // ---------- quick 窗口浮在全屏应用之上 ----------
            #[cfg(target_os = "macos")]
            if let Some(win) = app.get_webview_window("quick") {
                macos_overlay::make_overlay(&win);
            }

            // ---------- 全局快捷键 ⌥⌘N ----------
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

                #[cfg(target_os = "macos")]
                let primary = Modifiers::ALT | Modifiers::SUPER;
                #[cfg(not(target_os = "macos"))]
                let primary = Modifiers::CONTROL | Modifiers::ALT;

                let candidates = [
                    Shortcut::new(Some(primary), Code::KeyN),
                    Shortcut::new(Some(Modifiers::ALT | Modifiers::SUPER), Code::Space),
                ];
                let mut registered = false;
                for sc in candidates {
                    if app.global_shortcut().register(sc).is_ok() {
                        registered = true;
                        break;
                    }
                }
                if !registered {
                    eprintln!("全局快捷键注册失败：请检查「系统设置 › 键盘 › 快捷键」冲突");
                }
            }

            // 启动时窗口刚创建，直接 show 在 macOS 上偶发失效，延迟一拍更稳
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(350));
                show_main(&handle);
            });
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    // 关窗不退出：留在菜单栏，Dock 点一下就能回来
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            WindowEvent::Focused(false) => {
                // INK_KEEP_QUICK=1 时不自动收起，方便调界面
                if window.label() == "quick" && std::env::var("INK_KEEP_QUICK").is_err() {
                    // 保存成功时前端会先 emit 再失焦，这里稍等一下避免刚弹出就收起
                    let handle = window.app_handle().clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(120));
                        if let Some(w) = handle.get_webview_window("quick") {
                            if !w.is_focused().unwrap_or(false) {
                                hide_quick(&handle);
                            }
                        }
                    });
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap,
            commands::get_overview,
            commands::get_flow,
            commands::get_stats,
            commands::get_budget,
            commands::get_accounts,
            commands::create_transaction,
            commands::update_transaction,
            commands::delete_transaction,
            commands::set_budget,
            commands::set_account_balance,
            commands::export_csv,
            commands::backup_now,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, _event| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = _event {
                show_main(app);
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = app;
            }
        });
}
