use std::env;
use std::path::PathBuf;
use std::sync::OnceLock;

/// 枚举支持的提供商
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ProviderStatus {
    pub name: String,
    pub binary: String,
    pub is_installed: bool,
    pub path: Option<String>,
}

fn get_shell_env_path() -> Option<String> {
    static SHELL_PATH: OnceLock<Option<String>> = OnceLock::new();
    SHELL_PATH.get_or_init(|| {
        let output = std::process::Command::new("zsh")
            .arg("-l")
            .arg("-i")
            .arg("-c")
            .arg("echo '---ENV_START---' && env && echo '---ENV_END---'")
            .output()
            .ok()?;
            
        let stdout = String::from_utf8_lossy(&output.stdout);
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
                    if k == "PATH" {
                        return Some(v.to_string());
                    }
                }
            }
        }
        None
    }).clone()
}

/// 探测指定二进制文件在系统 PATH 中是否存在
fn find_binary(binary_name: &str) -> Option<PathBuf> {
    // 首先使用系统真实的环境变量（防止 GUI 启动丢失 PATH）
    let path_var = get_shell_env_path().unwrap_or_else(|| env::var("PATH").unwrap_or_default());
    
    for dir in path_var.split(':') {
        let p = PathBuf::from(dir).join(binary_name);
        if p.exists() && p.is_file() {
            return Some(p);
        }
    }
    
    // 一些常见的兜底路径
    let home = dirs::home_dir().unwrap_or_default();
    let fallback_paths = vec![
        home.join(".npm-global/bin").join(binary_name),
        home.join(".local/bin").join(binary_name),
        home.join(".claude/local/bin").join(binary_name),
        PathBuf::from("/usr/local/bin").join(binary_name),
        PathBuf::from("/opt/homebrew/bin").join(binary_name),
    ];

    for p in fallback_paths {
        if p.exists() && p.is_file() {
            return Some(p);
        }
    }

    None
}

#[tauri::command]
pub async fn check_providers() -> Vec<ProviderStatus> {
    let providers = vec![
        ("Claude", "claude"),
        ("Codex", "codex"),
        ("Copilot", "copilot"),
        ("Gemini", "gemini"),
        ("OpenCode", "opencode"),
    ];

    // Since we are async, we can spawn a blocking task if find_binary is heavy,
    // but running it in the async context (Tauri's thread pool) is already off the main thread.
    providers.into_iter().map(|(name, binary)| {
        let path = find_binary(binary);
        ProviderStatus {
            name: name.to_string(),
            binary: binary.to_string(),
            is_installed: path.is_some(),
            path: path.map(|p| p.to_string_lossy().to_string()),
        }
    }).collect()
}

#[tauri::command]
pub async fn install_provider(binary: String) -> Result<String, String> {
    let cmd = match binary.as_str() {
        "claude" => "curl -fsSL https://claude.ai/install.sh | sh",
        "codex" => "sudo npm install -g @openai/codex",
        "copilot" => "sudo npm install -g @github/copilot",
        "gemini" => "sudo npm install -g @google/gemini-cli",
        "opencode" => "sudo npm install -g opencode-ai",
        _ => return Err(format!("Unknown provider binary: {}", binary)),
    };

    // 使用 AppleScript 打开一个新的 macOS 终端窗口并执行命令
    // 这样用户就可以看到安装进度，并且可以输入 sudo 密码或进行交互
    let script = format!(
        r#"tell application "Terminal"
    activate
    do script "{}"
end tell"#,
        cmd
    );

    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                Ok("Installation opened in Terminal! Please complete it there.".to_string())
            } else {
                Err(String::from_utf8_lossy(&out.stderr).to_string())
            }
        }
        Err(e) => Err(e.to_string()),
    }
}
