//! Basic ModRS example

use modrs::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    println!("ModRS Basic Example\n");

    // Create mod instance
    let m = Mod::new().await?;
    println!("✓ Mod initialized");

    // List modules
    let mods = m.mods().await?;
    println!("✓ Found {} modules", mods.len());

    // Generate a key
    let key = m.key(Some("example")).await?;
    let address = key.ethereum_address();
    println!("✓ Generated key with address: {}", address);

    // Sign and verify
    let data = json!({"message": "Hello, ModRS!"});
    let signature = m.sign(&data, Some("example")).await?;
    println!("✓ Signed data");

    let valid = m.verify(&data, &signature, &address).await?;
    println!("✓ Signature valid: {}", valid);

    // Storage operations
    let test_value = json!({"name": "ModRS", "version": "0.1.0"});
    m.put("test_key", &test_value, false).await?;
    println!("✓ Stored value");

    let retrieved: Option<serde_json::Value> = m.get("test_key", false).await?;
    println!("✓ Retrieved value: {}", retrieved.unwrap());

    // Encryption
    let secret = b"This is a secret message";
    let encrypted = m.encrypt(secret, Some("example")).await?;
    println!("✓ Encrypted: {} bytes", encrypted.len());

    let decrypted = m.decrypt(&encrypted, Some("example")).await?;
    println!("✓ Decrypted: {}", String::from_utf8_lossy(&decrypted));

    // System info
    let time = m.time();
    println!("✓ Current timestamp: {}", time);

    // Hash data
    let hash = m.hash(b"ModRS", "sha256")?;
    println!("✓ SHA256 hash: {}", hash);

    println!("\n✅ All basic operations successful!");

    Ok(())
}
