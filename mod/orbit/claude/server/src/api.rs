//! HTTP API for Claude Jobs — Axum endpoints + SSE streaming + MetaMask auth

use crate::auth;
use crate::jobs::{ClaudeJobManager, SubmitRequest};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::{delete, get, post},
    Json, Router,
};
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

    let challenge_store = auth::new_challenge_store();

    // Protected job routes (require bearer token)
    let job_routes = Router::new()
        .route("/jobs", post(submit_job))
        .route("/jobs", get(list_jobs))
        .route("/jobs/{id}", get(get_job))
        .route("/jobs/{id}", delete(delete_job))
        .route("/jobs/{id}/cancel", post(cancel_job))
        .route("/jobs/{id}/stream", get(stream_job))
        .layer(middleware::from_fn(auth::auth_middleware))
        .with_state(manager);

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(health))
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

async fn submit_job(
    State(mgr): State<AppState>,
    Json(req): Json<SubmitRequest>,
) -> impl IntoResponse {
    let job = mgr.submit(req).await;
    (StatusCode::CREATED, Json(json!(job)))
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
    State(mgr): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    mgr.delete_job(&id);
    Json(json!({ "success": true }))
}

async fn cancel_job(
    State(mgr): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match mgr.cancel_job(&id).await {
        Ok(()) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Err(e) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": e })),
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
            let stream = BroadcastStream::new(rx).filter_map(|result| {
                match result {
                    Ok(text) => Some(Ok::<_, Infallible>(Event::default().data(text))),
                    Err(_) => None,
                }
            });
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
