//! AI integration (OpenRouter)

use crate::config::Config;
use crate::error::{ModError, Result};

pub struct OpenRouterClient {
    api_key: String,
    model: String,
    client: reqwest::Client,
}

impl OpenRouterClient {
    pub fn new(config: &Config) -> Result<Self> {
        let ai_config = config.ai.as_ref()
            .ok_or_else(|| ModError::Config("AI configuration not found".to_string()))?;

        let api_key = std::env::var(&ai_config.api_key_env)
            .map_err(|_| ModError::MissingEnvVar(ai_config.api_key_env.clone()))?;

        let model = ai_config.model.clone()
            .unwrap_or_else(|| "anthropic/claude-3.5-sonnet".to_string());

        Ok(Self {
            api_key,
            model,
            client: reqwest::Client::new(),
        })
    }

    pub async fn ask(&self, prompt: &str) -> Result<String> {
        let request_body = serde_json::json!({
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        });

        let response = self.client
            .post("https://openrouter.ai/api/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(ModError::Network(
                response.error_for_status().unwrap_err()
            ));
        }

        let result: serde_json::Value = response.json().await?;

        let content = result["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| ModError::Unknown("Invalid API response".to_string()))?;

        Ok(content.to_string())
    }
}
