//! Create and use a new module programmatically
//!
//! Run: cargo run --example create_mod

use modrs::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    let m = Mod::new().await?;

    // create a new module
    let path = m.create_mod("demo", Some("demo module created from example"))?;
    println!("created module at: {}", path.display());

    // list modules — should include "demo"
    let mods = m.mods().await?;
    println!("modules: {:?}", mods);

    // get info
    let info = m.info("demo").await?;
    println!("info: {}", serde_json::to_string_pretty(&info)?);

    // view the generated source
    let code = m.code("demo").await?;
    println!("generated code:\n{}", code);

    // clean up
    m.remove_mod("demo")?;
    println!("removed demo");

    Ok(())
}
