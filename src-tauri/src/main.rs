#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::panic;
use std::sync::Arc;

fn stop_environment(engine: &str) -> std::io::Result<()> {
    let docker_compose_dir = dev_env_lib::system::get_docker_compose_dir()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

    std::process::Command::new(if engine == "docker" {
        "docker-compose"
    } else {
        "nerdctl"
    })
    .args(&["down"])
    .current_dir(&docker_compose_dir)
    .status()?;

    Ok(())
}

fn main() {
    // Initialize app state with explicit String type
    let app_state: Arc<std::sync::Mutex<Option<String>>> = Arc::new(std::sync::Mutex::new(None));
    
    // Panic handler for clean shutdown
    let app_state_clone = Arc::clone(&app_state);
    panic::set_hook(Box::new(move |_| {
        if let Some(engine) = app_state_clone.lock().unwrap().as_ref() {
            let _ = stop_environment(engine);
        }
    }));

    // Signal handler for clean shutdown
    let app_state_clone = Arc::clone(&app_state);
    ctrlc::set_handler(move || {
        if let Some(engine) = app_state_clone.lock().unwrap().as_ref() {
            let _ = stop_environment(engine);
        }
        std::process::exit(0);
    })
    .expect("Error setting Ctrl-C handler");

    // SIGTERM handler (Unix only)
    #[cfg(unix)]
    {
        use signal_hook::{consts::SIGTERM, iterator::Signals};
        let app_state_clone = Arc::clone(&app_state);
        std::thread::spawn(move || {
            let mut signals = Signals::new(&[SIGTERM]).unwrap();
            for _ in signals.forever() {
                if let Some(engine) = app_state_clone.lock().unwrap().as_ref() {
                    let _ = stop_environment(engine);
                }
                std::process::exit(0);
            }
        });
    }

    // Run the Tauri application and block until it exits
    let app = dev_env_lib::run();
    app.run(|_app_handle, event| match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            api.prevent_exit();
        }
        _ => {}
    });
}
