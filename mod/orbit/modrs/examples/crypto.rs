//! Cryptographic operations — keys, sign, verify, encrypt, decrypt
//!
//! Run: cargo run --example crypto

use modrs::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    let m = Mod::new().await?;

    // get default key address (ethereum-compatible secp256k1)
    let address = m.address(None).await?;
    println!("address: {}", address);

    // list all keys
    let keys = m.keys().await?;
    println!("keys: {:?}", keys);

    // sign some data
    let data = json!({"action": "transfer", "amount": 100});
    let signature = m.sign(&data, None).await?;
    println!("signature: {:?}", signature);

    // verify the signature
    let valid = m.verify(&data, &signature, &address).await?;
    println!("valid: {}", valid);

    // encrypt / decrypt
    let secret = b"sensitive data";
    let encrypted = m.encrypt(secret, None).await?;
    println!("encrypted: {} bytes", encrypted.len());

    let decrypted = m.decrypt(&encrypted, None).await?;
    println!("decrypted: {}", String::from_utf8_lossy(&decrypted));

    Ok(())
}
