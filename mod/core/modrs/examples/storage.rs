//! Storage operations — SQLite KV + IPFS
//!
//! Run: cargo run --example storage

use modrs::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    let m = Mod::new().await?;

    // ========================================================================
    // SQLite KV store — local, fast, persistent
    // ========================================================================

    // store a value
    m.put("user:1", &json!({"name": "alice", "role": "admin"}), false)?;
    println!("stored user:1");

    // retrieve it
    let val = m.get("user:1", false)?;
    println!("got user:1 = {:?}", val);

    // store encrypted
    m.put("secret:token", &json!("sk_live_abc123"), true)?;
    println!("stored encrypted secret:token");

    // delete
    m.delete("user:1")?;
    println!("deleted user:1");

    // ========================================================================
    // IPFS — distributed, content-addressed
    // ========================================================================

    if m.ipfs_online().await {
        // add content
        let cid = m.ipfs_add(b"hello from mod").await?;
        println!("ipfs add -> {}", cid);
        println!("  url: {}", m.ipfs_url(&cid));

        // retrieve content
        let data = m.ipfs_cat(&cid).await?;
        println!("ipfs cat -> {}", String::from_utf8_lossy(&data));

        // pin it
        m.ipfs_pin(&cid).await?;
        println!("pinned {}", cid);

        // list pins
        let pins = m.ipfs_pins().await?;
        println!("pins: {:?}", pins);
    } else {
        println!("ipfs offline — skipping ipfs examples");
    }

    Ok(())
}
