//! Git commands — push, clone, repos

use crate::prelude::*;

pub async fn push(m: &Mod, message: &str) -> Result<()> {
    m.push(message).await?;
    println!("Changes committed and pushed");
    Ok(())
}

pub async fn clone(m: &Mod, url: &str, dest: Option<String>) -> Result<()> {
    let dest = dest.unwrap_or_else(|| {
        url.split('/').last().unwrap_or("repo").to_string()
    });
    m.clone(url, dest.as_str()).await?;
    println!("Repository cloned to {}", dest);
    Ok(())
}

pub async fn repos(m: &Mod) -> Result<()> {
    let repos = m.repos().await?;
    for repo in repos {
        println!("{}", repo);
    }
    Ok(())
}
