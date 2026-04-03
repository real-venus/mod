use super::{BountyScraper, ScraperError};
use crate::models::{Bounty, BountySource, BountyStatus};
use async_trait::async_trait;
use serde::Deserialize;

pub struct GitcoinScraper {
    client: reqwest::Client,
}

impl GitcoinScraper {
    pub fn new(client: reqwest::Client) -> Self {
        Self { client }
    }
}

#[derive(Debug, Deserialize)]
struct GitcoinBounty {
    pk: Option<u64>,
    title: Option<String>,
    body: Option<String>,
    url: Option<String>,
    github_url: Option<String>,
    value_in_token: Option<f64>,
    token_name: Option<String>,
    value_in_usdt: Option<f64>,
    status: Option<String>,
    experience_level: Option<String>,
    project_length: Option<String>,
    bounty_type: Option<String>,
    keywords: Option<Vec<String>>,
    web3_created: Option<String>,
    expires_date: Option<String>,
    bounty_owner_github_username: Option<String>,
    network: Option<String>,
}

#[async_trait]
impl BountyScraper for GitcoinScraper {
    fn name(&self) -> &str {
        "gitcoin"
    }

    fn source(&self) -> BountySource {
        BountySource::Gitcoin
    }

    async fn scrape(&self) -> Result<Vec<Bounty>, ScraperError> {
        let mut all_bounties = Vec::new();
        let mut offset = 0;
        let limit = 50;

        loop {
            let url = format!(
                "https://gitcoin.co/api/v0.1/bounties/?is_open=true&offset={}&limit={}&order_by=-_val_usd_db",
                offset, limit
            );

            let resp = self.client.get(&url).send().await?;

            if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                return Err(ScraperError::RateLimit);
            }

            if !resp.status().is_success() {
                // Gitcoin API might be down or deprecated - return what we have
                break;
            }

            let items: Vec<GitcoinBounty> = match resp.json().await {
                Ok(v) => v,
                Err(e) => {
                    if all_bounties.is_empty() {
                        return Err(ScraperError::Parse(e.to_string()));
                    }
                    break;
                }
            };

            if items.is_empty() {
                break;
            }

            let now = chrono::Utc::now().timestamp();

            for item in &items {
                let title = match &item.title {
                    Some(t) if !t.is_empty() => t.clone(),
                    _ => continue,
                };

                let source_id = item.pk.map(|p| p.to_string()).unwrap_or_default();
                if source_id.is_empty() {
                    continue;
                }

                let bounty_url = item
                    .url
                    .clone()
                    .or_else(|| item.github_url.clone())
                    .unwrap_or_default();

                let status = match item.status.as_deref() {
                    Some("open") => BountyStatus::Open,
                    Some("started") => BountyStatus::InProgress,
                    Some("submitted") | Some("done") => BountyStatus::Completed,
                    Some("expired") | Some("cancelled") => BountyStatus::Expired,
                    _ => BountyStatus::Open,
                };

                let skills = item.keywords.clone().unwrap_or_default();

                let chain = item.network.clone().map(|n| n.to_lowercase());

                let deadline = item.expires_date.as_ref().and_then(|d| {
                    chrono::DateTime::parse_from_rfc3339(d)
                        .ok()
                        .map(|dt| dt.timestamp())
                });

                let created = item.web3_created.as_ref().and_then(|d| {
                    chrono::DateTime::parse_from_rfc3339(d)
                        .ok()
                        .map(|dt| dt.timestamp())
                }).unwrap_or(now);

                all_bounties.push(Bounty {
                    id: uuid::Uuid::new_v4().to_string(),
                    source: BountySource::Gitcoin,
                    source_id,
                    title,
                    description: item.body.clone().unwrap_or_default().chars().take(2000).collect(),
                    url: bounty_url,
                    reward_amount: item.value_in_token,
                    reward_token: item.token_name.clone(),
                    reward_usd: item.value_in_usdt,
                    status,
                    skills,
                    chain,
                    project_name: item.bounty_owner_github_username.clone(),
                    deadline,
                    created_at: created,
                    updated_at: now,
                    scraped_at: now,
                });
            }

            offset += limit;
            if items.len() < limit as usize || offset >= 500 {
                break;
            }
        }

        Ok(all_bounties)
    }
}
