//! Server commands — serve, servers, kill

use crate::prelude::*;

pub async fn serve(m: &Mod, module: &str, port: u16) -> Result<()> {
    println!("Starting {} server on port {}...", module, port);
    m.serve(module, port).await?;
    println!("Server is running. Press Ctrl+C to stop.");
    tokio::signal::ctrl_c().await?;
    Ok(())
}

pub async fn servers(m: &Mod) -> Result<()> {
    let servers = m.servers().await;
    for s in servers {
        println!("{}: {} ({})", s.name, s.url, s.port);
    }
    Ok(())
}

pub async fn kill(m: &Mod, module: &str) -> Result<()> {
    m.kill(module).await?;
    println!("Server '{}' stopped", module);
    Ok(())
}
