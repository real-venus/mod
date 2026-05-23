use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::AppState;

const CLOB_API: &str = "https://clob.polymarket.com";

#[derive(Deserialize)]
pub struct L1AuthPayload {
    pub address: String,
    pub signature: String,
    pub timestamp: String,
    #[serde(default)]
    pub nonce: u64,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/clob/auth/derive-api-key", post(derive_api_key))
        .route("/clob/auth/create-api-key", post(create_api_key))
}

async fn derive_api_key(
    State(state): State<AppState>,
    Json(p): Json<L1AuthPayload>,
) -> impl IntoResponse {
    // Polymarket's /auth/derive-api-key is a GET (returns the existing key
    // for this address, or 404 if none has ever been created).
    forward(&state, &p, "/auth/derive-api-key", reqwest::Method::GET).await
}

async fn create_api_key(
    State(state): State<AppState>,
    Json(p): Json<L1AuthPayload>,
) -> impl IntoResponse {
    forward(&state, &p, "/auth/api-key", reqwest::Method::POST).await
}

async fn forward(
    state: &AppState,
    p: &L1AuthPayload,
    path: &str,
    method: reqwest::Method,
) -> axum::response::Response {
    let url = format!("{}{}", CLOB_API, path);
    tracing::info!(
        "[clob-auth] -> {} {} (addr={}, ts={}, nonce={}, sig_len={})",
        method,
        url,
        p.address,
        p.timestamp,
        p.nonce,
        p.signature.len(),
    );
    let resp = state
        .http
        .request(method.clone(), &url)
        .header("POLY_ADDRESS", &p.address)
        .header("POLY_SIGNATURE", &p.signature)
        .header("POLY_TIMESTAMP", &p.timestamp)
        .header("POLY_NONCE", p.nonce.to_string())
        .send()
        .await;

    let resp = match resp {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("[clob-auth] upstream request error: {}", e);
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("upstream request failed: {}", e)})),
            )
                .into_response();
        }
    };

    let status = resp.status();
    let body_text = resp.text().await.unwrap_or_default();
    tracing::info!(
        "[clob-auth] <- {} {} status={} body_len={} body_preview={:?}",
        method,
        url,
        status,
        body_text.len(),
        body_text.chars().take(200).collect::<String>(),
    );
    let body_json: Value =
        serde_json::from_str(&body_text).unwrap_or_else(|_| json!({"raw": body_text}));

    let axum_status =
        StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (axum_status, Json(body_json)).into_response()
}
