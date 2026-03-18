//! Module commands — mods, info, code, fns, call, new, rm, dp

use crate::prelude::*;

pub async fn mods(m: &Mod, search: Option<String>) -> Result<()> {
    let mut mods = m.mods().await?;
    if let Some(term) = search {
        mods.retain(|name| name.contains(&term));
    }
    for name in mods {
        println!("{}", name);
    }
    Ok(())
}

pub async fn info(m: &Mod, name: &str) -> Result<()> {
    let info = m.info(name).await?;
    println!("{}", serde_json::to_string_pretty(&info)?);
    Ok(())
}

pub async fn code(m: &Mod, name: &str) -> Result<()> {
    let code = m.code(name).await?;
    println!("{}", code);
    Ok(())
}

pub async fn dp(m: &Mod, name: &str) -> Result<()> {
    let path = m.dirpath(name).await?;
    println!("{}", path.display());
    Ok(())
}

pub async fn fns(m: &Mod, name: &str) -> Result<()> {
    let module = m.module(name).await?;
    let fns = module.functions().await?;
    for func in fns {
        println!("{}", func);
    }
    Ok(())
}

pub async fn call(m: &Mod, path: &str, params_str: &str) -> Result<()> {
    let params: serde_json::Value = serde_json::from_str(params_str)?;
    let result = m.call(path, params).await?;
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}

pub fn new(m: &Mod, name: &str, description: Option<&str>) -> Result<()> {
    let path = m.create_mod(name, description)?;
    println!("Created module '{}' at {}", name, path.display());
    println!("  -> {}/mod.rs (one struct, edit to add functions)", path.display());
    Ok(())
}

pub fn rm(m: &Mod, name: &str, force: bool) -> Result<()> {
    if !force {
        println!("Remove module '{}'? This deletes the entire folder.", name);
        println!("Run with --force to confirm.");
        return Ok(());
    }
    m.remove_mod(name)?;
    println!("Removed module '{}'", name);
    Ok(())
}
