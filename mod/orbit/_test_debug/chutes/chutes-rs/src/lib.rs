use pyo3::exceptions::PyRuntimeError;
use pyo3::prelude::*;
use std::sync::Arc;

mod client;
mod error;
mod streaming;
mod types;

use client::ChutesClient;
use types::EngineConfig;

#[pyclass]
pub struct ChutesEngine {
    runtime: tokio::runtime::Runtime,
    client: Arc<ChutesClient>,
}

#[pymethods]
impl ChutesEngine {
    #[new]
    #[pyo3(signature = (config_json=None))]
    fn new(config_json: Option<&str>) -> PyResult<Self> {
        let _ = tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::from_default_env()
                    .add_directive("chutes_rs=info".parse().unwrap()),
            )
            .try_init();

        let config: EngineConfig = match config_json {
            Some(json) if !json.is_empty() && json != "{}" => serde_json::from_str(json)
                .map_err(|e| PyRuntimeError::new_err(format!("Invalid config: {}", e)))?,
            _ => EngineConfig::default(),
        };

        let runtime = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .worker_threads(4)
            .build()
            .map_err(|e| PyRuntimeError::new_err(format!("Runtime error: {}", e)))?;

        let client = Arc::new(ChutesClient::new(&config));

        Ok(Self { runtime, client })
    }

    /// Non-streaming chat completion. Returns JSON string.
    #[pyo3(signature = (messages, model, temperature=0.7, max_tokens=4096))]
    fn chat(
        &self,
        messages: &str,
        model: &str,
        temperature: f32,
        max_tokens: u32,
    ) -> PyResult<String> {
        let msgs: Vec<types::Message> = serde_json::from_str(messages)
            .map_err(|e| PyRuntimeError::new_err(format!("Invalid messages JSON: {}", e)))?;

        let client = self.client.clone();
        let model = model.to_string();

        let result = self
            .runtime
            .block_on(async move { client.chat_completion(msgs, &model, temperature, max_tokens).await });

        match result {
            Ok(response) => serde_json::to_string(&response)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Chat error: {}", e))),
        }
    }

    /// Streaming chat completion. Calls `callback(json_str)` per chunk.
    #[pyo3(signature = (messages, model, callback, temperature=0.7, max_tokens=4096))]
    fn chat_stream(
        &self,
        messages: &str,
        model: &str,
        callback: PyObject,
        temperature: f32,
        max_tokens: u32,
    ) -> PyResult<()> {
        let msgs: Vec<types::Message> = serde_json::from_str(messages)
            .map_err(|e| PyRuntimeError::new_err(format!("Invalid messages JSON: {}", e)))?;

        let client = self.client.clone();
        let model = model.to_string();

        self.runtime.block_on(async move {
            let stream = client
                .chat_stream(msgs, &model, temperature, max_tokens)
                .await
                .map_err(|e| PyRuntimeError::new_err(format!("Stream error: {}", e)))?;

            use futures::StreamExt;
            futures::pin_mut!(stream);

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(delta) => {
                        let json = serde_json::to_string(&delta).map_err(|e| {
                            PyRuntimeError::new_err(format!("Serialize error: {}", e))
                        })?;
                        Python::with_gil(|py| callback.call1(py, (json,)))?;
                    }
                    Err(e) => {
                        return Err(PyRuntimeError::new_err(format!("Stream chunk: {}", e)));
                    }
                }
            }

            Ok(())
        })
    }

    /// Image generation. Returns JSON string.
    #[pyo3(signature = (prompt, model="", size="1024x1024", n=1))]
    fn generate_image(
        &self,
        prompt: &str,
        model: &str,
        size: &str,
        n: u32,
    ) -> PyResult<String> {
        let client = self.client.clone();
        let prompt = prompt.to_string();
        let model = model.to_string();
        let size = size.to_string();

        let result = self
            .runtime
            .block_on(async move { client.image_generation(&prompt, &model, &size, n).await });

        match result {
            Ok(response) => serde_json::to_string(&response)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Image error: {}", e))),
        }
    }

    /// List chutes. Returns JSON string.
    fn list_chutes(&self) -> PyResult<String> {
        let client = self.client.clone();
        let result = self.runtime.block_on(async move { client.list_chutes().await });

        match result {
            Ok(chutes) => serde_json::to_string(&chutes)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("List error: {}", e))),
        }
    }

    /// Get chute by ID. Returns JSON string.
    fn get_chute(&self, chute_id: &str) -> PyResult<String> {
        let client = self.client.clone();
        let id = chute_id.to_string();
        let result = self.runtime.block_on(async move { client.get_chute(&id).await });

        match result {
            Ok(chute) => serde_json::to_string(&chute)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Get error: {}", e))),
        }
    }

    /// Deploy a chute. Returns JSON string.
    fn deploy_chute(&self, config_json: &str) -> PyResult<String> {
        let config: types::ChuteConfig = serde_json::from_str(config_json)
            .map_err(|e| PyRuntimeError::new_err(format!("Invalid config: {}", e)))?;

        let client = self.client.clone();
        let result = self
            .runtime
            .block_on(async move { client.deploy_chute(config).await });

        match result {
            Ok(chute) => serde_json::to_string(&chute)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Deploy error: {}", e))),
        }
    }

    /// Delete a chute. Returns JSON string.
    fn delete_chute(&self, chute_id: &str) -> PyResult<String> {
        let client = self.client.clone();
        let id = chute_id.to_string();
        let result = self
            .runtime
            .block_on(async move { client.delete_chute(&id).await });

        match result {
            Ok(response) => Ok(response),
            Err(e) => Err(PyRuntimeError::new_err(format!("Delete error: {}", e))),
        }
    }

    /// Warmup a chute. Returns JSON string.
    fn warmup(&self, chute_id: &str) -> PyResult<String> {
        let client = self.client.clone();
        let id = chute_id.to_string();
        let result = self.runtime.block_on(async move { client.warmup(&id).await });

        match result {
            Ok(response) => serde_json::to_string(&response)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Warmup error: {}", e))),
        }
    }

    /// Get utilization metrics. Returns JSON string.
    fn utilization(&self) -> PyResult<String> {
        let client = self.client.clone();
        let result = self
            .runtime
            .block_on(async move { client.utilization().await });

        match result {
            Ok(metrics) => serde_json::to_string(&metrics)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Utilization error: {}", e))),
        }
    }

    /// Batch chat completions. Returns JSON array of response strings.
    #[pyo3(signature = (messages_list_json, model, temperature=0.7, max_tokens=4096))]
    fn batch_chat(
        &self,
        messages_list_json: &str,
        model: &str,
        temperature: f32,
        max_tokens: u32,
    ) -> PyResult<String> {
        let raw_list: Vec<String> = serde_json::from_str(messages_list_json)
            .map_err(|e| PyRuntimeError::new_err(format!("Invalid messages list: {}", e)))?;

        let mut messages_list: Vec<Vec<types::Message>> = Vec::new();
        for raw in &raw_list {
            let msgs: Vec<types::Message> = serde_json::from_str(raw)
                .map_err(|e| PyRuntimeError::new_err(format!("Invalid messages: {}", e)))?;
            messages_list.push(msgs);
        }

        let client = self.client.clone();
        let model = model.to_string();

        let result = self.runtime.block_on(async move {
            client
                .batch_chat(messages_list, &model, temperature, max_tokens)
                .await
        });

        match result {
            Ok(responses) => serde_json::to_string(&responses)
                .map_err(|e| PyRuntimeError::new_err(format!("Serialize error: {}", e))),
            Err(e) => Err(PyRuntimeError::new_err(format!("Batch error: {}", e))),
        }
    }
}

#[pymodule]
fn chutes_rs(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<ChutesEngine>()?;
    Ok(())
}
