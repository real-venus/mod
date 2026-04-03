use super::{BountyScraper, ScraperError};
use crate::models::{Bounty, BountySource, BountyStatus};
use async_trait::async_trait;
use regex::Regex;
use serde::Deserialize;

pub struct GithubScraper {
    client: reqwest::Client,
    token: Option<String>,
}

impl GithubScraper {
    pub fn new(client: reqwest::Client) -> Self {
        let token = std::env::var("GITHUB_TOKEN").ok();
        Self { client, token }
    }
}

#[derive(Debug, Deserialize)]
struct GithubSearchResponse {
    items: Option<Vec<GithubIssue>>,
    total_count: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct GithubIssue {
    id: Option<u64>,
    number: Option<u64>,
    title: Option<String>,
    body: Option<String>,
    html_url: Option<String>,
    state: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
    labels: Option<Vec<GithubLabel>>,
    repository_url: Option<String>,
    user: Option<GithubUser>,
}

#[derive(Debug, Deserialize)]
struct GithubLabel {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubUser {
    login: Option<String>,
}

struct ParsedReward {
    amount: f64,
    token: String,
}

fn parse_reward(text: &str) -> Option<ParsedReward> {
    let patterns = [
        // $500, $1,000, $50.00
        (r"\$\s*([\d,]+(?:\.\d+)?)", "USD"),
        // 500 USDC, 1000 USDT, 50 DAI
        (r"([\d,]+(?:\.\d+)?)\s*(?:USDC|USDT|DAI|BUSD)", "USDC"),
        // 0.5 ETH, 1 ETH, 10 ETH
        (r"([\d,]+(?:\.\d+)?)\s*ETH", "ETH"),
        // 0.01 BTC, 1 BTC
        (r"([\d,]+(?:\.\d+)?)\s*BTC", "BTC"),
        // 500 MATIC, 1000 MATIC
        (r"([\d,]+(?:\.\d+)?)\s*(?:MATIC|POL)", "MATIC"),
        // 100 SOL
        (r"([\d,]+(?:\.\d+)?)\s*SOL", "SOL"),
        // Generic crypto mentions with amounts
        (r"(?:reward|bounty|prize|payout)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)", "USD"),
    ];

    for (pattern, token) in &patterns {
        if let Ok(re) = Regex::new(&format!("(?i){}", pattern)) {
            if let Some(caps) = re.captures(text) {
                if let Some(amount_str) = caps.get(1) {
                    let cleaned = amount_str.as_str().replace(',', "");
                    if let Ok(amount) = cleaned.parse::<f64>() {
                        if amount > 0.0 && amount < 10_000_000.0 {
                            return Some(ParsedReward {
                                amount,
                                token: token.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
    None
}

fn estimate_usd(amount: f64, token: &str) -> Option<f64> {
    // Rough estimates for USD conversion - these are ballpark for filtering purposes
    match token {
        "USD" | "USDC" | "USDT" | "DAI" | "BUSD" => Some(amount),
        "ETH" => Some(amount * 3000.0),
        "BTC" => Some(amount * 60000.0),
        "MATIC" | "POL" => Some(amount * 0.5),
        "SOL" => Some(amount * 150.0),
        _ => None,
    }
}

fn extract_skills(labels: &[GithubLabel], body: &str) -> Vec<String> {
    let mut skills = Vec::new();

    for label in labels {
        if let Some(name) = &label.name {
            let lower = name.to_lowercase();
            if !["bounty", "bug", "help wanted", "good first issue"].contains(&lower.as_str()) {
                skills.push(lower);
            }
        }
    }

    let skill_keywords = [
        "solidity", "rust", "python", "javascript", "typescript", "react",
        "go", "golang", "cairo", "move", "vyper", "huff",
        "smart contract", "frontend", "backend", "devops", "security",
        "audit", "defi", "nft", "dao", "bridge", "oracle",
    ];

    let body_lower = body.to_lowercase();
    for kw in &skill_keywords {
        if body_lower.contains(kw) && !skills.contains(&kw.to_string()) {
            skills.push(kw.to_string());
        }
    }

    skills.truncate(10);
    skills
}

#[async_trait]
impl BountyScraper for GithubScraper {
    fn name(&self) -> &str {
        "github"
    }

    fn source(&self) -> BountySource {
        BountySource::Github
    }

    async fn scrape(&self) -> Result<Vec<Bounty>, ScraperError> {
        let queries = vec![
            "label:bounty state:open crypto OR ethereum OR solidity OR web3",
            "label:bounty state:open reward OR payout OR prize",
            "\"bug bounty\" state:open label:bounty",
        ];

        let mut all_bounties = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();

        for query in queries {
            let mut req = self
                .client
                .get("https://api.github.com/search/issues")
                .query(&[
                    ("q", query),
                    ("sort", "updated"),
                    ("order", "desc"),
                    ("per_page", "100"),
                ])
                .header("Accept", "application/vnd.github.v3+json");

            if let Some(ref token) = self.token {
                req = req.header("Authorization", format!("Bearer {}", token));
            }

            let resp = req.send().await?;

            if resp.status() == reqwest::StatusCode::FORBIDDEN
                || resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS
            {
                tracing::warn!("[GITHUB] Rate limited, stopping");
                break;
            }

            if !resp.status().is_success() {
                continue;
            }

            let search: GithubSearchResponse = resp
                .json()
                .await
                .map_err(|e| ScraperError::Parse(e.to_string()))?;

            let now = chrono::Utc::now().timestamp();

            for issue in search.items.unwrap_or_default() {
                let issue_id = match issue.id {
                    Some(id) => id,
                    None => continue,
                };

                if !seen_ids.insert(issue_id) {
                    continue;
                }

                let title = match &issue.title {
                    Some(t) if !t.is_empty() => t.clone(),
                    _ => continue,
                };

                let body = issue.body.clone().unwrap_or_default();
                let full_text = format!("{} {}", title, body);

                let reward = parse_reward(&full_text);
                let labels = issue.labels.unwrap_or_default();
                let skills = extract_skills(&labels, &body);

                // Extract repo name from repository_url
                let project = issue.repository_url.as_ref().and_then(|url| {
                    url.split('/').last().map(|s| s.to_string())
                });

                let created = issue.created_at.as_ref().and_then(|d| {
                    chrono::DateTime::parse_from_rfc3339(d)
                        .ok()
                        .map(|dt| dt.timestamp())
                }).unwrap_or(now);

                all_bounties.push(Bounty {
                    id: uuid::Uuid::new_v4().to_string(),
                    source: BountySource::Github,
                    source_id: issue_id.to_string(),
                    title,
                    description: body.chars().take(2000).collect(),
                    url: issue.html_url.unwrap_or_default(),
                    reward_amount: reward.as_ref().map(|r| r.amount),
                    reward_token: reward.as_ref().map(|r| r.token.clone()),
                    reward_usd: reward.as_ref().and_then(|r| estimate_usd(r.amount, &r.token)),
                    status: BountyStatus::Open,
                    skills,
                    chain: None,
                    project_name: project,
                    deadline: None,
                    created_at: created,
                    updated_at: now,
                    scraped_at: now,
                });
            }

            // Rate limit courtesy delay between queries
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }

        Ok(all_bounties)
    }
}
