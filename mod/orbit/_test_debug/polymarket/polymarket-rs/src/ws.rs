use anyhow::{anyhow, Result};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::sync::broadcast;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::{info, warn, error};

use crate::types::{ApiCreds, WsEvent};

const WS_MARKET_URL: &str = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const WS_USER_URL: &str = "wss://ws-subscriptions-clob.polymarket.com/ws/user";
const HEARTBEAT_INTERVAL_SECS: u64 = 10;

pub struct WsClient {
    event_tx: broadcast::Sender<WsEvent>,
    running: Arc<RwLock<bool>>,
    handles: Arc<RwLock<Vec<tokio::task::JoinHandle<()>>>>,
}

impl WsClient {
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(10_000);
        Self {
            event_tx,
            running: Arc::new(RwLock::new(false)),
            handles: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.event_tx.subscribe()
    }

    /// Subscribe to market data for given token IDs
    pub fn connect_market(&self, token_ids: Vec<String>) {
        let tx = self.event_tx.clone();
        let running = self.running.clone();
        *running.write() = true;

        let handle = tokio::spawn(async move {
            loop {
                if !*running.read() { break; }

                match connect_async(WS_MARKET_URL).await {
                    Ok((mut ws, _)) => {
                        info!("WebSocket market connected");

                        // Subscribe
                        let sub = json!({
                            "assets_ids": token_ids,
                            "type": "market",
                            "custom_feature_enabled": true,
                        });
                        if let Err(e) = ws.send(Message::Text(sub.to_string().into())).await {
                            error!("WS subscribe failed: {}", e);
                            continue;
                        }

                        // Heartbeat task
                        let running_hb = running.clone();
                        let hb_handle = tokio::spawn({
                            let mut ws_sink = None::<()>; // We'll use a separate approach
                            async move {
                                loop {
                                    if !*running_hb.read() { break; }
                                    tokio::time::sleep(std::time::Duration::from_secs(HEARTBEAT_INTERVAL_SECS)).await;
                                }
                            }
                        });

                        // Read messages
                        while let Some(msg) = ws.next().await {
                            if !*running.read() { break; }

                            match msg {
                                Ok(Message::Text(text)) => {
                                    if text.as_ref() == "PONG" { continue; }

                                    if let Ok(data) = serde_json::from_str::<Value>(&text) {
                                        let event_type = data.get("event_type")
                                            .or_else(|| data.get("type"))
                                            .and_then(|t| t.as_str())
                                            .unwrap_or("unknown")
                                            .to_string();

                                        let market = data.get("market")
                                            .or_else(|| data.get("asset_id"))
                                            .and_then(|m| m.as_str())
                                            .map(String::from);

                                        let _ = tx.send(WsEvent {
                                            event_type,
                                            market,
                                            data: text.to_string(),
                                            timestamp: chrono::Utc::now().timestamp(),
                                        });
                                    }
                                }
                                Ok(Message::Ping(payload)) => {
                                    let _ = ws.send(Message::Pong(payload)).await;
                                }
                                Err(e) => {
                                    warn!("WS error: {}", e);
                                    break;
                                }
                                _ => {}
                            }
                        }

                        hb_handle.abort();
                        info!("WebSocket disconnected, reconnecting...");
                    }
                    Err(e) => {
                        error!("WS connection failed: {}", e);
                    }
                }

                if !*running.read() { break; }
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        });

        self.handles.write().push(handle);
    }

    /// Subscribe to user-specific events (trades, order updates)
    pub fn connect_user(&self, creds: &ApiCreds, markets: Vec<String>) {
        let tx = self.event_tx.clone();
        let running = self.running.clone();
        let creds = creds.clone();
        let markets = markets.clone();

        let handle = tokio::spawn(async move {
            loop {
                if !*running.read() { break; }

                match connect_async(WS_USER_URL).await {
                    Ok((mut ws, _)) => {
                        info!("WebSocket user connected");

                        let sub = json!({
                            "auth": {
                                "apiKey": creds.api_key,
                                "secret": creds.secret,
                                "passphrase": creds.passphrase,
                            },
                            "markets": markets,
                            "type": "user",
                        });
                        if let Err(e) = ws.send(Message::Text(sub.to_string().into())).await {
                            error!("WS user subscribe failed: {}", e);
                            continue;
                        }

                        while let Some(msg) = ws.next().await {
                            if !*running.read() { break; }

                            match msg {
                                Ok(Message::Text(text)) => {
                                    if text.as_ref() == "PONG" { continue; }

                                    if let Ok(data) = serde_json::from_str::<Value>(&text) {
                                        let event_type = data.get("event_type")
                                            .or_else(|| data.get("type"))
                                            .and_then(|t| t.as_str())
                                            .unwrap_or("unknown")
                                            .to_string();

                                        let market = data.get("market")
                                            .and_then(|m| m.as_str())
                                            .map(String::from);

                                        let _ = tx.send(WsEvent {
                                            event_type,
                                            market,
                                            data: text.to_string(),
                                            timestamp: chrono::Utc::now().timestamp(),
                                        });
                                    }
                                }
                                Ok(Message::Ping(payload)) => {
                                    let _ = ws.send(Message::Pong(payload)).await;
                                }
                                Err(e) => {
                                    warn!("WS user error: {}", e);
                                    break;
                                }
                                _ => {}
                            }
                        }

                        info!("WS user disconnected, reconnecting...");
                    }
                    Err(e) => {
                        error!("WS user connection failed: {}", e);
                    }
                }

                if !*running.read() { break; }
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        });

        self.handles.write().push(handle);
    }

    /// Send ping to keep connections alive
    pub fn is_running(&self) -> bool {
        *self.running.read()
    }

    /// Stop all WebSocket connections
    pub fn stop(&self) {
        *self.running.write() = false;
        for handle in self.handles.write().drain(..) {
            handle.abort();
        }
    }
}
