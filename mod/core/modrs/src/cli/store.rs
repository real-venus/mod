//! Store commands — put, get (kv) + ipfs-add, ipfs-cat, ipfs-pin, ...

use crate::prelude::*;

// ── KV (SQLite) ────────────────────────────────────────────────────────

pub fn put(m: &Mod, key: &str, value: &str, encrypt: bool) -> Result<()> {
    let value: serde_json::Value = serde_json::from_str(value)?;
    m.put(key, &value, encrypt)?;
    println!("Stored '{}'", key);
    Ok(())
}

pub fn get(m: &Mod, key: &str, decrypt: bool) -> Result<()> {
    let value: Option<serde_json::Value> = m.get(key, decrypt)?;
    match value {
        Some(v) => println!("{}", serde_json::to_string_pretty(&v)?),
        None => println!("Key '{}' not found", key),
    }
    Ok(())
}

// ── IPFS ───────────────────────────────────────────────────────────────

pub async fn ipfs_add(m: &Mod, data: &str) -> Result<()> {
    let cid = m.ipfs_add(data.as_bytes()).await?;
    println!("{}", cid);
    println!("  -> {}", m.ipfs_url(&cid));
    Ok(())
}

pub async fn ipfs_cat(m: &Mod, cid: &str) -> Result<()> {
    let data = m.ipfs_cat(cid).await?;
    match String::from_utf8(data.clone()) {
        Ok(text) => println!("{}", text),
        Err(_) => println!("<binary data: {} bytes>", data.len()),
    }
    Ok(())
}

pub async fn ipfs_pin(m: &Mod, cid: &str) -> Result<()> {
    m.ipfs_pin(cid).await?;
    println!("Pinned {}", cid);
    Ok(())
}

pub async fn ipfs_unpin(m: &Mod, cid: &str) -> Result<()> {
    m.ipfs_unpin(cid).await?;
    println!("Unpinned {}", cid);
    Ok(())
}

pub async fn ipfs_pins(m: &Mod) -> Result<()> {
    let pins = m.ipfs_pins().await?;
    for cid in pins {
        println!("{}", cid);
    }
    Ok(())
}

pub async fn ipfs_stat(m: &Mod, cid: &str) -> Result<()> {
    let stat = m.ipfs_stat(cid).await?;
    println!("{}", serde_json::to_string_pretty(&stat)?);
    Ok(())
}

pub async fn ipfs_status(m: &Mod) -> Result<()> {
    if m.ipfs_online().await {
        let store = m.store();
        println!("IPFS online ({})", store.ipfs.endpoint());
    } else {
        println!("IPFS offline — is the daemon running?");
    }
    Ok(())
}
