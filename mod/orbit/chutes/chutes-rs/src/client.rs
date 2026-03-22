use std::sync::Arc;
use std::time::Duration;

use futures::Stream;
use reqwest::{header, Client};
use tokio::sync::Semaphore;

use crate::error::ChutesError;
use crate::streaming::parse_sse_stream;
use crate::types::*;

pub struct ChutesClient {
    http: Client,
    api_key: String,
    base_url: String,
    semaphore: Arc<Semaphore>,
}

impl ChutesClient {
    pub fn new(config: &EngineConfig) -> Self {
        let http = Client::builder()
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(90))
            .timeout(Duration::from_secs(120))
            .tcp_keepalive(Duration::from_secs(60))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            http,
            api_key: config.api_key.clone(),
            base_url: config.base_url.clone(),
            semaphore: Arc::new(Semaphore::new(100)),
        }
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.api_key)
    }

    /// Non-streaming chat completion.
    pub async fn chat_completion(
        &self,
        messages: Vec<Message>,
        model: &str,
        temperature: f32,
        max_tokens: u32,
    ) -> Result<ChatResponse, ChutesError> {
        let _permit = self.semaphore.acquire().await.unwrap();

        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": false,
        });

        let response = self
            .http
            .post(&url)
            .header(header::AUTHORIZATION, self.auth_header())
            .header(header::CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChutesError::Api(format!("{}: {}", status, text)));
        }

        Ok(response.json().await?)
    }

    /// Streaming chat completion - returns an SSE stream of ChatDelta.
    pub async fn chat_stream(
        &self,
        messages: Vec<Message>,
        model: &str,
        temperature: f32,
        max_tokens: u32,
    ) -> Result<impl Stream<Item = Result<ChatDelta, ChutesError>>, ChutesError> {
        let _permit = self.semaphore.acquire().await.unwrap();

        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": true,
        });

        let response = self
            .http
            .post(&url)
            .header(header::AUTHORIZATION, self.auth_header())
            .header(header::CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChutesError::Api(format!("{}: {}", status, text)));
        }

        Ok(parse_sse_stream(response.bytes_stream()))
    }

    /// Image generation.
    pub async fn image_generation(
        &self,
        prompt: &str,
        model: &str,
        size: &str,
        n: u32,
    ) -> Result<ImageResponse, ChutesError> {
        let _permit = self.semaphore.acquire().await.unwrap();

        let url = format!("{}/v1/images/generations", self.base_url);
        let mut body = serde_json::json!({
            "prompt": prompt,
            "n": n,
            "size": size,
        });
        if !model.is_empty() {
            body["model"] = serde_json::Value::String(model.to_string());
        }

        let response = self
            .http
            .post(&url)
            .header(header::AUTHORIZATION, self.auth_header())
            .header(header::CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChutesError::Api(format!("{}: {}", status, text)));
        }

        Ok(response.json().await?)
    }

    /// List chutes.
    pub async fn list_chutes(&self) -> Result<serde_json::Value, ChutesError> {
        let _permit = self.semaphore.acquire().await.unwrap();

        let url = format!("{}/chutes/", self.base_url);
        let response = self
            .http
            .get(&url)
            .header(header::AUTHORIZATION, self.auth_header())
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChutesError::Api(format!("{}: {}", status, text)));
        }

        Ok(response.json().await?)
    }

    /// Get chute by ID.
    pub async fn get_chute(&self, chute_id: &str) -> Result<serde_json::Value, ChutesError> {
        let _permit = self.semaphore.acquire().await.unwrap();

        let url = format!("{}/chutes/{}", self.base_url, chute_id);
        let response = self
            .http
            .get(&url)
            .header(header::AUTHORIZATION, self.auth_header())
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChutesError::Api(format!("{}: {}", status, text)));
        }

        Ok(response.json().await?)
    }

    /// Deploy a chute.
    pub async fn deploy_chute(
        &self,
        config: ChuteConfig,
    ) -> Result<serde_json::Value, ChutesError> {
        let _permit = self.semaphore.acquire().await.unwrap();

        let url = format!("{}/chutes/", self.base_url);
        let response = self
            .http
            .post(&url)
            .header(header::AUTHORIZATION, self.auth_header())
            .header(header::CONTENT_TYPE, "application/json")
            .json(&config)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChutesError::Api(format!("{}: {}", status, text)));
        }

        Ok(response.json().await?)
    }

    /// Delete a chute.
    pub async fn delete_chute(&self, chute_id: &str) -> Result<String, ChutesError> {
        let _permit = self.semaphore.acquire().await.unwrap();

        let url = format!("{}/chutes/{}", self.base_url, chute_id);
        let response = self
            .http
            .delete(&url)
            .header(header::AUTHORIZATION, self.auth_header())
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChutesError::Api(format!("{}: {}", status, text)));
        }

        Ok(response.text().await.unwrap_or_else(|_| r#"{"status":"deleted"}"#.to_string()))
    }

    /// Warmup a chute.
    pub async fn warmup(&self, chute_id: &str) -> Result<serde_json::Value, ChutesError> {
        let _permit = self.semaphore.acquire().await.unwrap();

        let url = format!("{}/chutes/warmup/{}", self.base_url, chute_id);
        let response = self
            .http
            .get(&url)
            .header(header::AUTHORIZATION, self.auth_header())
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChutesError::Api(format!("{}: {}", status, text)));
        }

        Ok(response.json().await?)
    }

    /// Get utilization metrics.
    pub async fn utilization(&self) -> Result<serde_json::Value, ChutesError> {
        let _permit = self.semaphore.acquire().await.unwrap();

        let url = format!("{}/chutes/utilization", self.base_url);
        let response = self
            .http
            .get(&url)
            .header(header::AUTHORIZATION, self.auth_header())
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChutesError::Api(format!("{}: {}", status, text)));
        }

        Ok(response.json().await?)
    }

    /// Batch chat completions - runs concurrently.
    pub async fn batch_chat(
        &self,
        messages_list: Vec<Vec<Message>>,
        model: &str,
        temperature: f32,
        max_tokens: u32,
    ) -> Result<Vec<String>, ChutesError> {
        let mut handles = Vec::new();

        for messages in messages_list {
            let client = self.http.clone();
            let url = format!("{}/v1/chat/completions", self.base_url);
            let auth = self.auth_header();
            let model = model.to_string();
            let sem = self.semaphore.clone();

            handles.push(tokio::spawn(async move {
                let _permit = sem.acquire().await.unwrap();
                let body = serde_json::json!({
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": false,
                });

                let response = client
                    .post(&url)
                    .header(header::AUTHORIZATION, &auth)
                    .header(header::CONTENT_TYPE, "application/json")
                    .json(&body)
                    .send()
                    .await
                    .map_err(ChutesError::Http)?;

                if !response.status().is_success() {
                    let text = response.text().await.unwrap_or_default();
                    return Err(ChutesError::Api(text));
                }

                let resp: ChatResponse = response.json().await.map_err(ChutesError::Http)?;
                let content = resp
                    .choices
                    .first()
                    .map(|c| c.message.content.clone())
                    .unwrap_or_default();
                Ok(content)
            }));
        }

        let mut results = Vec::new();
        for handle in handles {
            match handle.await {
                Ok(Ok(content)) => results.push(content),
                Ok(Err(e)) => results.push(format!("error: {}", e)),
                Err(e) => results.push(format!("task error: {}", e)),
            }
        }

        Ok(results)
    }
}
