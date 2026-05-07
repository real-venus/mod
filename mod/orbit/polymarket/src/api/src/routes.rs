use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};
use tokio_stream::StreamExt;

use crate::types::{ActiveTradersQuery, StreamEvent};
use crate::proxy;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/active-traders", get(active_traders))
        // Proxy: all other endpoints go through the cache proxy
        .fallback(get(proxy::proxy_handler).post(proxy::proxy_handler))
}

async fn health() -> Json<Value> {
    Json(json!({"status": "ok", "service": "polymarket-api"}))
}

async fn active_traders(
    State(state): State<AppState>,
    Query(q): Query<ActiveTradersQuery>,
) -> impl IntoResponse {
    let days = q.days.unwrap_or(7).clamp(1, 365);
    let min_per_day = q.min_per_day.unwrap_or(0.0).max(0.0);
    let pool = q.pool.unwrap_or(1000).clamp(50, 2000);
    let stream = q.stream.as_deref() == Some("1");
    let paged = q.paged.as_deref() == Some("1");
    let cache_key = format!("{}:{}:{}", days, min_per_day, pool);

    // Status probe
    if q.status.as_deref() == Some("1") {
        return Json(json!({"ok": true})).into_response();
    }

    // Check cache (memory + disk)
    if let Some((payload, source)) = state.pipeline.cache.get_or_disk(&cache_key) {
        if paged {
            let result = apply_pagination(&payload, &q, source);
            return Json(result).into_response();
        }
        if stream {
            let evt = StreamEvent::Result {
                source: source.to_string(),
                count: payload.count,
                candidate_pool: payload.candidate_pool,
                days_window: payload.days_window,
                min_trades_per_day: payload.min_trades_per_day,
                traders: payload.traders,
            };
            let body = format!("{}\n", serde_json::to_string(&evt).unwrap_or_default());
            return axum::response::Response::builder()
                .header("content-type", "application/x-ndjson")
                .header("cache-control", "no-store")
                .body(Body::from(body))
                .unwrap()
                .into_response();
        }
        return Json(json!({
            "count": payload.count,
            "candidatePool": payload.candidate_pool,
            "daysWindow": payload.days_window,
            "minTradesPerDay": payload.min_trades_per_day,
            "traders": payload.traders,
            "source": source,
        })).into_response();
    }

    // Paged but cold cache
    if paged {
        return Json(json!({
            "traders": [],
            "total": 0,
            "page": 0,
            "pageSize": 25,
            "cold": true,
            "source": null,
        })).into_response();
    }

    // Streaming response
    if stream {
        let pipeline = state.pipeline.clone();
        let (tx, rx) = tokio::sync::mpsc::channel::<Value>(100);

        tokio::spawn(async move {
            let result = pipeline.run_pipeline(days, min_per_day, pool, Some(tx.clone())).await;
            match result {
                Ok(payload) => {
                    pipeline.cache.set(&cache_key, payload.clone());
                    let evt = serde_json::json!({
                        "type": "result",
                        "source": "fresh",
                        "count": payload.count,
                        "candidatePool": payload.candidate_pool,
                        "daysWindow": payload.days_window,
                        "minTradesPerDay": payload.min_trades_per_day,
                        "traders": payload.traders,
                    });
                    tx.send(evt).await.ok();
                }
                Err(e) => {
                    tx.send(serde_json::json!({"type": "error", "message": e.to_string()})).await.ok();
                }
            }
        });

        let stream = tokio_stream::wrappers::ReceiverStream::new(rx)
            .map(|v| {
                let line = format!("{}\n", serde_json::to_string(&v).unwrap_or_default());
                Ok::<_, std::convert::Infallible>(line)
            });

        return axum::response::Response::builder()
            .header("content-type", "application/x-ndjson")
            .header("cache-control", "no-store")
            .body(Body::from_stream(stream))
            .unwrap()
            .into_response();
    }

    // Non-streaming cold miss: run pipeline synchronously
    match state.pipeline.run_pipeline(days, min_per_day, pool, None).await {
        Ok(payload) => {
            state.pipeline.cache.set(&cache_key, payload.clone());
            Json(json!({
                "count": payload.count,
                "candidatePool": payload.candidate_pool,
                "daysWindow": payload.days_window,
                "minTradesPerDay": payload.min_trades_per_day,
                "traders": payload.traders,
                "source": "fresh",
            })).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
    }
}

fn apply_pagination(payload: &crate::types::AggPayload, q: &ActiveTradersQuery, source: &str) -> Value {
    let sort = q.sort.as_deref().unwrap_or("pnl");
    let order = q.order.as_deref().unwrap_or("desc");
    let page = q.page.unwrap_or(0);
    let page_size = q.page_size.unwrap_or(25).clamp(1, 100);

    let mut traders = payload.traders.clone();

    // Filter
    if let Some(ref search) = q.search {
        let s = search.to_lowercase();
        traders.retain(|t| {
            t.address.contains(&s)
                || t.market_titles.iter().any(|m| m.to_lowercase().contains(&s))
        });
    }
    if let Some(ref cat) = q.category {
        let cat_lower = cat.to_lowercase();
        traders.retain(|t| {
            t.market_titles.iter().any(|m| m.to_lowercase().contains(&cat_lower))
        });
    }
    if let Some(min_vol) = q.min_volume {
        if min_vol > 0.0 {
            traders.retain(|t| t.volume >= min_vol);
        }
    }
    if let Some(min_pnl) = q.min_pnl {
        traders.retain(|t| t.pnl >= min_pnl);
    }
    if let Some(min_t) = q.min_trades {
        if min_t > 0 {
            traders.retain(|t| t.recent_trades >= min_t);
        }
    }
    if let Some(min_bv) = q.min_buy_volume {
        if min_bv > 0.0 {
            traders.retain(|t| t.buy_volume >= min_bv);
        }
    }
    if let Some(min_sv) = q.min_sell_volume {
        if min_sv > 0.0 {
            traders.retain(|t| t.sell_volume >= min_sv);
        }
    }

    // Sort
    let dir: f64 = if order == "asc" { 1.0 } else { -1.0 };
    traders.sort_by(|a, b| {
        let cmp = match sort {
            "volume" => a.volume.partial_cmp(&b.volume),
            "positions" => a.positions.partial_cmp(&b.positions),
            "winRate" => a.win_rate.partial_cmp(&b.win_rate),
            _ => a.pnl.partial_cmp(&b.pnl),
        };
        let c = cmp.unwrap_or(std::cmp::Ordering::Equal);
        if dir < 0.0 { c.reverse() } else { c }
    });

    let total = traders.len();
    let start = (page * page_size) as usize;
    let sliced: Vec<_> = traders.into_iter().skip(start).take(page_size as usize).collect();

    json!({
        "traders": sliced,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "count": payload.count,
        "candidatePool": payload.candidate_pool,
        "daysWindow": payload.days_window,
        "minTradesPerDay": payload.min_trades_per_day,
        "source": source,
    })
}
