//! Utility commands — hash, sysinfo, test, ask, time

use crate::prelude::*;

pub fn hash(m: &Mod, data: &str, mode: &str) -> Result<()> {
    let hash = m.hash(data.as_bytes(), mode)?;
    println!("{}", hash);
    Ok(())
}

pub fn test(module: Option<&str>) -> Result<()> {
    if let Some(mod_name) = module {
        println!("Running tests for {}...", mod_name);
    } else {
        println!("Running all tests...");
    }
    Ok(())
}

pub fn sysinfo() -> Result<()> {
    let info = crate::utils::system_info();
    println!("{}", serde_json::to_string_pretty(&info)?);
    Ok(())
}

pub fn time(mode: &str) -> Result<()> {
    let t = crate::utils::time(mode);
    println!("{}", t);
    Ok(())
}

#[cfg(feature = "ai")]
pub async fn ask(m: &Mod, prompt: &str) -> Result<()> {
    println!("Asking AI...");
    let response = m.ask(prompt).await?;
    println!("\n{}\n", response);
    Ok(())
}
