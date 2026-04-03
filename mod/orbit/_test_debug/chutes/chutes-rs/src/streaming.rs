use bytes::Bytes;
use futures::stream::{Stream, StreamExt};

use crate::error::ChutesError;
use crate::types::ChatDelta;

/// Parse an SSE byte stream into a stream of ChatDelta objects.
/// Handles `data: {...}\n\n` format and skips `data: [DONE]`.
pub fn parse_sse_stream(
    byte_stream: impl Stream<Item = Result<Bytes, reqwest::Error>>,
) -> impl Stream<Item = Result<ChatDelta, ChutesError>> {
    let mut buffer = String::new();

    byte_stream
        .map(move |chunk_result| {
            match chunk_result {
                Err(e) => vec![Err(ChutesError::Stream(e.to_string()))],
                Ok(bytes) => {
                    buffer.push_str(&String::from_utf8_lossy(&bytes));
                    let mut deltas = Vec::new();

                    while let Some(idx) = buffer.find("\n\n") {
                        let event: String = buffer.drain(..idx + 2).collect();

                        for line in event.lines() {
                            if let Some(data) = line.strip_prefix("data: ") {
                                if data == "[DONE]" {
                                    continue;
                                }
                                match serde_json::from_str::<ChatDelta>(data) {
                                    Ok(delta) => deltas.push(Ok(delta)),
                                    Err(e) => deltas.push(Err(ChutesError::Parse(
                                        format!("{}: {}", e, data),
                                    ))),
                                }
                            }
                        }
                    }

                    deltas
                }
            }
        })
        .flat_map(futures::stream::iter)
}
