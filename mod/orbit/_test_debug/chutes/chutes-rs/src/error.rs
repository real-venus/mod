use thiserror::Error;

#[derive(Debug, Error)]
pub enum ChutesError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("API error: {0}")]
    Api(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Stream error: {0}")]
    Stream(String),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}
