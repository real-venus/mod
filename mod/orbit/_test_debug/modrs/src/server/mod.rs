//! HTTP server management — foreground + background (daemonized) modes

use crate::error::{ModError, Result};
use crate::module::Module;
use axum::{
    Router,
    Json,
    extract::{State, Path},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::task::JoinHandle;

#[derive(Debug, Clone, Serialize)]
pub struct ServerInfo {
    pub name: String,
    pub port: u16,
    pub pid: Option<u32>,
    pub url: String,
}

pub struct ServerManager {
    servers: HashMap<String, RunningServer>,
    pid_dir: PathBuf,
}

struct RunningServer {
    port: u16,
    handle: Option<JoinHandle<()>>,
    pid: Option<u32>,
}

impl ServerManager {
    pub fn new() -> Self  {
        let pid_dir = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join(".mod")
            .join("servers");
        std::fs::create_dir_all(&pid_dir).ok();

        Self {
            servers: HashMap::new(),
            pid_dir,
        }
    }

    /// Start a server in-process (foreground)
    pub async fn start(&mut self, name: &str, module: Arc<dyn Module>, port: u16) -> Result<()> {
        if self.servers.contains_key(name) {
            return Err(ModError::ServerAlreadyRunning(name.to_string()));
        }
        // Also check if a background process is already running
        if self.bg_is_running(name) {
            return Err(ModError::ServerAlreadyRunning(name.to_string()));
        }

        let handle = tokio::spawn(async move {
            if let Err(e) = run_server(module, port).await {
                eprintln!("Server error: {}", e);
            }
        });

        self.servers.insert(name.to_string(), RunningServer {
            port,
            handle: Some(handle),
            pid: None,
        });

        Ok(())
    }

    /// Start a server as a background OS process (daemonized)
    pub fn start_bg(&mut self, name: &str, port: u16) -> Result<()> {
        if self.servers.contains_key(name) || self.bg_is_running(name) {
            return Err(ModError::ServerAlreadyRunning(name.to_string()));
        }

        let exe = std::env::current_exe()
            .map_err(|e| ModError::Server(format!("Cannot find mrs binary: {}", e)))?;

        let child = std::process::Command::new(&exe)
            .args(["_serve-fg", name, "--port", &port.to_string()])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| ModError::Server(format!("Failed to spawn background server: {}", e)))?;

        let pid = child.id();
        self.write_pid(name, pid, port)?;

        Ok(())
    }

    pub async fn stop(&mut self, name: &str) -> Result<()> {
        // Try in-process first
        if let Some(server) = self.servers.remove(name) {
            if let Some(handle) = server.handle {
                handle.abort();
            }
            self.remove_pid(name);
            return Ok(());
        }

        // Try background process
        if let Some((pid, _port)) = self.read_pid(name) {
            #[cfg(unix)]
            {
                unsafe {
                    libc::kill(pid as i32, libc::SIGTERM);
                }
            }
            #[cfg(not(unix))]
            {
                // On non-unix, try taskkill
                std::process::Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/F"])
                    .output()
                    .ok();
            }
            self.remove_pid(name);
            return Ok(());
        }

        Err(ModError::ServerNotRunning(name.to_string()))
    }

    pub fn is_running(&self, name: &str) -> bool {
        self.servers.contains_key(name) || self.bg_is_running(name)
    }

    pub fn list(&self) -> Vec<ServerInfo> {
        let mut infos: Vec<ServerInfo> = self.servers
            .iter()
            .map(|(name, server)| ServerInfo {
                name: name.clone(),
                port: server.port,
                pid: server.pid,
                url: format!("http://0.0.0.0:{}", server.port),
            })
            .collect();

        // Add background servers from PID files
        if let Ok(entries) = std::fs::read_dir(&self.pid_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("pid") {
                    if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                        // Skip if already in in-process list
                        if self.servers.contains_key(name) {
                            continue;
                        }
                        if let Some((pid, port)) = self.read_pid(name) {
                            if Self::process_alive(pid) {
                                infos.push(ServerInfo {
                                    name: name.to_string(),
                                    port,
                                    pid: Some(pid),
                                    url: format!("http://0.0.0.0:{}", port),
                                });
                            } else {
                                // Stale PID file, clean up
                                self.remove_pid(name);
                            }
                        }
                    }
                }
            }
        }

        infos
    }

    // ── PID file helpers ────────────────────────────────────────────────

    fn pid_path(&self, name: &str) -> PathBuf {
        self.pid_dir.join(format!("{}.pid", name))
    }

    fn write_pid(&self, name: &str, pid: u32, port: u16) -> Result<()> {
        let content = format!("{}\n{}", pid, port);
        std::fs::write(self.pid_path(name), content)?;
        Ok(())
    }

    fn read_pid(&self, name: &str) -> Option<(u32, u16)> {
        let content = std::fs::read_to_string(self.pid_path(name)).ok()?;
        let mut lines = content.lines();
        let pid: u32 = lines.next()?.parse().ok()?;
        let port: u16 = lines.next()?.parse().ok()?;
        Some((pid, port))
    }

    fn remove_pid(&self, name: &str) {
        std::fs::remove_file(self.pid_path(name)).ok();
    }

    fn bg_is_running(&self, name: &str) -> bool {
        if let Some((pid, _)) = self.read_pid(name) {
            Self::process_alive(pid)
        } else {
            false
        }
    }

    fn process_alive(pid: u32) -> bool {
        #[cfg(unix)]
        {
            unsafe { libc::kill(pid as i32, 0) == 0 }
        }
        #[cfg(not(unix))]
        {
            // Fallback: assume alive if PID file exists
            true
        }
    }
}

// ── Axum server ─────────────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    module: Arc<dyn Module>,
}

pub async fn run_server(module: Arc<dyn Module>, port: u16) -> Result<()> {
    let state = AppState { module };

    let app = Router::new()
        .route("/:function", axum::routing::post(handle_call))
        .route("/info", axum::routing::get(handle_info))
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| ModError::Server(format!("Failed to bind to {}: {}", addr, e)))?;

    axum::serve(listener, app)
        .await
        .map_err(|e| ModError::Server(format!("Server error: {}", e)))?;

    Ok(())
}

#[derive(Deserialize)]
struct CallRequest {
    params: Option<Value>,
}

async fn handle_call(
    State(state): State<AppState>,
    Path(function): Path<String>,
    Json(req): Json<CallRequest>,
) -> impl IntoResponse {
    let params = req.params.unwrap_or(Value::Null);

    match state.module.call(&function, params).await {
        Ok(result) => (StatusCode::OK, Json(result)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn handle_info(State(state): State<AppState>) -> impl IntoResponse {
    match state.module.info().await {
        Ok(info) => (StatusCode::OK, Json(serde_json::to_value(&info).unwrap())).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}
