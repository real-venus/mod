use anyhow::{anyhow, Result};
use reqwest::Client;
use serde_json::Value;

use crate::types::{Market, Event};

const GAMMA_BASE: &str = "https://gamma-api.polymarket.com";

pub struct GammaClient {
    client: Client,
}

impl GammaClient {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("failed to build HTTP client"),
        }
    }

    // ─── Markets ───

    /// Fetch markets with pagination and filters
    pub async fn markets(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
        active: Option<bool>,
        closed: Option<bool>,
        order: Option<&str>,    // "volume", "liquidity", "end_date", "start_date"
        ascending: Option<bool>,
    ) -> Result<Vec<Value>> {
        let mut params = Vec::new();
        params.push(format!("limit={}", limit.unwrap_or(100)));
        if let Some(o) = offset { params.push(format!("offset={}", o)); }
        if let Some(a) = active { params.push(format!("active={}", a)); }
        if let Some(c) = closed { params.push(format!("closed={}", c)); }
        if let Some(ord) = order { params.push(format!("order={}", ord)); }
        if let Some(asc) = ascending { params.push(format!("ascending={}", asc)); }

        let url = format!("{}/markets?{}", GAMMA_BASE, params.join("&"));
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("markets fetch failed: {}", body));
        }

        let v: Value = resp.json().await?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    /// Get all active markets (paginated)
    pub async fn all_active_markets(&self) -> Result<Vec<Value>> {
        let mut all = Vec::new();
        let mut offset = 0u32;
        let limit = 100u32;

        loop {
            let batch = self.markets(
                Some(limit), Some(offset), Some(true), Some(false), None, None
            ).await?;

            if batch.is_empty() { break; }
            let len = batch.len();
            all.extend(batch);
            if (len as u32) < limit { break; }
            offset += limit;
        }

        Ok(all)
    }

    /// Get a single market by condition_id
    pub async fn market(&self, condition_id: &str) -> Result<Value> {
        let url = format!("{}/markets/{}", GAMMA_BASE, condition_id);
        let resp = self.client.get(&url).send().await?;
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("market fetch failed: {}", body));
        }
        Ok(resp.json().await?)
    }

    /// Search markets
    pub async fn search(&self, query: &str) -> Result<Vec<Value>> {
        let url = format!("{}/public-search?query={}", GAMMA_BASE, urlencoding::encode(query));
        let resp = self.client.get(&url).send().await?;
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("search failed: {}", body));
        }
        let v: Value = resp.json().await?;
        // The search endpoint may return different structures
        Ok(v.get("markets").and_then(|m| m.as_array()).cloned()
            .or_else(|| v.as_array().cloned())
            .unwrap_or_default())
    }

    // ─── Events ───

    /// Fetch events with pagination
    pub async fn events(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
        active: Option<bool>,
        closed: Option<bool>,
        order: Option<&str>,
        ascending: Option<bool>,
        tag: Option<&str>,
    ) -> Result<Vec<Value>> {
        let mut params = Vec::new();
        params.push(format!("limit={}", limit.unwrap_or(50)));
        if let Some(o) = offset { params.push(format!("offset={}", o)); }
        if let Some(a) = active { params.push(format!("active={}", a)); }
        if let Some(c) = closed { params.push(format!("closed={}", c)); }
        if let Some(ord) = order { params.push(format!("order={}", ord)); }
        if let Some(asc) = ascending { params.push(format!("ascending={}", asc)); }
        if let Some(t) = tag { params.push(format!("tag={}", t)); }

        let url = format!("{}/events?{}", GAMMA_BASE, params.join("&"));
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("events fetch failed: {}", body));
        }

        let v: Value = resp.json().await?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    /// Get a single event by ID
    pub async fn event(&self, event_id: &str) -> Result<Value> {
        let url = format!("{}/events/{}", GAMMA_BASE, event_id);
        let resp = self.client.get(&url).send().await?;
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("event fetch failed: {}", body));
        }
        Ok(resp.json().await?)
    }

    /// Get all tags/categories
    pub async fn tags(&self) -> Result<Vec<Value>> {
        let url = format!("{}/tags", GAMMA_BASE);
        let resp = self.client.get(&url).send().await?;
        let v: Value = resp.json().await?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    // ─── Simplified Data ───

    /// Get simplified market list (lighter payload)
    pub async fn simplified_markets(&self, limit: Option<u32>) -> Result<Vec<Value>> {
        let url = format!("{}/markets/simplified?limit={}", GAMMA_BASE, limit.unwrap_or(100));
        let resp = self.client.get(&url).send().await?;
        let v: Value = resp.json().await?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    // ─── Trending / Volume ───

    /// Get markets sorted by volume (trending)
    pub async fn trending(&self, limit: Option<u32>) -> Result<Vec<Value>> {
        self.markets(limit, None, Some(true), Some(false), Some("volume"), Some(false)).await
    }

    /// Get markets by liquidity
    pub async fn by_liquidity(&self, limit: Option<u32>) -> Result<Vec<Value>> {
        self.markets(limit, None, Some(true), Some(false), Some("liquidity"), Some(false)).await
    }

    /// Get markets ending soon
    pub async fn ending_soon(&self, limit: Option<u32>) -> Result<Vec<Value>> {
        self.markets(limit, None, Some(true), Some(false), Some("end_date"), Some(true)).await
    }
}

// Need urlencoding for query params
mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut result = String::new();
        for byte in s.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    result.push(byte as char);
                }
                _ => {
                    result.push_str(&format!("%{:02X}", byte));
                }
            }
        }
        result
    }
}
