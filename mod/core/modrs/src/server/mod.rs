//! HTTP server management

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
use std::sync::Arc;
use tokio::task::JoinHandle;

#[derive(Debug, Clone, Serialize)]
pub struct ServerInfo {
    pub name: String,
    pub port: u16,
    pub url: String,
}

pub struct ServerManager {
    servers: HashMap<String, RunningServer>,
}

struct RunningServer {
    port: u16,
    handle: JoinHandle<()>,
}

impl ServerManager {
    pub fn new() -> Self  {
        Self {
            servers: HashMap::new(),
        }
    }

    pub async fn start(&mut self, name: &str, module: Arc<dyn Module>, port: u16) -> Result<()> {
        if self.servers.contains_key(name) {
            return Err(ModError::ServerAlreadyRunning(name.to_string()));
        }

        let handle = tokio::spawn(async move {
            if let Err(e) = run_server(module, port).await {
                eprintln!("Server error: {}", e);
            }
        });

        self.servers.insert(name.to_string(), RunningServer { port, handle });

        Ok(())
    }

    pub async fn stop(&mut self, name: &str) -> Result<()> {
        let server = self.servers.remove(name)
            .ok_or_else(|| ModError::ServerNotRunning(name.to_string()))?;

        server.handle.abort();

        Ok(())
    }

    pub fn is_running(&self, name: &str) -> bool {
        self.servers.contains_key(name)
    }

    pub fn list(&self) -> Vec<ServerInfo> {
        self.servers
            .iter()
            .map(|(name, server)| ServerInfo {
                name: name.clone(),
                port: server.port,
                url: format!("http://0.0.0.0:{}", server.port),
            })
            .collect()
    }
}

#[derive(Clone)]
struct AppState {
    module: Arc<dyn Module>,
}

async fn run_server(module: Arc<dyn Module>, port: u16) -> Result<()> {
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
