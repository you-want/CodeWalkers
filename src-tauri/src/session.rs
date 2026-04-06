use std::process::Command;
use std::sync::Mutex;
use std::io::{BufReader, Write, Read};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, State};
use portable_pty::{CommandBuilder, native_pty_system, PtySize};

// 状态管理，保存子进程的 stdin 句柄
pub struct SessionState {
    pub stdin_txs: Mutex<HashMap<String, Box<dyn Write + Send>>>,
}

fn get_shell_env() -> HashMap<String, String> {
    let mut env_map = HashMap::new();
    
    // 静默运行 zsh -l -i 抓取环境变量
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
    
    env_map
}

#[tauri::command]
pub fn start_session(app: AppHandle, state: State<'_, SessionState>, session_id: String, binary_path: String) -> Result<(), String> {
    println!("Starting session {} with: {}", session_id, binary_path);
    
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| format!("Failed to create PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&binary_path);
    
    // 注入系统真实环境变量 (如 PATH, HTTP_PROXY 等)
    let shell_envs = get_shell_env();
    for (k, v) in shell_envs {
        cmd.env(k, v);
    }
    
    // If it's gemini, try to inject the API key directly from settings.json if it exists
    if binary_path.contains("gemini") {
        cmd.args(["--yolo", "-o", "stream-json"]); // force JSON stream output for easy parsing
        if let Ok(settings_str) = std::fs::read_to_string(dirs::home_dir().unwrap().join(".gemini/settings.json")) {
            if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&settings_str) {
                if let Some(api_key) = settings.get("apiKey").and_then(|v| v.as_str()) {
                    cmd.env("GEMINI_API_KEY", api_key);
                }
            }
        }
    }

    // 主动注入全局代理环境变量，解决国内网络下 fetch failed 的问题
    // 通过读取 ~/.codewalkers.env 文件注入自定义环境变量
    if let Some(home) = dirs::home_dir() {
        let env_file = home.join(".codewalkers.env");
        if let Ok(env_content) = std::fs::read_to_string(env_file) {
            for line in env_content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    continue;
                }
                if let Some((k, v)) = trimmed.split_once('=') {
                    let key = k.trim();
                    let val = v.trim().trim_matches('"').trim_matches('\'');
                    cmd.env(key, val);
                }
            }
        }
    }

    let _child = pair.slave.spawn_command(cmd).map_err(|e| format!("Failed to spawn process: {}", e))?;
    
    let reader = pair.master.try_clone_reader().map_err(|e| format!("Failed to get reader: {}", e))?;
    let writer = pair.master.take_writer().map_err(|e| format!("Failed to get writer: {}", e))?;

    // 将 stdin 存入 state 以便后续发送数据
    state.stdin_txs.lock().unwrap().insert(session_id.clone(), writer);

    // 开启线程监听 stdout (PTY 合并了 stdout 和 stderr)
    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    std::thread::spawn(move || {
        let mut buf_reader = BufReader::new(reader);
        let mut buf = [0; 1024];
        loop {
            match buf_reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    // PTY 输出通常包含 ANSI 控制字符，前端需要用 xterm.js 或正则来解析处理
                    app_clone.emit(&format!("session_output_{}", session_id_clone), text).unwrap_or_default();
                }
                Err(e) => {
                    eprintln!("Error reading from PTY: {}", e);
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn send_message(state: State<'_, SessionState>, session_id: String, message: String) -> Result<(), String> {
    let mut stdin_guard = state.stdin_txs.lock().unwrap();
    if let Some(stdin) = stdin_guard.get_mut(&session_id) {
        let msg_with_newline = format!("{}\n", message);
        stdin.write_all(msg_with_newline.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        stdin.flush().map_err(|e| format!("Failed to flush stdin: {}", e))?;
        Ok(())
    } else {
        Err(format!("Session {} is not running", session_id))
    }
}
