use crate::db;
use crate::models::*;
use crate::scrapers::ScraperManager;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub scraper: Arc<ScraperManager>,
}

pub fn router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/", get(health))
        .route("/health", get(health))
        .route("/bounties", get(list_bounties))
        .route("/bounties/{id}", get(get_bounty))
        .route("/sources", get(list_sources))
        .route("/scrape", post(trigger_scrape))
        .route("/stats", get(get_stats))
        .layer(cors)
        .with_state(state)
}

async fn health() -> Json<Value> {
    Json(json!({
        "status": "online",
        "service": "bounty-hunter",
        "version": "1.0.0"
    }))
}

async fn list_bounties(
    State(state): State<AppState>,
    Query(filters): Query<BountyFilters>,
) -> Result<Json<Value>, StatusCode> {
    let conn = state.db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let bounties = db::query_bounties(&conn, &filters).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({
        "bounties": bounties,
        "count": bounties.len(),
    })))
}

async fn get_bounty(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let conn = state.db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    match db::get_bounty_by_id(&conn, &id) {
        Ok(Some(bounty)) => Ok(Json(json!(bounty))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn list_sources(State(state): State<AppState>) -> Result<Json<Value>, StatusCode> {
    let conn = state.db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let sources = db::get_source_info(&conn).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "sources": sources })))
}

async fn trigger_scrape(State(state): State<AppState>) -> Json<Value> {
    let db = state.db.clone();
    let scraper = state.scraper.clone();

    // Run scrape in background so we don't block the response
    tokio::spawn(async move {
        scraper.run_all(&db).await;
    });

    Json(json!({
        "status": "scraping",
        "message": "Scrape triggered across all sources"
    }))
}

async fn get_stats(State(state): State<AppState>) -> Result<Json<Value>, StatusCode> {
    let conn = state.db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let stats = db::get_stats(&conn).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!(stats)))
}
