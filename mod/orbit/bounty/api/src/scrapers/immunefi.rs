use super::{BountyScraper, ScraperError};
use crate::models::{Bounty, BountySource, BountyStatus};
use async_trait::async_trait;
use serde::Deserialize;

pub struct ImmunefiScraper {
    client: reqwest::Client,
}

impl ImmunefiScraper {
    pub fn new(client: reqwest::Client) -> Self {
        Self { client }
    }
}

#[derive(Debug, Deserialize)]
struct ImmunefiProgram {
    id: Option<String>,
    #[serde(alias = "programId")]
    program_id: Option<String>,
    #[serde(alias = "project")]
    title: Option<String>,
    description: Option<String>,
    #[serde(alias = "maxBounty")]
    max_bounty: Option<f64>,
    #[serde(alias = "updatedDate")]
    updated_date: Option<String>,
    #[serde(alias = "launchDate")]
    launch_date: Option<String>,
    technologies: Option<Vec<String>>,
    #[serde(alias = "productType")]
    product_type: Option<String>,
    ecosystem: Option<Vec<String>>,
    #[serde(alias = "programUrl")]
    program_url: Option<String>,
    slug: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ImmunefiResponse {
    #[serde(alias = "pageProps")]
    page_props: Option<PageProps>,
}

#[derive(Debug, Deserialize)]
struct PageProps {
    bounties: Option<Vec<ImmunefiProgram>>,
}

#[async_trait]
impl BountyScraper for ImmunefiScraper {
    fn name(&self) -> &str {
        "immunefi"
    }

    fn source(&self) -> BountySource {
        BountySource::Immunefi
    }

    async fn scrape(&self) -> Result<Vec<Bounty>, ScraperError> {
        // Immunefi serves their bounty list as a JSON build manifest
        // Try the known Next.js data endpoint first, fall back to scraping
        let urls = vec![
            "https://immunefi.com/api/bounties".to_string(),
            "https://immunefi.com/_next/data/bounties.json".to_string(),
        ];

        let mut programs: Vec<ImmunefiProgram> = Vec::new();

        for url in &urls {
            match self.client.get(url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    // Try parsing as direct array first
                    let text = resp.text().await.map_err(|e| ScraperError::Parse(e.to_string()))?;

                    if let Ok(direct) = serde_json::from_str::<Vec<ImmunefiProgram>>(&text) {
                        programs = direct;
                        break;
                    }

                    if let Ok(wrapped) = serde_json::from_str::<ImmunefiResponse>(&text) {
                        if let Some(pp) = wrapped.page_props {
                            if let Some(b) = pp.bounties {
                                programs = b;
                                break;
                            }
                        }
                    }

                    // Try as generic JSON and extract
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(arr) = val.as_array() {
                            programs = arr.iter().filter_map(|v| serde_json::from_value(v.clone()).ok()).collect();
                            if !programs.is_empty() {
                                break;
                            }
                        }
                    }
                }
                _ => continue,
            }
        }

        let now = chrono::Utc::now().timestamp();
        let mut bounties = Vec::new();

        for prog in programs {
            let title = match &prog.title {
                Some(t) if !t.is_empty() => t.clone(),
                _ => continue,
            };

            let source_id = prog
                .id
                .or(prog.program_id)
                .or(prog.slug.clone())
                .unwrap_or_else(|| title.to_lowercase().replace(' ', "-"));

            let url = prog
                .program_url
                .unwrap_or_else(|| {
                    let slug = prog.slug.as_deref().unwrap_or(&source_id);
                    format!("https://immunefi.com/bug-bounty/{}/", slug)
                });

            let chain = prog
                .ecosystem
                .as_ref()
                .and_then(|e| e.first().cloned())
                .map(|c| c.to_lowercase());

            let skills = prog.technologies.unwrap_or_default();

            let created = prog.launch_date.as_ref().and_then(|d| {
                chrono::DateTime::parse_from_rfc3339(d)
                    .ok()
                    .map(|dt| dt.timestamp())
            }).unwrap_or(now);

            bounties.push(Bounty {
                id: uuid::Uuid::new_v4().to_string(),
                source: BountySource::Immunefi,
                source_id,
                title: format!("{} Bug Bounty", title),
                description: prog.description.unwrap_or_default().chars().take(2000).collect(),
                url,
                reward_amount: prog.max_bounty,
                reward_token: Some("USD".to_string()),
                reward_usd: prog.max_bounty,
                status: BountyStatus::Open,
                skills,
                chain,
                project_name: Some(title),
                deadline: None, // Bug bounties are typically ongoing
                created_at: created,
                updated_at: now,
                scraped_at: now,
            });
        }

        Ok(bounties)
    }
}
