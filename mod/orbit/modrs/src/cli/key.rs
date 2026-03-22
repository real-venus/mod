//! Key commands — keys, address, sign, verify

use crate::prelude::*;

pub async fn keys(m: &Mod) -> Result<()> {
    let keys = m.keys().await?;
    for key in keys {
        println!("{}", key);
    }
    Ok(())
}

pub async fn address(m: &Mod, key_name: Option<&str>) -> Result<()> {
    let address = m.address(key_name).await?;
    println!("{}", address);
    Ok(())
}

pub async fn sign(m: &Mod, data: &str, key_name: Option<&str>) -> Result<()> {
    let data_value: serde_json::Value = serde_json::from_str(data)?;
    let sig = m.sign(&data_value, key_name).await?;
    println!("{}", serde_json::to_string_pretty(&sig)?);
    Ok(())
}

pub async fn verify(m: &Mod, data: &str, signature: &str, address: &str) -> Result<()> {
    let data_value: serde_json::Value = serde_json::from_str(data)?;
    let sig: crate::key::Signature = serde_json::from_str(signature)?;
    let valid = m.verify(&data_value, &sig, address).await?;
    println!("Valid: {}", valid);
    Ok(())
}
