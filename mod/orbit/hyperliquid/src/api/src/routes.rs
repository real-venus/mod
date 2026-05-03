use crate::store::{Follow, Index, IndexLeg};
use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/status", get(status))

        // ── public market data ──
        .route("/market/meta", get(meta))
        .route("/mids", get(mids))
        .route("/orderbook/:coin", get(orderbook))
        .route("/candles/:coin", get(candles))

        // ── account / wallet ──
        .route("/user/:addr/state", get(user_state))
        .route("/user/:addr/fills", get(user_fills))
        .route("/user/:addr/pnl", get(user_pnl))
        .route("/user/:addr/orders", get(user_orders))
        .route("/user/:addr/funding", get(user_funding))

        // ── trader analytics ──
        .route("/leaderboard", get(leaderboard))
        .route("/traders/top", get(top_traders))
        .route("/trader/:addr/analyze", get(analyze_trader))
        .route("/scan/progress", get(scan_progress))

        // ── copy-trade ──
        .route("/follows", get(list_follows).post(create_follow))
        .route("/follows/:id", delete(delete_follow).patch(update_follow))
        .route("/follows/:id/pause", post(pause_follow))
        .route("/follows/:id/resume", post(resume_follow))
        .route("/signals", get(list_signals))
        .route("/signals/:id/ack", post(ack_signal))

        // ── indexes ──
        .route("/indexes", get(list_indexes).post(create_index))
        .route("/indexes/:id", get(get_index).patch(update_index).delete(delete_index))
        .route("/indexes/:id/perf", get(index_perf))
        .route("/indexes/auto", post(auto_index_preview))

        // ── vaults ──
        .route("/vaults", get(vaults))
        .route("/vaults/:addr", get(vault_details))
        .route("/vaults/:addr/perf", get(vault_perf))
        .route("/indexes/:id/vault/intent", post(vault_intent))

        // ── generic mod-protocol passthrough ──
        .route("/forward", post(forward))
}

// Helper to convert anyhow::Error into a 500 with JSON body.
fn err500<E: std::fmt::Display>(e: E) -> (StatusCode, Json<Value>) {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
}

// ── health / status ──

async fn health() -> Json<Value> { Json(json!({"status": "ok"})) }

async fn status(State(s): State<AppState>) -> Json<Value> {
    Json(json!({
        "ok": true,
        "testnet": s.hl.testnet,
        "indexes": s.store.list_indexes().len(),
        "follows": s.store.list_follows(None).len(),
    }))
}

// ── market data ──

async fn meta(State(s): State<AppState>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.meta_and_ctxs().await.map(Json).map_err(err500)
}
async fn mids(State(s): State<AppState>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.all_mids().await.map(Json).map_err(err500)
}
async fn orderbook(State(s): State<AppState>, Path(coin): Path<String>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.l2_book(&coin).await.map(Json).map_err(err500)
}

#[derive(Deserialize)]
struct CandleQuery { interval: Option<String>, hours: Option<i64> }
async fn candles(State(s): State<AppState>, Path(coin): Path<String>, Query(q): Query<CandleQuery>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let interval = q.interval.unwrap_or_else(|| "1h".into());
    let hours = q.hours.unwrap_or(24);
    let now = chrono::Utc::now().timestamp_millis();
    s.hl.candles(&coin, &interval, now - hours * 3_600_000, now)
        .await.map(Json).map_err(err500)
}

// ── user / wallet ──

async fn user_state(State(s): State<AppState>, Path(a): Path<String>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.user_state(&a).await.map(Json).map_err(err500)
}
async fn user_fills(State(s): State<AppState>, Path(a): Path<String>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.user_fills(&a).await.map(Json).map_err(err500)
}
async fn user_pnl(State(s): State<AppState>, Path(a): Path<String>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.user_pnl(&a).await.map(Json).map_err(err500)
}
async fn user_orders(State(s): State<AppState>, Path(a): Path<String>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.open_orders(&a).await.map(Json).map_err(err500)
}
async fn user_funding(State(s): State<AppState>, Path(a): Path<String>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.user_funding(&a).await.map(Json).map_err(err500)
}

// ── traders ──

async fn leaderboard(State(s): State<AppState>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.leaderboard().await.map(Json).map_err(err500)
}

#[derive(Deserialize)]
struct TopQ {
    days: Option<u32>,
    min_per_day: Option<f64>,
    pool: Option<usize>,
    seed: Option<String>,           // comma-separated extra wallets
}
async fn top_traders(State(s): State<AppState>, Query(q): Query<TopQ>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let days = q.days.unwrap_or(7).clamp(1, 90);
    let min_per_day = q.min_per_day.unwrap_or(1.0).max(0.0);
    let pool = q.pool.unwrap_or(150).clamp(1, 1500);
    let seed: Vec<String> = q.seed.unwrap_or_default()
        .split(',').filter(|x| !x.is_empty())
        .map(|x| x.trim().to_lowercase()).collect();
    let traders = crate::traders::top_traders_with_progress(
        s.hl.clone(), days, min_per_day, pool, seed,
        Some(s.progress.clone()),
    ).await.map_err(err500)?;
    Ok(Json(json!({
        "days": days, "min_per_day": min_per_day, "pool": pool,
        "traders": traders,
    })))
}

async fn scan_progress(State(s): State<AppState>) -> Json<Value> {
    Json(json!(s.progress.snapshot()))
}

#[derive(Deserialize)]
struct AnalyzeQ { days: Option<u32> }
async fn analyze_trader(State(s): State<AppState>, Path(a): Path<String>, Query(q): Query<AnalyzeQ>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let days = q.days.unwrap_or(7).clamp(1, 90);
    crate::traders::analyze(s.hl.clone(), &a, days).await.map(Json).map_err(err500)
}

// ── follows / copy ──

#[derive(Deserialize)]
struct FollowFilter { follower: Option<String> }
async fn list_follows(State(s): State<AppState>, Query(q): Query<FollowFilter>) -> Json<Value> {
    Json(json!({"follows": s.store.list_follows(q.follower.as_deref())}))
}

#[derive(Deserialize)]
struct CreateFollow {
    follower: String,
    leader: String,
    size_pct: Option<f64>,
    max_per_trade_usd: Option<f64>,
    coins_allow: Option<Vec<String>>,
    coins_deny: Option<Vec<String>>,
    vault_address: Option<String>,
}
async fn create_follow(State(s): State<AppState>, Json(b): Json<CreateFollow>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let f = Follow {
        id: String::new(),
        follower: b.follower.to_lowercase(),
        leader: b.leader.to_lowercase(),
        size_pct: b.size_pct.unwrap_or(10.0).clamp(0.0, 100.0),
        max_per_trade_usd: b.max_per_trade_usd.unwrap_or(0.0).max(0.0),
        coins_allow: b.coins_allow.unwrap_or_default(),
        coins_deny: b.coins_deny.unwrap_or_default(),
        created_ms: 0, last_seen_tid: 0, paused: false,
        vault_address: b.vault_address,
    };
    s.store.upsert_follow(f).map(|x| Json(json!(x))).map_err(err500)
}

#[derive(Deserialize)]
struct PatchFollow {
    size_pct: Option<f64>,
    max_per_trade_usd: Option<f64>,
    coins_allow: Option<Vec<String>>,
    coins_deny: Option<Vec<String>>,
    paused: Option<bool>,
    vault_address: Option<String>,
}
async fn update_follow(State(s): State<AppState>, Path(id): Path<String>, Json(p): Json<PatchFollow>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let mut f = s.store.list_follows(None).into_iter().find(|x| x.id == id)
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"not found"}))))?;
    if let Some(v) = p.size_pct { f.size_pct = v.clamp(0.0, 100.0); }
    if let Some(v) = p.max_per_trade_usd { f.max_per_trade_usd = v.max(0.0); }
    if let Some(v) = p.coins_allow { f.coins_allow = v; }
    if let Some(v) = p.coins_deny { f.coins_deny = v; }
    if let Some(v) = p.paused { f.paused = v; }
    if let Some(v) = p.vault_address { f.vault_address = Some(v); }
    s.store.upsert_follow(f).map(|x| Json(json!(x))).map_err(err500)
}

async fn delete_follow(State(s): State<AppState>, Path(id): Path<String>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let ok = s.store.delete_follow(&id).map_err(err500)?;
    Ok(Json(json!({"deleted": ok})))
}

async fn pause_follow(State(s): State<AppState>, Path(id): Path<String>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let mut f = s.store.list_follows(None).into_iter().find(|x| x.id == id)
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"not found"}))))?;
    f.paused = true;
    s.store.upsert_follow(f).map(|x| Json(json!(x))).map_err(err500)
}
async fn resume_follow(State(s): State<AppState>, Path(id): Path<String>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let mut f = s.store.list_follows(None).into_iter().find(|x| x.id == id)
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"not found"}))))?;
    f.paused = false;
    s.store.upsert_follow(f).map(|x| Json(json!(x))).map_err(err500)
}

#[derive(Deserialize)]
struct SignalQ { follower: Option<String>, limit: Option<usize> }
async fn list_signals(State(s): State<AppState>, Query(q): Query<SignalQ>) -> Json<Value> {
    let lim = q.limit.unwrap_or(100).clamp(1, 500);
    Json(json!({"signals": s.copy.recent_signals(q.follower.as_deref(), lim)}))
}

#[derive(Deserialize)]
struct AckBody { status: String }
async fn ack_signal(State(s): State<AppState>, Path(id): Path<String>, Json(b): Json<AckBody>) -> Json<Value> {
    s.copy.mark_signal(&id, &b.status);
    Json(json!({"ok": true}))
}

// ── indexes ──

async fn list_indexes(State(s): State<AppState>) -> Json<Value> {
    Json(json!({"indexes": s.store.list_indexes()}))
}

#[derive(Deserialize)]
struct CreateIndex {
    name: String,
    owner: String,
    description: Option<String>,
    legs: Vec<IndexLeg>,
    days_window: Option<u32>,
    max_leverage: Option<f64>,
    notional_pct: Option<f64>,
    vault_address: Option<String>,
}
async fn create_index(State(s): State<AppState>, Json(b): Json<CreateIndex>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let idx = Index {
        id: String::new(),
        name: b.name,
        owner: b.owner.to_lowercase(),
        description: b.description.unwrap_or_default(),
        legs: b.legs,
        days_window: b.days_window.unwrap_or(7).clamp(1, 90),
        created_ms: 0,
        vault_address: b.vault_address,
        max_leverage: b.max_leverage.unwrap_or(0.0).max(0.0),
        notional_pct: b.notional_pct.unwrap_or(50.0).clamp(0.0, 100.0),
    };
    s.store.upsert_index(idx).map(|x| Json(json!(x))).map_err(err500)
}

async fn get_index(State(s): State<AppState>, Path(id): Path<String>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    s.store.get_index(&id)
        .map(|x| Json(json!(x)))
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error": "not found"}))))
}

#[derive(Deserialize)]
struct PatchIndex {
    name: Option<String>,
    description: Option<String>,
    legs: Option<Vec<IndexLeg>>,
    days_window: Option<u32>,
    max_leverage: Option<f64>,
    notional_pct: Option<f64>,
    vault_address: Option<String>,
}
async fn update_index(State(s): State<AppState>, Path(id): Path<String>, Json(p): Json<PatchIndex>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let mut idx = s.store.get_index(&id)
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"not found"}))))?;
    if let Some(v) = p.name { idx.name = v; }
    if let Some(v) = p.description { idx.description = v; }
    if let Some(v) = p.legs { idx.legs = v; }
    if let Some(v) = p.days_window { idx.days_window = v.clamp(1, 90); }
    if let Some(v) = p.max_leverage { idx.max_leverage = v.max(0.0); }
    if let Some(v) = p.notional_pct { idx.notional_pct = v.clamp(0.0, 100.0); }
    if let Some(v) = p.vault_address { idx.vault_address = Some(v); }
    s.store.upsert_index(idx).map(|x| Json(json!(x))).map_err(err500)
}

async fn delete_index(State(s): State<AppState>, Path(id): Path<String>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let ok = s.store.delete_index(&id).map_err(err500)?;
    Ok(Json(json!({"deleted": ok})))
}

#[derive(Deserialize)]
struct PerfQ { days: Option<u32> }
async fn index_perf(State(s): State<AppState>, Path(id): Path<String>, Query(q): Query<PerfQ>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let idx = s.store.get_index(&id)
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"not found"}))))?;
    crate::indexes::perf(s.hl.clone(), &idx, q.days)
        .await.map(|p| Json(json!(p))).map_err(err500)
}

#[derive(Deserialize)]
struct AutoBody { days: Option<u32>, top: Option<usize>, min_per_day: Option<f64>, pool: Option<usize> }
async fn auto_index_preview(State(s): State<AppState>, Json(b): Json<AutoBody>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let days = b.days.unwrap_or(7);
    let top = b.top.unwrap_or(10).max(1).min(50);
    let pool = b.pool.unwrap_or(150);
    let mpd = b.min_per_day.unwrap_or(1.0);
    let traders = crate::traders::top_traders(s.hl.clone(), days, mpd, pool, vec![])
        .await.map_err(err500)?;
    let legs = crate::indexes::auto_legs(&traders, top);
    Ok(Json(json!({
        "days": days, "top": top, "legs": legs,
        "candidates": traders.into_iter().take(top).collect::<Vec<_>>(),
    })))
}

// ── vaults ──

async fn vaults(State(s): State<AppState>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.vaults().await.map(Json).map_err(err500)
}
async fn vault_details(State(s): State<AppState>, Path(a): Path<String>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.vault_details(&a).await.map(Json).map_err(err500)
}
async fn vault_perf(State(s): State<AppState>, Path(a): Path<String>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    s.hl.vault_pnl(&a).await.map(Json).map_err(err500)
}

// Build a vault-creation intent for an index. The Hyperliquid vault
// creation tx must be signed by the index owner — we hand the caller
// the canonical action payload they need to sign and submit to
// /exchange themselves (or via the /forward passthrough below).
#[derive(Deserialize)]
struct VaultIntentBody {
    initial_usd: f64,
    nonce: Option<u64>,
}
async fn vault_intent(State(s): State<AppState>, Path(id): Path<String>, Json(b): Json<VaultIntentBody>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let idx = s.store.get_index(&id)
        .ok_or((StatusCode::NOT_FOUND, Json(json!({"error":"not found"}))))?;
    let nonce = b.nonce.unwrap_or_else(|| chrono::Utc::now().timestamp_millis() as u64);
    let action = json!({
        "type": "createVault",
        "name": idx.name,
        "description": format!("Index '{}' — {} legs. Owner-funded only.",
                                idx.name, idx.legs.len()),
        "initialUsd": (b.initial_usd * 1e6) as u64,
        "nonce": nonce,
    });
    Ok(Json(json!({
        "action": action,
        "owner": idx.owner,
        "exchange_url": s.hl.exchange_url,
        "note": "Sign `action` with the owner key, POST to /forward with \
                 {fn:'exchange_post', payload:{action,nonce,signature}}.",
    })))
}

// ── /forward — generic mod-protocol passthrough ──
//
// fn:
//   "info_post"     → POST /info  with body.payload
//   "exchange_post" → POST /exchange with body.payload (caller-signed)
//   "top_traders"   → wraps top_traders helper
//   "list_indexes" / "list_follows" / "recent_signals"
#[derive(Deserialize)]
struct ForwardBody {
    #[serde(rename = "fn")]
    fnname: String,
    #[serde(default)]
    payload: Value,
}

async fn forward(State(s): State<AppState>, Json(b): Json<ForwardBody>)
    -> Result<Json<Value>, (StatusCode, Json<Value>)>
{
    let result = match b.fnname.as_str() {
        "info_post" => {
            let r = reqwest::Client::new().post(&s.hl.info_url)
                .json(&b.payload).send().await.map_err(err500)?;
            let v: Value = r.json().await.map_err(err500)?;
            v
        }
        "exchange_post" => {
            let r = reqwest::Client::new().post(&s.hl.exchange_url)
                .json(&b.payload).send().await.map_err(err500)?;
            let v: Value = r.json().await.map_err(err500)?;
            v
        }
        "top_traders" => {
            let days = b.payload.get("days").and_then(|x| x.as_u64()).unwrap_or(7) as u32;
            let mpd = b.payload.get("min_per_day").and_then(|x| x.as_f64()).unwrap_or(1.0);
            let pool = b.payload.get("pool").and_then(|x| x.as_u64()).unwrap_or(150) as usize;
            let traders = crate::traders::top_traders(s.hl.clone(), days, mpd, pool, vec![])
                .await.map_err(err500)?;
            json!({"traders": traders})
        }
        "list_indexes" => json!({"indexes": s.store.list_indexes()}),
        "list_follows" => json!({"follows": s.store.list_follows(None)}),
        "recent_signals" => {
            let lim = b.payload.get("limit").and_then(|x| x.as_u64()).unwrap_or(100) as usize;
            let f = b.payload.get("follower").and_then(|x| x.as_str()).map(|x| x.to_string());
            json!({"signals": s.copy.recent_signals(f.as_deref(), lim)})
        }
        other => {
            return Err((StatusCode::BAD_REQUEST,
                Json(json!({"error": format!("unknown fn: {other}")}))));
        }
    };
    Ok(Json(json!({"result": result})))
}

