//! HTTP API for Claude Jobs — Axum endpoints + SSE streaming + MetaMask auth

use crate::auth;
use crate::jobs::{ClaudeJobManager, SubmitRequest};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    middleware,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use std::convert::Infallible;
use std::sync::Arc;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use tower_http::cors::{Any, CorsLayer};

type AppState = Arc<ClaudeJobManager>;

pub async fn serve(manager: AppState, port: u16) {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let local_mode = std::env::var("CLAUDE_JOBS_LOCAL").unwrap_or_default() == "1";

    let challenge_store = auth::new_challenge_store();

    // Job routes — skip auth in local mode
    let job_routes = {
        let base = Router::new()
            .route("/jobs", post(submit_job))
            .route("/jobs", get(list_jobs))
            .route("/jobs/:id", get(get_job))
            .route("/jobs/:id", delete(delete_job))
            .route("/jobs/:id/cancel", post(cancel_job))
            .route("/jobs/:id/stream", get(stream_job))
            .route("/modules/:name", delete(delete_module))
            .route("/modules/:name/rename", put(rename_module))
            .route("/files/write", post(file_write));

        if local_mode {
            println!("⚡ Local mode — auth disabled");
            base.with_state(manager)
        } else {
            base.layer(middleware::from_fn(auth::auth_middleware))
                .with_state(manager)
        }
    };

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(health))
        .route("/config", get(get_config))
        .route("/repos", get(list_repos))
        .route("/modules", get(list_modules))
        .route("/modules/:name/config", get(get_module_config))
        .route("/files/tree", get(file_tree))
        .route("/files/content", get(file_content))
        .route("/files/raw", get(file_raw))
        .route("/files/search", get(file_search))
        .route("/files/grep", get(file_grep))
        .route("/changelog", get(get_changelog))
        .route("/versions/:version", get(get_version))
        .route("/owner", get(get_owner))
        .route("/auth/role", get(get_role))
        .route(
            "/auth/challenge",
            get(auth::challenge).with_state(challenge_store.clone()),
        )
        .route(
            "/auth/verify",
            post(auth::verify).with_state(challenge_store),
        );

    let app = Router::new()
        .merge(job_routes)
        .merge(public_routes)
        .layer(cors);

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind");

    println!("Listening on http://{}", addr);
    axum::serve(listener, app).await.expect("Server error");
}

async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok", "service": "claude-jobs" }))
}

async fn get_config() -> impl IntoResponse {
    // Walk up from the binary's location to find config.json in the module root
    let config_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .and_then(|d| {
            // Binary is in server/target/release/ — walk up to module root
            let mut dir = d.as_path();
            for _ in 0..5 {
                let candidate = dir.join("config.json");
                if candidate.exists() {
                    return Some(candidate);
                }
                dir = dir.parent()?;
            }
            None
        });

    // Fallback: check known module path
    let config_path = config_path.unwrap_or_else(|| {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        std::path::PathBuf::from(format!("{}/mod/mod/orbit/claude/config.json", home))
    });

    if !config_path.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "config.json not found" })),
        )
            .into_response();
    }

    match std::fs::read_to_string(&config_path) {
        Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
            Ok(config) => (StatusCode::OK, Json(config)).into_response(),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Invalid JSON: {}", e) })),
            )
                .into_response(),
        },
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to read config: {}", e) })),
        )
            .into_response(),
    }
}

async fn get_owner() -> impl IntoResponse {
    // Priority 1: Check config.json "owner" field (live-editable)
    if let Some(owner) = read_config_owner() {
        return Json(json!({
            "has_owner": true,
            "owner": owner,
            "message": "Owner set via config.json"
        }));
    }

    // Priority 2: Fall back to owner.json
    let owner_path = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".mod")
        .join("claude")
        .join("owner.json");

    if !owner_path.exists() {
        return Json(json!({
            "has_owner": false,
            "owner": null,
            "message": "No owner set - first authenticated user will become owner"
        }));
    }

    match std::fs::read_to_string(&owner_path) {
        Ok(content) => {
            match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(data) => {
                    let owner = data.get("owner").and_then(|v| v.as_str());
                    Json(json!({
                        "has_owner": owner.is_some(),
                        "owner": owner,
                        "message": if owner.is_some() {
                            "Owner is set"
                        } else {
                            "Owner file exists but is invalid"
                        }
                    }))
                }
                Err(_) => Json(json!({
                    "has_owner": false,
                    "owner": null,
                    "message": "Owner file is corrupted"
                }))
            }
        }
        Err(_) => Json(json!({
            "has_owner": false,
            "owner": null,
            "message": "Failed to read owner file"
        }))
    }
}

/// Read the "owner" field from config.json (re-read each call so live edits take effect)
fn read_config_owner() -> Option<String> {
    let config_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .and_then(|d| {
            let mut dir = d.as_path();
            for _ in 0..5 {
                let candidate = dir.join("config.json");
                if candidate.exists() {
                    return Some(candidate);
                }
                dir = dir.parent()?;
            }
            None
        })
        .unwrap_or_else(|| {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            std::path::PathBuf::from(format!("{}/mod/mod/orbit/claude/config.json", home))
        });

    let content = std::fs::read_to_string(&config_path).ok()?;
    let data: serde_json::Value = serde_json::from_str(&content).ok()?;
    let owner = data.get("owner").and_then(|v| v.as_str())?.to_lowercase();
    if owner.is_empty() { None } else { Some(owner) }
}

/// Returns the role for the given address: "owner" or "user"
async fn get_role(Query(params): Query<RoleQuery>) -> impl IntoResponse {
    let address = params.address.to_lowercase();
    let is_owner = auth::is_owner(&address);
    Json(json!({
        "address": address,
        "role": if is_owner { "owner" } else { "user" },
        "is_owner": is_owner,
    }))
}

#[derive(Deserialize)]
struct RoleQuery {
    address: String,
}

async fn submit_job(
    headers: axum::http::HeaderMap,
    State(mgr): State<AppState>,
    Json(req): Json<SubmitRequest>,
) -> impl IntoResponse {
    // Extract user address from auth token
    let auth_header = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let user_address = match auth::extract_address_from_header(auth_header) {
        Ok(addr) => addr,
        Err(_) => {
            // In local mode, skip permission check
            if std::env::var("CLAUDE_JOBS_LOCAL").unwrap_or_default() == "1" {
                String::new()
            } else {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({ "error": "Could not extract address from token" })),
                )
                    .into_response();
            }
        }
    };

    // Permission check: owner can edit anything, non-owners can only edit _outer/{their_address}/ modules
    if !user_address.is_empty() && !auth::is_owner(&user_address) {
        // Check work_dir — non-owners must work within _outer/{their_address}/
        if let Some(ref work_dir) = req.work_dir {
            let normalized = work_dir.to_lowercase();
            let user_outer = format!("_outer/{}", user_address.to_lowercase());
            if !normalized.contains(&user_outer) {
                return (
                    StatusCode::FORBIDDEN,
                    Json(json!({
                        "error": format!(
                            "Permission denied: non-owners can only edit modules in _outer/{}/",
                            user_address
                        )
                    })),
                )
                    .into_response();
            }
        }

        // Check module_name — non-owners must target _outer/{their_address}/ modules
        if let Some(ref module_name) = req.module_name {
            let normalized = module_name.to_lowercase();
            let user_prefix = format!("_outer/{}", user_address.to_lowercase());
            if !normalized.starts_with(&user_prefix) && !normalized.starts_with("_outer/") {
                return (
                    StatusCode::FORBIDDEN,
                    Json(json!({
                        "error": format!(
                            "Permission denied: non-owners can only create/edit modules under _outer/{}/",
                            user_address
                        )
                    })),
                )
                    .into_response();
            }
            // If it starts with _outer/ but not their address, also block
            if normalized.starts_with("_outer/") && !normalized.starts_with(&user_prefix) {
                return (
                    StatusCode::FORBIDDEN,
                    Json(json!({
                        "error": "Permission denied: you can only edit your own modules in _outer/"
                    })),
                )
                    .into_response();
            }
        }
    }

    // Inject the authenticated user address into the request
    let mut req = req;
    req.user_address = Some(user_address);

    let job = mgr.submit(req).await;
    (StatusCode::CREATED, Json(json!(job))).into_response()
}

async fn list_jobs(State(mgr): State<AppState>) -> impl IntoResponse {
    let jobs = mgr.list_jobs();
    Json(json!({ "jobs": jobs, "count": jobs.len() }))
}

async fn get_job(
    State(mgr): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match mgr.get_job(&id) {
        Some(job) => (StatusCode::OK, Json(json!(job))).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Job not found" })),
        )
            .into_response(),
    }
}

async fn delete_job(
    headers: axum::http::HeaderMap,
    State(mgr): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    // Check that user owns this job or is the system owner
    if let Some(job) = mgr.get_job(&id) {
        let auth_header = headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if let Ok(user_addr) = auth::extract_address_from_header(auth_header) {
            if !auth::is_owner(&user_addr)
                && !job.user_address.is_empty()
                && job.user_address.to_lowercase() != user_addr.to_lowercase()
            {
                return (
                    StatusCode::FORBIDDEN,
                    Json(json!({ "error": "You can only delete your own jobs" })),
                )
                    .into_response();
            }
        }
    }

    mgr.delete_job(&id);
    Json(json!({ "success": true })).into_response()
}

async fn cancel_job(
    headers: axum::http::HeaderMap,
    State(mgr): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    // Check that user owns this job or is the system owner
    if let Some(job) = mgr.get_job(&id) {
        let auth_header = headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if let Ok(user_addr) = auth::extract_address_from_header(auth_header) {
            if !auth::is_owner(&user_addr)
                && !job.user_address.is_empty()
                && job.user_address.to_lowercase() != user_addr.to_lowercase()
            {
                return (
                    StatusCode::FORBIDDEN,
                    Json(json!({ "error": "You can only cancel your own jobs" })),
                )
                    .into_response();
            }
        }
    }

    match mgr.cancel_job(&id).await {
        Ok(()) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Err(e) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": e })),
        )
            .into_response(),
    }
}

#[derive(Deserialize)]
struct RepoQuery {
    q: Option<String>,
}

#[derive(Deserialize)]
struct ModuleQuery {
    q: Option<String>,
    anchor: Option<String>,
}

#[derive(Deserialize)]
struct TreeQuery {
    path: Option<String>,
    depth: Option<usize>,
}

async fn file_tree(Query(params): Query<TreeQuery>) -> impl IntoResponse {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let raw_path = params.path.unwrap_or_else(|| "~/mod".to_string());
    let resolved = raw_path.replacen("~", &home, 1);
    let max_depth = params.depth.unwrap_or(3);

    let root = std::path::Path::new(&resolved);
    if !root.is_dir() {
        return Json(json!({ "tree": [], "error": "Directory not found" }));
    }

    fn walk(dir: &std::path::Path, depth: usize, max_depth: usize, home: &str) -> Vec<serde_json::Value> {
        if depth >= max_depth {
            return vec![];
        }
        let mut entries: Vec<serde_json::Value> = Vec::new();
        let Ok(rd) = std::fs::read_dir(dir) else { return vec![] };
        let mut items: Vec<_> = rd.flatten().collect();
        items.sort_by(|a, b| {
            let a_is_dir = a.path().is_dir();
            let b_is_dir = b.path().is_dir();
            b_is_dir.cmp(&a_is_dir).then_with(|| {
                a.file_name().to_string_lossy().to_lowercase().cmp(
                    &b.file_name().to_string_lossy().to_lowercase(),
                )
            })
        });
        for entry in items {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') { continue; }
            if name == "node_modules" || name == "__pycache__" || name == "target" || name == ".git" { continue; }
            let full = path.to_string_lossy().to_string();
            let display = full.replacen(home, "~", 1);
            let is_dir = path.is_dir();
            let children = if is_dir { walk(&path, depth + 1, max_depth, home) } else { vec![] };
            entries.push(json!({
                "name": name,
                "path": display,
                "type": if is_dir { "directory" } else { "file" },
                "children": children,
            }));
        }
        entries
    }

    let tree = walk(root, 0, max_depth, &home);
    Json(json!({ "tree": tree, "path": raw_path }))
}

async fn list_repos(Query(params): Query<RepoQuery>) -> impl IntoResponse {
    let query = params.q.unwrap_or_default().to_lowercase();
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());

    // Directories to scan for git repos (check for .git)
    let git_scan_dirs = vec![
        home.clone(),
        format!("{}/mod", home),
    ];

    // Directories to list as project folders (subfolders of a git repo)
    let project_scan_dirs = vec![
        format!("{}/mod/mod/orbit", home),
        format!("{}/mod/mod/core", home),
    ];

    let mut repos: Vec<serde_json::Value> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // Scan for git repos
    for scan_dir in &git_scan_dirs {
        let dir_path = std::path::Path::new(scan_dir);
        if !dir_path.is_dir() { continue; }
        if let Ok(entries) = std::fs::read_dir(dir_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() { continue; }
                let git_dir = path.join(".git");
                if !git_dir.exists() { continue; }
                let full_path = path.to_string_lossy().to_string();
                if seen.contains(&full_path) { continue; }
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let display_path = full_path.replacen(&home, "~", 1);
                if !query.is_empty()
                    && !name.to_lowercase().contains(&query)
                    && !display_path.to_lowercase().contains(&query)
                { continue; }
                seen.insert(full_path.clone());
                repos.push(json!({ "name": name, "path": full_path, "display": display_path }));
            }
        }
    }

    // Scan project folders (modules/components within a repo)
    for scan_dir in &project_scan_dirs {
        let dir_path = std::path::Path::new(scan_dir);
        if !dir_path.is_dir() { continue; }
        if let Ok(entries) = std::fs::read_dir(dir_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() { continue; }
                // Skip hidden dirs and __pycache__
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if name.starts_with('.') || name.starts_with('_') { continue; }
                let full_path = path.to_string_lossy().to_string();
                if seen.contains(&full_path) { continue; }
                let display_path = full_path.replacen(&home, "~", 1);
                if !query.is_empty()
                    && !name.to_lowercase().contains(&query)
                    && !display_path.to_lowercase().contains(&query)
                { continue; }
                seen.insert(full_path.clone());
                repos.push(json!({ "name": name, "path": full_path, "display": display_path }));
            }
        }
    }

    // Sort by name
    repos.sort_by(|a, b| {
        let a_name = a["name"].as_str().unwrap_or("");
        let b_name = b["name"].as_str().unwrap_or("");
        a_name.cmp(b_name)
    });

    Json(json!({ "repos": repos }))
}

/// List orbit and core modules with config.json data (app_url, api_url, etc.)
async fn list_modules(Query(params): Query<ModuleQuery>) -> impl IntoResponse {
    let query = params.q.unwrap_or_default().to_lowercase();
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let anchor = params.anchor.unwrap_or_else(|| format!("{}/mod", home));
    // Expand ~ to home
    let anchor = anchor.replacen("~", &home, 1);

    let mut modules: Vec<serde_json::Value> = Vec::new();

    // Scan both orbit/ and core/ directories
    let scan_dirs = vec![
        (format!("{}/mod/orbit", anchor), "orbit"),
        (format!("{}/mod/core", anchor), "core"),
    ];

    for (scan_dir, category) in &scan_dirs {
        let dir_path = std::path::Path::new(scan_dir);
        if !dir_path.is_dir() { continue; }
        if let Ok(entries) = std::fs::read_dir(dir_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() { continue; }
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if name.starts_with('.') || name.starts_with('_') { continue; }

                // Filter by query (search name only, ignoring category prefix)
                if !query.is_empty() && !name.to_lowercase().contains(&query) {
                    continue;
                }

                let full_path = path.to_string_lossy().to_string();
                let display_path = full_path.replacen(&home, "~", 1);

                // Try to read config.json from multiple locations
                let mut app_url: Option<String> = None;
                let mut api_url: Option<String> = None;
                let mut description: Option<String> = None;
                let mut has_config = false;
                let mut fns: Vec<String> = Vec::new();
                let mut owner: Option<String> = None;
                let mut version: Option<String> = None;
                let mut cid: Option<String> = None;

                let config_paths = vec![
                    path.join("config.json"),
                    path.join(&name).join("config.json"),
                ];

                for config_path in &config_paths {
                    if config_path.exists() {
                        if let Ok(content) = std::fs::read_to_string(config_path) {
                            if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
                                has_config = true;
                                // Check for urls.app and urls.api
                                if let Some(urls) = config.get("urls") {
                                    if let Some(v) = urls.get("app").and_then(|v| v.as_str()) {
                                        app_url = Some(v.to_string());
                                    }
                                    if let Some(v) = urls.get("api").and_then(|v| v.as_str()) {
                                        api_url = Some(v.to_string());
                                    }
                                }
                                // Also check top-level app_url / api_url
                                if app_url.is_none() {
                                    if let Some(v) = config.get("app_url").and_then(|v| v.as_str()) {
                                        app_url = Some(v.to_string());
                                    }
                                }
                                if api_url.is_none() {
                                    if let Some(v) = config.get("api_url").and_then(|v| v.as_str()) {
                                        api_url = Some(v.to_string());
                                    }
                                }
                                if let Some(v) = config.get("description").and_then(|v| v.as_str()) {
                                    description = Some(v.to_string());
                                }
                                if let Some(arr) = config.get("fns").and_then(|v| v.as_array()) {
                                    fns = arr.iter().filter_map(|v| v.as_str().map(String::from)).collect();
                                }
                                if let Some(v) = config.get("owner").and_then(|v| v.as_str()) {
                                    owner = Some(v.to_string());
                                }
                                if let Some(v) = config.get("version").and_then(|v| v.as_str()) {
                                    version = Some(v.to_string());
                                }
                                if let Some(v) = config.get("cid").and_then(|v| v.as_str()) {
                                    cid = Some(v.to_string());
                                }
                                break; // Use first found config
                            }
                        }
                    }
                }

                // Check for app/ directory as hint for frontend
                let has_app_dir = path.join("app").is_dir();
                // Check for server/ directory as hint for backend
                let has_server_dir = path.join("server").is_dir();
                // Check for api/ directory
                let has_api_dir = path.join("api").is_dir();

                // Get directory creation time
                let created_at: Option<u64> = std::fs::metadata(&path)
                    .ok()
                    .and_then(|m| m.created().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs());

                modules.push(json!({
                    "name": name,
                    "path": full_path,
                    "display": display_path,
                    "category": category,
                    "has_config": has_config,
                    "app_url": app_url,
                    "api_url": api_url,
                    "description": description,
                    "fns": fns,
                    "has_app_dir": has_app_dir,
                    "has_server_dir": has_server_dir,
                    "has_api_dir": has_api_dir,
                    "owner": owner,
                    "version": version,
                    "cid": cid,
                    "created_at": created_at,
                }));
            }
        }
    }

    // Sort by name
    modules.sort_by(|a, b| {
        let a_name = a["name"].as_str().unwrap_or("");
        let b_name = b["name"].as_str().unwrap_or("");
        a_name.cmp(b_name)
    });

    Json(json!({ "modules": modules, "count": modules.len(), "anchor": anchor.replacen(&home, "~", 1) }))
}

/// Return raw config.json for a specific module
async fn get_module_config(
    Path(name): Path<String>,
    Query(params): Query<ModuleQuery>,
) -> impl IntoResponse {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let anchor = params
        .anchor
        .unwrap_or_else(|| format!("{}/mod", home))
        .replacen("~", &home, 1);

    // Search orbit/ and core/ for the module
    let search_dirs = vec![
        format!("{}/mod/orbit/{}", anchor, name),
        format!("{}/mod/core/{}", anchor, name),
    ];

    for module_dir in &search_dirs {
        let base = std::path::Path::new(module_dir);
        if !base.is_dir() {
            continue;
        }
        // Try config.json at root level and nested (module_name/config.json)
        let config_paths = vec![
            base.join("config.json"),
            base.join(&name).join("config.json"),
        ];
        for config_path in &config_paths {
            if config_path.exists() {
                if let Ok(content) = std::fs::read_to_string(config_path) {
                    if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
                        return (
                            StatusCode::OK,
                            Json(json!({
                                "name": name,
                                "path": config_path.to_string_lossy(),
                                "config": config,
                            })),
                        )
                            .into_response();
                    }
                }
            }
        }
    }

    (
        StatusCode::NOT_FOUND,
        Json(json!({ "error": format!("No config.json found for module '{}'", name) })),
    )
        .into_response()
}

/// Delete a module directory (only module owner or system owner can delete)
async fn delete_module(
    headers: axum::http::HeaderMap,
    State(_mgr): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    // Extract user address from auth token
    let auth_header = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let user_addr = match auth::extract_address_from_header(auth_header) {
        Ok(addr) => addr,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Authentication required" })),
            )
                .into_response();
        }
    };

    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());

    // Search orbit/ and core/ for the module
    let search_dirs = vec![
        format!("{}/mod/mod/orbit/{}", home, name),
        format!("{}/mod/mod/core/{}", home, name),
    ];

    let mut found_path: Option<String> = None;
    let mut module_owner: Option<String> = None;

    for module_dir in &search_dirs {
        let base = std::path::Path::new(module_dir);
        if !base.is_dir() {
            continue;
        }
        found_path = Some(module_dir.clone());

        // Read owner from config.json
        let config_paths = vec![
            base.join("config.json"),
            base.join(&name).join("config.json"),
        ];
        for config_path in &config_paths {
            if config_path.exists() {
                if let Ok(content) = std::fs::read_to_string(config_path) {
                    if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(v) = config.get("owner").and_then(|v| v.as_str()) {
                            module_owner = Some(v.to_lowercase());
                        }
                    }
                }
            }
        }
        break;
    }

    let module_path = match found_path {
        Some(p) => p,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("Module '{}' not found", name) })),
            )
                .into_response();
        }
    };

    // Authorization: must be system owner, module owner, or module has no owner
    let is_sys_owner = auth::is_owner(&user_addr);
    let is_mod_owner = module_owner
        .as_ref()
        .map(|o| o == &user_addr.to_lowercase())
        .unwrap_or(false);
    let is_unowned = module_owner.is_none();

    if !is_sys_owner && !is_mod_owner && !is_unowned {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "You can only delete modules you own" })),
        )
            .into_response();
    }

    // Delete the module directory
    match std::fs::remove_dir_all(&module_path) {
        Ok(_) => Json(json!({ "success": true, "deleted": name })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to delete module: {}", e) })),
        )
            .into_response(),
    }
}

#[derive(Deserialize)]
struct RenameRequest {
    new_name: String,
}

/// Rename a module directory (only module owner or system owner can rename)
async fn rename_module(
    headers: axum::http::HeaderMap,
    State(_mgr): State<AppState>,
    Path(name): Path<String>,
    Json(body): Json<RenameRequest>,
) -> impl IntoResponse {
    let new_name = body.new_name.trim().to_string();
    if new_name.is_empty() || new_name.contains('/') || new_name.contains('\\') || new_name.starts_with('.') {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid module name" })),
        )
            .into_response();
    }

    // Extract user address from auth token
    let auth_header = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let user_addr = match auth::extract_address_from_header(auth_header) {
        Ok(addr) => addr,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Authentication required" })),
            )
                .into_response();
        }
    };

    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());

    // Search orbit/ and core/ for the module
    let search_dirs = vec![
        ("orbit", format!("{}/mod/mod/orbit/{}", home, name)),
        ("core", format!("{}/mod/mod/core/{}", home, name)),
    ];

    let mut found_path: Option<String> = None;
    let mut found_category: Option<String> = None;
    let mut module_owner: Option<String> = None;

    for (category, module_dir) in &search_dirs {
        let base = std::path::Path::new(module_dir);
        if !base.is_dir() {
            continue;
        }
        found_path = Some(module_dir.clone());
        found_category = Some(category.to_string());

        // Read owner from config.json
        let config_paths = vec![
            base.join("config.json"),
            base.join(&name).join("config.json"),
        ];
        for config_path in &config_paths {
            if config_path.exists() {
                if let Ok(content) = std::fs::read_to_string(config_path) {
                    if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(v) = config.get("owner").and_then(|v| v.as_str()) {
                            module_owner = Some(v.to_lowercase());
                        }
                    }
                }
            }
        }
        break;
    }

    let module_path = match found_path {
        Some(p) => p,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("Module '{}' not found", name) })),
            )
                .into_response();
        }
    };

    // Authorization: must be system owner or module owner
    let is_sys_owner = auth::is_owner(&user_addr);
    let is_mod_owner = module_owner
        .as_ref()
        .map(|o| o == &user_addr.to_lowercase())
        .unwrap_or(false);

    if !is_sys_owner && !is_mod_owner {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "You can only rename modules you own" })),
        )
            .into_response();
    }

    // Build new path in the same category directory
    let category = found_category.unwrap_or_else(|| "orbit".to_string());
    let new_path = format!("{}/mod/mod/{}/{}", home, category, new_name);

    // Check that the target doesn't already exist
    if std::path::Path::new(&new_path).exists() {
        return (
            StatusCode::CONFLICT,
            Json(json!({ "error": format!("Module '{}' already exists", new_name) })),
        )
            .into_response();
    }

    // Rename (move) the directory
    match std::fs::rename(&module_path, &new_path) {
        Ok(_) => {
            // Update config.json name field if it exists
            let config_path = std::path::Path::new(&new_path).join("config.json");
            if config_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&config_path) {
                    if let Ok(mut config) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(obj) = config.as_object_mut() {
                            obj.insert("name".to_string(), serde_json::Value::String(new_name.clone()));
                            if let Ok(updated) = serde_json::to_string_pretty(&config) {
                                let _ = std::fs::write(&config_path, updated);
                            }
                        }
                    }
                }
            }
            Json(json!({ "success": true, "old_name": name, "new_name": new_name })).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to rename module: {}", e) })),
        )
            .into_response(),
    }
}

async fn stream_job(
    State(mgr): State<AppState>,
    Path(id): Path<String>,
) -> Result<Sse<std::pin::Pin<Box<dyn tokio_stream::Stream<Item = Result<Event, Infallible>> + Send>>>, (StatusCode, &'static str)> {
    let job = mgr.get_job(&id);
    if job.is_none() {
        return Err((StatusCode::NOT_FOUND, "Job not found"));
    }

    match mgr.subscribe(&id).await {
        Some(rx) => {
            // Send any already-accumulated output first so late subscribers don't miss it
            let existing = job.as_ref().map(|j| j.output.clone()).unwrap_or_default();
            let initial = if !existing.is_empty() {
                vec![Ok::<_, Infallible>(Event::default().data(existing))]
            } else {
                vec![]
            };
            let live = BroadcastStream::new(rx).filter_map(|result| {
                match result {
                    Ok(text) => Some(Ok::<_, Infallible>(Event::default().data(text))),
                    Err(_) => None,
                }
            });
            let stream = tokio_stream::iter(initial).chain(live);
            let pinned: std::pin::Pin<Box<dyn tokio_stream::Stream<Item = Result<Event, Infallible>> + Send>> = Box::pin(stream);
            Ok(Sse::new(pinned).keep_alive(KeepAlive::default()))
        }
        None => {
            let job = job.unwrap();
            let stream = tokio_stream::once(Ok::<_, Infallible>(
                Event::default().data(job.output).event("complete"),
            ));
            let pinned: std::pin::Pin<Box<dyn tokio_stream::Stream<Item = Result<Event, Infallible>> + Send>> = Box::pin(stream);
            Ok(Sse::new(pinned).keep_alive(KeepAlive::default()))
        }
    }
}

#[derive(Deserialize)]
struct ContentQuery {
    path: String,
}

async fn file_content(Query(params): Query<ContentQuery>) -> impl IntoResponse {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let resolved = params.path.replacen("~", &home, 1);
    let file_path = std::path::Path::new(&resolved);

    if !file_path.exists() || !file_path.is_file() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "File not found" })),
        )
            .into_response();
    }

    match std::fs::read_to_string(file_path) {
        Ok(content) => (
            StatusCode::OK,
            Json(json!({ "content": content, "path": params.path })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to read file: {}", e) })),
        )
            .into_response(),
    }
}

async fn file_raw(Query(params): Query<ContentQuery>) -> impl IntoResponse {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let resolved = params.path.replacen("~", &home, 1);
    let file_path = std::path::Path::new(&resolved);

    if !file_path.exists() || !file_path.is_file() {
        return (StatusCode::NOT_FOUND, "Not found").into_response();
    }

    let content_type = match file_path.extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    };

    match std::fs::read(file_path) {
        Ok(bytes) => (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, content_type)],
            bytes,
        )
            .into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read file").into_response(),
    }
}

#[derive(Deserialize)]
struct SearchQuery {
    path: String,
    query: String,
}

async fn file_search(Query(params): Query<SearchQuery>) -> impl IntoResponse {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let resolved = params.path.replacen("~", &home, 1);
    let dir_path = std::path::Path::new(&resolved);

    if !dir_path.is_dir() {
        return Json(json!({ "results": [], "error": "Directory not found" }));
    }

    let query = params.query.to_lowercase();
    let mut results = Vec::new();

    fn search_recursive(
        dir: &std::path::Path,
        query: &str,
        home: &str,
        results: &mut Vec<serde_json::Value>,
        depth: usize,
    ) {
        if depth > 10 || results.len() > 100 {
            return;
        }
        let Ok(entries) = std::fs::read_dir(dir) else { return };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "node_modules" || name == "__pycache__" || name == "target" {
                continue;
            }
            if path.is_file() && name.to_lowercase().contains(query) {
                let full = path.to_string_lossy().to_string();
                let display = full.replacen(home, "~", 1);
                results.push(json!({
                    "filename": name,
                    "path": display,
                    "matches": 1,
                }));
            } else if path.is_dir() {
                search_recursive(&path, query, home, results, depth + 1);
            }
        }
    }

    search_recursive(dir_path, &query, &home, &mut results, 0);
    Json(json!({ "results": results }))
}

/// Get version changelog from ~/.mod/claude/changelog.json
async fn get_changelog(Query(params): Query<ChangelogQuery>) -> impl IntoResponse {
    let home = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"));
    let changelog_path = home.join(".mod").join("claude").join("changelog.json");

    if !changelog_path.exists() {
        return Json(json!({ "changelog": [], "count": 0 }));
    }

    match std::fs::read_to_string(&changelog_path) {
        Ok(content) => {
            match serde_json::from_str::<Vec<serde_json::Value>>(&content) {
                Ok(mut entries) => {
                    entries.reverse(); // newest first
                    let total = entries.len();
                    if let Some(limit) = params.limit {
                        entries.truncate(limit);
                    }
                    Json(json!({ "changelog": entries, "count": total }))
                }
                Err(e) => Json(json!({ "changelog": [], "count": 0, "error": format!("Invalid JSON: {}", e) })),
            }
        }
        Err(e) => Json(json!({ "changelog": [], "count": 0, "error": format!("Failed to read: {}", e) })),
    }
}

#[derive(Deserialize)]
struct ChangelogQuery {
    limit: Option<usize>,
}

/// Get a specific version entry from the changelog by version string
async fn get_version(Path(version): Path<String>) -> impl IntoResponse {
    let home = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"));
    let changelog_path = home.join(".mod").join("claude").join("changelog.json");

    if !changelog_path.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "No changelog found" })),
        ).into_response();
    }

    match std::fs::read_to_string(&changelog_path) {
        Ok(content) => {
            match serde_json::from_str::<Vec<serde_json::Value>>(&content) {
                Ok(entries) => {
                    for entry in &entries {
                        if entry.get("version").and_then(|v| v.as_str()) == Some(&version) {
                            return (StatusCode::OK, Json(json!({
                                "version": entry,
                                "gateway": format!("https://ipfs.io/ipfs/{}", entry.get("cid").and_then(|v| v.as_str()).unwrap_or("")),
                            }))).into_response();
                        }
                    }
                    (
                        StatusCode::NOT_FOUND,
                        Json(json!({ "error": format!("Version '{}' not found", version) })),
                    ).into_response()
                }
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("Invalid JSON: {}", e) })),
                ).into_response(),
            }
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to read changelog: {}", e) })),
        ).into_response(),
    }
}

#[derive(Deserialize)]
struct GrepQuery {
    path: String,
    query: String,
    #[serde(default)]
    caseSensitive: bool,
    #[serde(default)]
    regex: bool,
}

async fn file_grep(Query(params): Query<GrepQuery>) -> impl IntoResponse {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let resolved = params.path.replacen("~", &home, 1);
    let dir_path = std::path::Path::new(&resolved);

    if !dir_path.is_dir() {
        return Json(json!({ "matches": [], "error": "Directory not found" }));
    }

    let mut matches = Vec::new();
    let query = if params.caseSensitive {
        params.query.clone()
    } else {
        params.query.to_lowercase()
    };

    fn grep_recursive(
        dir: &std::path::Path,
        query: &str,
        case_sensitive: bool,
        home: &str,
        matches: &mut Vec<serde_json::Value>,
        depth: usize,
    ) {
        if depth > 10 || matches.len() > 200 {
            return;
        }
        let Ok(entries) = std::fs::read_dir(dir) else { return };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "node_modules" || name == "__pycache__" || name == "target" {
                continue;
            }
            if path.is_file() {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    for (line_num, line) in content.lines().enumerate() {
                        let search_line = if case_sensitive {
                            line.to_string()
                        } else {
                            line.to_lowercase()
                        };
                        if let Some(pos) = search_line.find(query) {
                            let full = path.to_string_lossy().to_string();
                            let display = full.replacen(home, "~", 1);
                            matches.push(json!({
                                "filename": name,
                                "path": display,
                                "line": line_num + 1,
                                "content": line.trim(),
                                "matchStart": pos,
                                "matchEnd": pos + query.len(),
                            }));
                            if matches.len() >= 200 {
                                return;
                            }
                        }
                    }
                }
            } else if path.is_dir() {
                grep_recursive(&path, query, case_sensitive, home, matches, depth + 1);
            }
        }
    }

    grep_recursive(dir_path, &query, params.caseSensitive, &home, &mut matches, 0);
    Json(json!({ "matches": matches }))
}

// ── File Write ───────────────────────────────────────────────────────

#[derive(Deserialize)]
struct WriteBody {
    path: String,
    content: String,
}

async fn file_write(Json(body): Json<WriteBody>) -> impl IntoResponse {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let resolved = body.path.replacen("~", &home, 1);
    let file_path = std::path::Path::new(&resolved);

    // Safety: only allow writes within ~/mod/
    let mod_dir = format!("{}/mod", home);
    let canonical_mod = std::fs::canonicalize(&mod_dir).unwrap_or_else(|_| std::path::PathBuf::from(&mod_dir));
    // Resolve parent to check containment (file may not exist yet)
    let parent = file_path.parent().unwrap_or(file_path);
    let canonical_parent = std::fs::canonicalize(parent).unwrap_or_else(|_| parent.to_path_buf());
    if !canonical_parent.starts_with(&canonical_mod) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Writes only allowed within ~/mod/" })),
        )
            .into_response();
    }

    // Create parent dirs if needed
    if let Some(p) = file_path.parent() {
        if !p.exists() {
            if let Err(e) = std::fs::create_dir_all(p) {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("Failed to create directories: {}", e) })),
                )
                    .into_response();
            }
        }
    }

    match std::fs::write(file_path, &body.content) {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({ "ok": true, "path": body.path })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to write file: {}", e) })),
        )
            .into_response(),
    }
}
