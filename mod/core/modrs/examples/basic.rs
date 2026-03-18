//! Basic usage of the Mod API
//!
//! Run: cargo run --example basic

use modrs::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    // initialize mod
    let m = Mod::new().await?;

    // list all modules
    let mods = m.mods().await?;
    println!("modules: {:?}", mods);

    // call a module function
    let result = m.call("example/hello", json!({"name": "mod"})).await?;
    println!("result: {}", result);

    // get module info
    let info = m.info("example").await?;
    println!("info: {:?}", info);

    // view source code
    let code = m.code("example").await?;
    println!("code:\n{}", code);

    Ok(())
}
