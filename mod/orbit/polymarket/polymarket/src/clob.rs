use anyhow::{anyhow, Result};
use reqwest::Client;
use serde_json::{json, Value};
use k256::ecdsa::SigningKey;

use crate::auth::{self, l2_headers, l1_headers, address_from_key};
use crate::types::*;
use crate::signing::{self, create_signed_order};

const CLOB_BASE: &str = "https://clob.polymarket.com";

pub struct ClobClient {
    client: Client,
    key: SigningKey,
    address: String,
    creds: Option<ApiCreds>,
}

impl ClobClient {
    pub fn new(private_key: &str) -> Result<Self> {
        let key = auth::parse_private_key(private_key)?;
        let address = address_from_key(&key);
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        Ok(Self { client, key, address, creds: None })
    }

    pub fn address(&self) -> &str { &self.address }

    // ─── Key Management ───

    /// Derive or create API credentials (L1 auth)
    pub async fn derive_api_key(&mut self) -> Result<ApiCreds> {
        let headers = l1_headers(&self.key, &self.address)?;
        let resp = self.client
            .get(format!("{}/auth/derive-api-key", CLOB_BASE))
            .headers(headers)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            // If derive fails, try creating
            if status.as_u16() == 404 || body.contains("not found") {
                return self.create_api_key().await;
            }
            return Err(anyhow!("derive_api_key failed ({}): {}", status, body));
        }

        let creds: ApiCreds = resp.json().await?;
        self.creds = Some(creds.clone());
        Ok(creds)
    }

    /// Create new API credentials (L1 auth)
    pub async fn create_api_key(&mut self) -> Result<ApiCreds> {
        let headers = l1_headers(&self.key, &self.address)?;
        let resp = self.client
            .post(format!("{}/auth/api-key", CLOB_BASE))
            .headers(headers)
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("create_api_key failed: {}", body));
        }

        let creds: ApiCreds = resp.json().await?;
        self.creds = Some(creds.clone());
        Ok(creds)
    }

    /// Set credentials directly
    pub fn set_creds(&mut self, creds: ApiCreds) {
        self.creds = Some(creds);
    }

    fn creds(&self) -> Result<&ApiCreds> {
        self.creds.as_ref().ok_or_else(|| anyhow!("API credentials not set. Call derive_api_key() first"))
    }

    // ─── Authenticated Request Helpers ───

    async fn get_auth(&self, path: &str) -> Result<Value> {
        let creds = self.creds()?;
        let headers = l2_headers(creds, &self.address, "GET", path, "")?;
        let resp = self.client
            .get(format!("{}{}", CLOB_BASE, path))
            .headers(headers)
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("GET {} failed: {}", path, body));
        }
        Ok(resp.json().await?)
    }

    async fn post_auth(&self, path: &str, body: &Value) -> Result<Value> {
        let creds = self.creds()?;
        let body_str = serde_json::to_string(body)?;
        let headers = l2_headers(creds, &self.address, "POST", path, &body_str)?;
        let resp = self.client
            .post(format!("{}{}", CLOB_BASE, path))
            .headers(headers)
            .header("Content-Type", "application/json")
            .body(body_str)
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("POST {} failed: {}", path, body));
        }
        Ok(resp.json().await?)
    }

    async fn delete_auth(&self, path: &str, body: Option<&Value>) -> Result<Value> {
        let creds = self.creds()?;
        let body_str = body.map(|b| serde_json::to_string(b).unwrap_or_default()).unwrap_or_default();
        let headers = l2_headers(creds, &self.address, "DELETE", path, &body_str)?;

        let mut req = self.client
            .delete(format!("{}{}", CLOB_BASE, path))
            .headers(headers);

        if !body_str.is_empty() {
            req = req.header("Content-Type", "application/json").body(body_str);
        }

        let resp = req.send().await?;
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("DELETE {} failed: {}", path, body));
        }
        Ok(resp.json().await?)
    }

    // ─── Public Market Data ───

    pub async fn server_time(&self) -> Result<i64> {
        let resp = self.client
            .get(format!("{}/server-time", CLOB_BASE))
            .send().await?;
        let v: Value = resp.json().await?;
        Ok(v.get("timestamp").and_then(|t| t.as_i64()).unwrap_or(0))
    }

    pub async fn midpoint(&self, token_id: &str) -> Result<f64> {
        let resp = self.client
            .get(format!("{}/midpoint-price?token_id={}", CLOB_BASE, token_id))
            .send().await?;
        let v: Value = resp.json().await?;
        let price_str = v.get("price").and_then(|p| p.as_str()).unwrap_or("0");
        Ok(price_str.parse().unwrap_or(0.0))
    }

    pub async fn orderbook(&self, token_id: &str) -> Result<OrderBook> {
        let resp = self.client
            .get(format!("{}/order-book?token_id={}", CLOB_BASE, token_id))
            .send().await?;
        let v: Value = resp.json().await?;

        let bids = v.get("bids").and_then(|b| b.as_array()).cloned().unwrap_or_default();
        let asks = v.get("asks").and_then(|a| a.as_array()).cloned().unwrap_or_default();

        let best_bid = bids.first().and_then(|b| b.get("price")).and_then(|p| p.as_str()).map(String::from);
        let best_ask = asks.first().and_then(|a| a.get("price")).and_then(|p| p.as_str()).map(String::from);

        let spread = match (&best_bid, &best_ask) {
            (Some(bid), Some(ask)) => {
                let b: f64 = bid.parse().unwrap_or(0.0);
                let a: f64 = ask.parse().unwrap_or(0.0);
                Some(format!("{:.4}", a - b))
            }
            _ => None,
        };
        let midpoint = match (&best_bid, &best_ask) {
            (Some(bid), Some(ask)) => {
                let b: f64 = bid.parse().unwrap_or(0.0);
                let a: f64 = ask.parse().unwrap_or(0.0);
                Some(format!("{:.4}", (a + b) / 2.0))
            }
            _ => None,
        };

        Ok(OrderBook { bids, asks, best_bid, best_ask, spread, midpoint })
    }

    pub async fn spread(&self, token_id: &str) -> Result<Value> {
        let resp = self.client
            .get(format!("{}/spread?token_id={}", CLOB_BASE, token_id))
            .send().await?;
        Ok(resp.json().await?)
    }

    pub async fn last_trade_price(&self, token_id: &str) -> Result<f64> {
        let resp = self.client
            .get(format!("{}/last-trade-price?token_id={}", CLOB_BASE, token_id))
            .send().await?;
        let v: Value = resp.json().await?;
        let price_str = v.get("price").and_then(|p| p.as_str()).unwrap_or("0");
        Ok(price_str.parse().unwrap_or(0.0))
    }

    pub async fn tick_size(&self, token_id: &str) -> Result<String> {
        let resp = self.client
            .get(format!("{}/tick-size?token_id={}", CLOB_BASE, token_id))
            .send().await?;
        let v: Value = resp.json().await?;
        Ok(v.get("minimum_tick_size").and_then(|t| t.as_str()).unwrap_or("0.01").to_string())
    }

    pub async fn price_history(&self, condition_id: &str) -> Result<Vec<Value>> {
        let resp = self.client
            .get(format!("{}/market/{}/prices-history", CLOB_BASE, condition_id))
            .send().await?;
        let v: Value = resp.json().await?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    pub async fn open_interest(&self) -> Result<Value> {
        let resp = self.client
            .get(format!("{}/open-interest", CLOB_BASE))
            .send().await?;
        Ok(resp.json().await?)
    }

    // ─── Order Management ───

    /// Place a limit order
    pub async fn place_order(
        &self,
        token_id: &str,
        price: f64,
        size: f64,
        side: Side,
        order_type: OrderType,
        neg_risk: bool,
        expiration: Option<u64>,
    ) -> Result<Value> {
        let exp = match order_type {
            OrderType::GTD => expiration.unwrap_or_else(|| {
                (chrono::Utc::now().timestamp() as u64) + 86400 // 24h default
            }),
            _ => 0,
        };

        let tick = self.tick_size(token_id).await.unwrap_or("0.01".into());
        let fee_rate: u64 = 0; // most markets have 0 fees

        let signed = create_signed_order(
            &self.key, &self.address, token_id,
            price, size, side, neg_risk,
            fee_rate, exp, SignatureType::EOA,
        )?;

        let body = json!({
            "order": {
                "salt": signed.order.salt,
                "maker": signed.order.maker,
                "signer": signed.order.signer,
                "taker": signed.order.taker,
                "tokenId": signed.order.token_id,
                "makerAmount": signed.order.maker_amount,
                "takerAmount": signed.order.taker_amount,
                "expiration": signed.order.expiration,
                "nonce": signed.order.nonce,
                "feeRateBps": signed.order.fee_rate_bps,
                "side": signed.order.side.as_str(),
                "signatureType": signed.order.signature_type as u8,
            },
            "signature": signed.signature,
            "orderType": order_type.as_str(),
            "tickSize": tick,
            "negRisk": neg_risk,
        });

        self.post_auth("/order", &body).await
    }

    /// Place a market order (FOK at best available price)
    pub async fn market_order(
        &self,
        token_id: &str,
        size: f64,
        side: Side,
        neg_risk: bool,
    ) -> Result<Value> {
        // Get current best price
        let price = match side {
            Side::Buy => {
                let ob = self.orderbook(token_id).await?;
                ob.best_ask.as_ref()
                    .and_then(|p| p.parse::<f64>().ok())
                    .unwrap_or(1.0)
            }
            Side::Sell => {
                let ob = self.orderbook(token_id).await?;
                ob.best_bid.as_ref()
                    .and_then(|p| p.parse::<f64>().ok())
                    .unwrap_or(0.0)
            }
        };

        self.place_order(token_id, price, size, side, OrderType::FOK, neg_risk, None).await
    }

    /// Cancel an order by ID
    pub async fn cancel_order(&self, order_id: &str) -> Result<Value> {
        self.delete_auth(&format!("/order/{}", order_id), None).await
    }

    /// Cancel multiple orders
    pub async fn cancel_orders(&self, order_ids: &[String]) -> Result<Value> {
        let body = json!(order_ids);
        self.delete_auth("/orders", Some(&body)).await
    }

    /// Cancel all orders for a market
    pub async fn cancel_market_orders(&self, condition_id: &str) -> Result<Value> {
        let body = json!({ "market": condition_id });
        self.delete_auth("/orders/market", Some(&body)).await
    }

    /// Cancel all open orders
    pub async fn cancel_all(&self) -> Result<Value> {
        self.delete_auth("/orders/all", None).await
    }

    // ─── User Data ───

    /// Get open orders
    pub async fn open_orders(&self, market: Option<&str>) -> Result<Vec<Value>> {
        let path = match market {
            Some(m) => format!("/orders?market={}", m),
            None => "/orders".to_string(),
        };
        let v = self.get_auth(&path).await?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    /// Get a specific order
    pub async fn get_order(&self, order_id: &str) -> Result<Value> {
        self.get_auth(&format!("/order/{}", order_id)).await
    }

    /// Get trade history
    pub async fn trades(&self, market: Option<&str>, limit: Option<u32>) -> Result<Vec<Value>> {
        let mut params = Vec::new();
        if let Some(m) = market { params.push(format!("market={}", m)); }
        if let Some(l) = limit { params.push(format!("limit={}", l)); }
        let query = if params.is_empty() { String::new() } else { format!("?{}", params.join("&")) };
        let v = self.get_auth(&format!("/trades{}", query)).await?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    /// Get current positions
    pub async fn positions(&self) -> Result<Vec<Value>> {
        let v = self.get_auth("/user/positions/current").await?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    /// Get closed positions
    pub async fn closed_positions(&self) -> Result<Vec<Value>> {
        let v = self.get_auth("/user/positions/closed").await?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    /// Get total position value
    pub async fn position_value(&self) -> Result<Value> {
        self.get_auth("/user/positions/value").await
    }

    /// Get user activity
    pub async fn activity(&self) -> Result<Vec<Value>> {
        let v = self.get_auth("/user/activity").await?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    /// Send heartbeat to keep session alive
    pub async fn heartbeat(&self) -> Result<Value> {
        self.post_auth("/heartbeat", &json!({})).await
    }
}
