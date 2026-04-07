use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager, State};

// State management for holding child process stdin handles
pub struct SessionState {
    pub binary_paths: Mutex<HashMap<String, String>>,
    pub children: Mutex<HashMap<String, Child>>,
}

fn get_shell_env() -> HashMap<String, String> {
    let mut env_map = HashMap::new();
    
    #[cfg(unix)]
    {
        // Run zsh silently to grab actual environment variables
        let output = Command::new("zsh")
            .arg("-l")
            .arg("-i")
            .arg("-c")
            .arg("echo '---ENV_START---' && env && echo '---ENV_END---'")
            .output();
            
        if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut in_env_block = false;
            
            for line in stdout.lines() {
                if line == "---ENV_START---" {
                    in_env_block = true;
                    continue;
                }
                if line == "---ENV_END---" {
                    break;
                }
                if in_env_block {
                    if let Some((k, v)) = line.split_once('=') {
                        env_map.insert(k.to_string(), v.to_string());
                    }
                }
            }
        }
    }
    
    #[cfg(windows)]
    {
        for (k, v) in std::env::vars() {
            env_map.insert(k, v);
        }
    }
    
    env_map
}

#[tauri::command]
pub fn start_session(_app: AppHandle, state: State<'_, SessionState>, session_id: String, binary_path: String) -> Result<(), String> {
    println!("Starting session {} with: {}", session_id, binary_path);

    // If a session with the same id already exists, stop it first to avoid leaked child processes.
    if let Some(mut old_child) = state.children.lock().unwrap().remove(&session_id) {
        let _ = old_child.kill();
        let _ = old_child.wait();
    }
    
    state.binary_paths.lock().unwrap().insert(session_id.clone(), binary_path);
    
    Ok(())
}

#[tauri::command]
pub fn send_message(app: AppHandle, state: State<'_, SessionState>, session_id: String, message: String) -> Result<(), String> {
    let binary_path = {
        let paths = state.binary_paths.lock().unwrap();
        paths.get(&session_id).cloned()
    };
    
    let binary_path = binary_path.ok_or_else(|| format!("Session {} is not running", session_id))?;

    if let Some(mut old_child) = state.children.lock().unwrap().remove(&session_id) {
        let _ = old_child.kill();
        let _ = old_child.wait();
    }

    let mut cmd = Command::new(&binary_path);
    
    // Inject actual system environment variables
    let shell_envs = get_shell_env();
    for (k, v) in shell_envs {
        cmd.env(k, v);
    }
    
    // If it's gemini, try to inject the API key directly from settings.json if it exists
    if binary_path.contains("gemini") {
        cmd.args(["--yolo", "--resume", "latest", "-o", "stream-json", "-p", &message]);
        if let Ok(settings_str) = std::fs::read_to_string(dirs::home_dir().unwrap().join(".gemini/settings.json")) {
            if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&settings_str) {
                if let Some(api_key) = settings.get("apiKey").and_then(|v| v.as_str()) {
                    cmd.env("GEMINI_API_KEY", api_key);
                }
            }
        }
    } else {
        cmd.args(["-p", &message]);
    }

    // Attempt to load environment variables from .codewalkers.env
    // 1. Check current directory (e.g., when running compiled app)
    // 2. Check parent directory (e.g., when running via tauri dev from src-tauri)
    // 3. Fallback to user's HOME directory
    let current_dir = std::env::current_dir().unwrap_or_default();
    let env_file_local = current_dir.join(".codewalkers.env");
    let env_file_parent = current_dir.parent().unwrap_or(&current_dir).join(".codewalkers.env");
    
    let env_file = if env_file_local.exists() {
        env_file_local
    } else if env_file_parent.exists() {
        env_file_parent
    } else {
        std::path::PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(".codewalkers.env")
    };

    if let Ok(env_content) = std::fs::read_to_string(&env_file) {
        for line in env_content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') { continue; }
            if let Some((k, v)) = trimmed.split_once('=') {
                let key = k.trim();
                let value = v.trim().trim_matches('"').trim_matches('\'');
                cmd.env(key, value);
                
                // Copilot CLI compatibility: map GITHUB_TOKEN to required aliases
                if key == "GITHUB_TOKEN" {
                    cmd.env("COPILOT_GITHUB_TOKEN", value);
                    cmd.env("GH_TOKEN", value);
                }
            }
        }
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn process: {}", e))?;
    
    let mut stdout = child.stdout.take().ok_or_else(|| "Failed to get stdout".to_string())?;
    let mut stderr = child.stderr.take().ok_or_else(|| "Failed to get stderr".to_string())?;

    state.children.lock().unwrap().insert(session_id.clone(), child);

    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    
    // Start a thread to listen for stdout
    std::thread::spawn(move || {
        use std::io::Read;
        let mut buffer = [0u8; 1024];
        loop {
            match stdout.read(&mut buffer) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buffer[..n]).to_string();
                    app_clone.emit(&format!("session_output_{}", session_id_clone), chunk).unwrap_or_default();
                }
                Err(e) => {
                    eprintln!("Error reading stdout: {}", e);
                    break;
                }
            }
        }

        // Clean up child process
        let session_state = app_clone.state::<SessionState>();
        if let Some(mut child) = session_state.children.lock().unwrap().remove(&session_id_clone) {
            let _ = child.wait();
        }
        app_clone.emit(&format!("session_ended_{}", session_id_clone), "").unwrap_or_default();
    });

    let app_clone_err = app.clone();
    let session_id_clone_err = session_id.clone();
    
    // Start a thread to listen for stderr
    std::thread::spawn(move || {
        use std::io::Read;
        let mut buffer = [0u8; 1024];
        loop {
            match stderr.read(&mut buffer) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buffer[..n]).to_string();
                    app_clone_err.emit(&format!("session_stderr_{}", session_id_clone_err), chunk).unwrap_or_default();
                }
                Err(e) => {
                    eprintln!("Error reading stderr: {}", e);
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_session(state: State<'_, SessionState>, session_id: String) -> Result<(), String> {
    state.binary_paths.lock().unwrap().remove(&session_id);
    if let Some(mut child) = state.children.lock().unwrap().remove(&session_id) {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}
