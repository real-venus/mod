//! Server example - demonstrates running a module as HTTP server

use modrs::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    println!("ModRS Server Example\n");

    let m = Mod::new().await?;
    println!("✓ Mod initialized");

    // List available modules
    println!("\nAvailable modules:");
    let mods = m.mods().await?;
    for mod_name in mods.iter().take(5) {
        println!("  - {}", mod_name);
    }

    // For this example, we'll create a simple test scenario
    // In production, you'd serve an actual module like "api"

    println!("\nNote: To serve a module, use:");
    println!("  m.serve(\"module_name\", 8000).await?");
    println!("\nOr from CLI:");
    println!("  m serve api --port 8000");

    println!("\nServer endpoints would be available at:");
    println!("  POST http://localhost:8000/:function");
    println!("  GET  http://localhost:8000/info");

    println!("\n✅ Server example complete!");

    Ok(())
}
