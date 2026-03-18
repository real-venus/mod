//! Server commands — serve, servers, kill

use crate::prelude::*;

/// Start a server as a background process (default) or foreground with --fg
pub async fn serve(m: &Mod, module: &str, port: u16, foreground: bool) -> Result<()> {
    if foreground {
        println!("Starting {} server on port {} (foreground)...", module, port);
        m.serve(module, port).await?;
        println!("Server is running. Press Ctrl+C to stop.");
        tokio::signal::ctrl_c().await?;
        Ok(())
    } else {
        println!("Starting {} server on port {} (background)...", module, port);
        m.serve_bg(module, port)?;
        println!("  -> http://0.0.0.0:{}", port);
        println!("  -> mrs kill {} to stop", module);
        Ok(())
    }
}

/// Internal: foreground server started by the background spawner
pub async fn serve_foreground(m: &Mod, module: &str, port: u16) -> Result<()> {
    let mod_instance = m.module(module).await?;
    crate::server::run_server(mod_instance, port).await
}

pub async fn servers(m: &Mod) -> Result<()> {
    let servers = m.servers().await;
    if servers.is_empty() {
        println!("No running servers");
        return Ok(());
    }
    for s in servers {
        let pid_str = s.pid.map(|p| format!(" (pid {})", p)).unwrap_or_default();
        println!("  {} → {}{}", s.name, s.url, pid_str);
    }
    Ok(())
}

pub async fn kill(m: &Mod, module: &str) -> Result<()> {
    m.kill(module).await?;
    println!("Server '{}' stopped", module);
    Ok(())
}

/// Kill all running servers
pub async fn kill_all(m: &Mod) -> Result<()> {
    let servers = m.servers().await;
    if servers.is_empty() {
        println!("No running servers");
        return Ok(());
    }
    for s in servers {
        m.kill(&s.name).await?;
        println!("Stopped '{}'", s.name);
    }
    Ok(())
}
