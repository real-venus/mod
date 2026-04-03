use axum::{
    extract::{Path, State},
    http::{HeaderMap, Method, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;
use tracing::{error, info};

mod config;
mod proxy;
mod registry;
mod resources;

use config::Config;
use registry::WebsiteRegistry;
use resources::ResourceMonitor;

#[derive(Clone)]
struct AppState {
    registry: Arc<WebsiteRegistry>,
    monitor: Arc<ResourceMonitor>,
    config: Arc<Config>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "routy=info,tower_http=info".into()),
        )
        .init();

    let config = Arc::new(Config::load()?);
    let registry = Arc::new(WebsiteRegistry::new());
    let monitor = Arc::new(ResourceMonitor::new(config.clone()));

    // Start resource monitoring
    monitor.start_monitoring();

    let addr = format!("{}:{}", config.host, config.port);
    let max_websites = config.max_websites;
    let cpu_limit = config.cpu_limit_percent;

    let state = AppState {
        registry,
        monitor,
        config,
    };

    let app = Router::new()
        .route("/", get(root_handler))
        .route("/_api/register", post(register_website))
        .route("/_api/websites", get(list_websites))
        .route("/_api/stats", get(get_stats))
        .route("/:website/*path", get(proxy_handler))
        .fallback(fallback_handler)
        .with_state(state)
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(tower_http::cors::CorsLayer::permissive());

    info!("Starting Routy server on {}", addr);
    info!("Max websites: {}", max_websites);
    info!("CPU limit: {}%", cpu_limit);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn root_handler(State(state): State<AppState>) -> impl IntoResponse {
    let websites = state.registry.list().await;
    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <title>Routy - Multi-Website Router</title>
    <style>
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            line-height: 1.6;
        }}
        h1 {{ color: #333; }}
        .website {{
            background: #f5f5f5;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
        }}
        .website a {{
            color: #0066cc;
            text-decoration: none;
            font-weight: bold;
        }}
        .website a:hover {{ text-decoration: underline; }}
        .url {{ color: #666; font-size: 0.9em; }}
        .stats {{
            background: #e8f4f8;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
        }}
        code {{
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <h1>🚀 Routy - Multi-Website Router</h1>
    <p>Host multiple websites under one domain with URL-based routing.</p>

    <div class="stats">
        <strong>Active Websites:</strong> {} / {}<br>
        <strong>CPU Usage:</strong> {:.1}%
    </div>

    <h2>Registered Websites</h2>
    {}

    <h2>API Endpoints</h2>
    <ul>
        <li><code>POST /_api/register</code> - Register a new website</li>
        <li><code>GET /_api/websites</code> - List all websites</li>
        <li><code>GET /_api/stats</code> - Get system stats</li>
    </ul>

    <h2>Usage</h2>
    <p>Access websites at: <code>/{{website_name}}/{{path}}</code></p>
</body>
</html>"#,
        websites.len(),
        state.config.max_websites,
        state.monitor.get_cpu_usage().await,
        if websites.is_empty() {
            "<p>No websites registered yet.</p>".to_string()
        } else {
            websites
                .iter()
                .map(|w| {
                    format!(
                        r#"<div class="website">
                            <a href="/{}/"> {}</a><br>
                            <span class="url">→ {}</span>
                        </div>"#,
                        w.name, w.name, w.target_url
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        }
    );

    (StatusCode::OK, [("content-type", "text/html")], html)
}

async fn register_website(
    State(state): State<AppState>,
    Json(payload): Json<registry::RegisterRequest>,
) -> Result<impl IntoResponse, AppError> {
    // Check if we're at capacity
    let current_count = state.registry.list().await.len();
    if current_count >= state.config.max_websites {
        return Err(AppError::CapacityExceeded);
    }

    // Check CPU usage
    let cpu_usage = state.monitor.get_cpu_usage().await;
    if cpu_usage > state.config.cpu_limit_percent {
        return Err(AppError::CpuLimitExceeded);
    }

    state.registry.register(payload).await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Website registered successfully"
    })))
}

async fn list_websites(State(state): State<AppState>) -> impl IntoResponse {
    let websites = state.registry.list().await;
    Json(websites)
}

async fn get_stats(State(state): State<AppState>) -> impl IntoResponse {
    let cpu_usage = state.monitor.get_cpu_usage().await;
    let website_count = state.registry.list().await.len();

    Json(serde_json::json!({
        "cpu_usage_percent": cpu_usage,
        "website_count": website_count,
        "max_websites": state.config.max_websites,
        "cpu_limit_percent": state.config.cpu_limit_percent
    }))
}

async fn proxy_handler(
    State(state): State<AppState>,
    Path((website_name, path)): Path<(String, String)>,
    method: Method,
    headers: HeaderMap,
    uri: Uri,
    body: axum::body::Body,
) -> Result<Response, AppError> {
    // Check CPU before proxying
    let cpu_usage = state.monitor.get_cpu_usage().await;
    if cpu_usage > state.config.cpu_limit_percent {
        return Err(AppError::CpuLimitExceeded);
    }

    let website = state
        .registry
        .get(&website_name)
        .await
        .ok_or(AppError::WebsiteNotFound)?;

    proxy::proxy_request(website, &path, method, headers, uri, body).await
}

async fn fallback_handler(uri: Uri) -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        format!("Path not found: {}", uri.path()),
    )
}

#[derive(Debug)]
enum AppError {
    WebsiteNotFound,
    InvalidUrl,
    ProxyError(String),
    CapacityExceeded,
    CpuLimitExceeded,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::WebsiteNotFound => (StatusCode::NOT_FOUND, "Website not found"),
            AppError::InvalidUrl => (StatusCode::BAD_REQUEST, "Invalid URL"),
            AppError::ProxyError(msg) => {
                error!("Proxy error: {}", msg);
                (StatusCode::BAD_GATEWAY, "Error proxying request")
            }
            AppError::CapacityExceeded => (
                StatusCode::SERVICE_UNAVAILABLE,
                "Maximum website capacity reached",
            ),
            AppError::CpuLimitExceeded => (
                StatusCode::SERVICE_UNAVAILABLE,
                "CPU limit exceeded, try again later",
            ),
        };

        (status, message).into_response()
    }
}

impl From<registry::RegistryError> for AppError {
    fn from(err: registry::RegistryError) -> Self {
        match err {
            registry::RegistryError::InvalidUrl(_) => AppError::InvalidUrl,
            registry::RegistryError::AlreadyExists(_) => AppError::InvalidUrl,
        }
    }
}
