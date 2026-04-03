use super::{BountyScraper, ScraperError};
use crate::models::{Bounty, BountySource, BountyStatus};
use async_trait::async_trait;
use serde::Deserialize;

pub struct TargetsScraper {
    client: reqwest::Client,
}

impl TargetsScraper {
    pub fn new(client: reqwest::Client) -> Self {
        Self { client }
    }
}

#[derive(Debug, Deserialize)]
struct HackerOneProgram {
    id: Option<String>,
    handle: Option<String>,
    name: Option<String>,
    url: Option<String>,
    offers_bounties: Option<bool>,
    max_bounty: Option<f64>,
    targets: Option<Targets>,
}

#[derive(Debug, Deserialize)]
struct Targets {
    in_scope: Option<Vec<Target>>,
}

#[derive(Debug, Deserialize)]
struct Target {
    asset_type: Option<String>,
    asset_identifier: Option<String>,
    instruction: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IntigritiProgram {
    company_handle: Option<String>,
    name: Option<String>,
    max_bounty: Option<MaxBounty>,
    url: Option<String>,
    #[serde(alias = "min_bounty")]
    _min_bounty: Option<MaxBounty>,
}

#[derive(Debug, Deserialize)]
struct MaxBounty {
    value: Option<f64>,
}

fn is_crypto_related(program: &HackerOneProgram) -> bool {
    let crypto_keywords = [
        "blockchain", "crypto", "defi", "web3", "ethereum", "solana",
        "bitcoin", "token", "wallet", "smart contract", "nft", "dao",
        "bridge", "dex", "exchange", "chain", "layer2", "l2",
        "polygon", "arbitrum", "optimism", "base", "avalanche",
    ];

    let name = program.name.as_deref().unwrap_or("").to_lowercase();
    let handle = program.handle.as_deref().unwrap_or("").to_lowercase();

    let text = format!("{} {}", name, handle);

    if crypto_keywords.iter().any(|kw| text.contains(kw)) {
        return true;
    }

    // Check if any in-scope targets mention crypto-related assets
    if let Some(ref targets) = program.targets {
        if let Some(ref in_scope) = targets.in_scope {
            for target in in_scope {
                let asset = target.asset_identifier.as_deref().unwrap_or("").to_lowercase();
                let instruction = target.instruction.as_deref().unwrap_or("").to_lowercase();
                let combined = format!("{} {}", asset, instruction);
                if crypto_keywords.iter().any(|kw| combined.contains(kw)) {
                    return true;
                }
            }
        }
    }

    false
}

#[async_trait]
impl BountyScraper for TargetsScraper {
    fn name(&self) -> &str {
        "bountytargets"
    }

    fn source(&self) -> BountySource {
        BountySource::BountyTargets
    }

    async fn scrape(&self) -> Result<Vec<Bounty>, ScraperError> {
        let mut all_bounties = Vec::new();
        let now = chrono::Utc::now().timestamp();

        // Fetch HackerOne data
        let h1_url = "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data/hackerone_data.json";
        match self.client.get(h1_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                match resp.json::<Vec<HackerOneProgram>>().await {
                    Ok(programs) => {
                        for prog in programs {
                            if !prog.offers_bounties.unwrap_or(false) {
                                continue;
                            }
                            if !is_crypto_related(&prog) {
                                continue;
                            }

                            let name = match &prog.name {
                                Some(n) if !n.is_empty() => n.clone(),
                                _ => continue,
                            };

                            let handle = prog.handle.clone().unwrap_or_default();
                            let source_id = format!("h1_{}", handle);

                            let url = prog
                                .url
                                .unwrap_or_else(|| format!("https://hackerone.com/{}", handle));

                            let mut skills = vec!["security".to_string()];
                            if let Some(ref targets) = prog.targets {
                                if let Some(ref in_scope) = targets.in_scope {
                                    for target in in_scope {
                                        if let Some(ref at) = target.asset_type {
                                            let skill = at.to_lowercase();
                                            if !skills.contains(&skill) {
                                                skills.push(skill);
                                            }
                                        }
                                    }
                                }
                            }
                            skills.truncate(8);

                            all_bounties.push(Bounty {
                                id: uuid::Uuid::new_v4().to_string(),
                                source: BountySource::BountyTargets,
                                source_id,
                                title: format!("{} Bug Bounty", name),
                                description: format!(
                                    "Bug bounty program for {} on HackerOne. Max bounty: ${:.0}",
                                    name,
                                    prog.max_bounty.unwrap_or(0.0)
                                ),
                                url,
                                reward_amount: prog.max_bounty,
                                reward_token: Some("USD".to_string()),
                                reward_usd: prog.max_bounty,
                                status: BountyStatus::Open,
                                skills,
                                chain: None,
                                project_name: Some(name),
                                deadline: None,
                                created_at: now,
                                updated_at: now,
                                scraped_at: now,
                            });
                        }
                    }
                    Err(e) => tracing::warn!("[TARGETS] Failed to parse HackerOne data: {}", e),
                }
            }
            _ => tracing::warn!("[TARGETS] Failed to fetch HackerOne data"),
        }

        // Fetch Intigriti data
        let intigriti_url = "https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data/intigriti_data.json";
        match self.client.get(intigriti_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                match resp.json::<Vec<IntigritiProgram>>().await {
                    Ok(programs) => {
                        for prog in programs {
                            let name = match &prog.name {
                                Some(n) if !n.is_empty() => n.clone(),
                                _ => continue,
                            };

                            let name_lower = name.to_lowercase();
                            let crypto_keywords = [
                                "crypto", "blockchain", "defi", "web3", "token", "chain",
                                "wallet", "exchange", "nft",
                            ];
                            if !crypto_keywords.iter().any(|kw| name_lower.contains(kw)) {
                                continue;
                            }

                            let handle = prog.company_handle.clone().unwrap_or_default();
                            let source_id = format!("intigriti_{}", handle);

                            let max = prog.max_bounty.as_ref().and_then(|m| m.value);

                            all_bounties.push(Bounty {
                                id: uuid::Uuid::new_v4().to_string(),
                                source: BountySource::BountyTargets,
                                source_id,
                                title: format!("{} Bug Bounty", name),
                                description: format!(
                                    "Bug bounty program for {} on Intigriti. Max bounty: ${:.0}",
                                    name,
                                    max.unwrap_or(0.0)
                                ),
                                url: prog.url.unwrap_or_else(|| {
                                    format!("https://app.intigriti.com/programs/{}", handle)
                                }),
                                reward_amount: max,
                                reward_token: Some("USD".to_string()),
                                reward_usd: max,
                                status: BountyStatus::Open,
                                skills: vec!["security".to_string()],
                                chain: None,
                                project_name: Some(name),
                                deadline: None,
                                created_at: now,
                                updated_at: now,
                                scraped_at: now,
                            });
                        }
                    }
                    Err(e) => tracing::warn!("[TARGETS] Failed to parse Intigriti data: {}", e),
                }
            }
            _ => tracing::warn!("[TARGETS] Failed to fetch Intigriti data"),
        }

        Ok(all_bounties)
    }
}
