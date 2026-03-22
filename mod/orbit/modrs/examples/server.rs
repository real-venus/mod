//! Serve a module as an HTTP API
//!
//! Run: cargo run --example server
//!
//! Then call:
//!   curl -X POST http://0.0.0.0:8000/hello -H "Content-Type: application/json" -d '{"params":{"name":"world"}}'
//!   curl http://0.0.0.0:8000/info

use modrs::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    let m = Mod::new().await?;

    println!("serving example on :8000");
    println!();
    println!("  POST /hello     -> {{\"params\": {{\"name\": \"world\"}}}}");
    println!("  POST /echo      -> {{\"params\": {{\"any\": \"data\"}}}}");
    println!("  POST /status    -> {{}}");
    println!("  POST /time      -> {{}}");
    println!("  POST /transform -> {{\"params\": {{\"input\": \"hello\", \"mode\": \"upper\"}}}}");
    println!("  GET  /info      -> module info");
    println!();

    m.serve("example", 8000).await?;

    // keep running until ctrl+c
    tokio::signal::ctrl_c().await?;
    m.kill("example").await?;

    Ok(())
}
