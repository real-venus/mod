//! Module commands — mods, info, code, fns, call, new, rm, dp, tree, search, content, files, schema

use crate::prelude::*;

pub async fn mods(m: &Mod, search: Option<String>) -> Result<()> {
    let mods = m.mods(search.as_deref()).await?;
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
    let fns = m.fns(name).await?;
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

/// Show the module tree
pub fn tree(m: &Mod, search: Option<String>) -> Result<()> {
    let tree = m.tree(search.as_deref());
    let mut entries: Vec<(String, std::path::PathBuf)> = tree.into_iter().collect();
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    for (name, path) in entries {
        println!("  {} → {}", name, m.relpath(&path));
    }
    Ok(())
}

/// Search for modules
pub fn search(m: &Mod, query: &str) -> Result<()> {
    let results = m.search(query);
    if results.is_empty() {
        println!("No modules found matching '{}'", query);
        return Ok(());
    }
    let mut entries: Vec<(String, std::path::PathBuf)> = results.into_iter().collect();
    entries.sort_by(|a, b| a.0.len().cmp(&b.0.len()));
    for (name, path) in entries {
        println!("  {} → {}", name, m.relpath(&path));
    }
    Ok(())
}

/// Show module content map (file → content preview)
pub async fn content(m: &Mod, name: &str) -> Result<()> {
    let content = m.content(name).await?;
    for (path, text) in &content {
        let lines = text.lines().count();
        let size = text.len();
        println!("  {} ({} lines, {} bytes)", path, lines, size);
    }
    println!("\n{} files total", content.len());
    Ok(())
}

/// List module files
pub async fn files(m: &Mod, name: &str) -> Result<()> {
    let files = m.content_files(name).await?;
    for f in files {
        println!("  {}", f);
    }
    Ok(())
}

/// Show function schemas for a module
pub async fn schema(m: &Mod, name: &str) -> Result<()> {
    let fns = m.fns(name).await?;
    let code = m.code(name).await?;
    println!("Module: {}", name);
    println!("Functions:");
    for func in &fns {
        // Extract function signature from source
        for line in code.lines() {
            let trimmed = line.trim();
            if (trimmed.contains(&format!("fn {}(", func))
                || trimmed.contains(&format!("def {}(", func)))
                && !trimmed.starts_with("//")
                && !trimmed.starts_with('#')
            {
                println!("  {}", trimmed);
                break;
            }
        }
    }
    Ok(())
}

/// List directory
pub fn ls(path: Option<&str>, search: Option<&str>) -> Result<()> {
    let path = path.unwrap_or("./");
    let entries = crate::utils::ls(&crate::utils::abspath(path), search);
    for entry in entries {
        let name = entry.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        let suffix = if entry.is_dir() { "/" } else { "" };
        println!("  {}{}", name, suffix);
    }
    Ok(())
}

/// Read a file
pub fn text(path: &str) -> Result<()> {
    let content = crate::utils::text(&crate::utils::abspath(path))?;
    println!("{}", content);
    Ok(())
}

/// Show env vars
pub fn env(key: Option<&str>) -> Result<()> {
    let val = crate::utils::env(key);
    match &val {
        serde_json::Value::Object(map) => {
            for (k, v) in map {
                println!("{}={}", k, v.as_str().unwrap_or(""));
            }
        }
        _ => println!("{}", val),
    }
    Ok(())
}

/// Show owner address
pub async fn owner(m: &Mod) -> Result<()> {
    let addr = m.owner().await?;
    println!("{}", addr);
    Ok(())
}

/// Refresh module tree
pub fn update(m: &Mod) -> Result<()> {
    let result = m.update();
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}

/// Read README for a module
pub async fn readme(m: &Mod, name: &str) -> Result<()> {
    match m.readme(name).await? {
        Some(content) => println!("{}", content),
        None => println!("No README found for '{}'", name),
    }
    Ok(())
}

/// Show module size
pub async fn size(m: &Mod, name: &str) -> Result<()> {
    let size = m.size(name).await?;
    println!("{} bytes", size);
    Ok(())
}
