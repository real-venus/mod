pub mod gitcoin;
pub mod github;
pub mod immunefi;
pub mod targets;

use crate::db;
use crate::models::{Bounty, BountySource};
use async_trait::async_trait;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tracing::{error, info};

#[derive(Debug)]
pub enum ScraperError {
    Http(String),
    Parse(String),
    RateLimit,
    Other(String),
}

impl std::fmt::Display for ScraperError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Http(e) => write!(f, "HTTP error: {}", e),
            Self::Parse(e) => write!(f, "Parse error: {}", e),
            Self::RateLimit => write!(f, "Rate limited"),
            Self::Other(e) => write!(f, "{}", e),
        }
    }
}

impl From<reqwest::Error> for ScraperError {
    fn from(e: reqwest::Error) -> Self {
        ScraperError::Http(e.to_string())
    }
}

#[async_trait]
pub trait BountyScraper: Send + Sync {
    fn name(&self) -> &str;
    fn source(&self) -> BountySource;
    async fn scrape(&self) -> Result<Vec<Bounty>, ScraperError>;
}

pub struct ScraperManager {
    scrapers: Vec<Box<dyn BountyScraper>>,
}

impl ScraperManager {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("bounty-hunter/1.0")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");

        let scrapers: Vec<Box<dyn BountyScraper>> = vec![
            Box::new(gitcoin::GitcoinScraper::new(client.clone())),
            Box::new(immunefi::ImmunefiScraper::new(client.clone())),
            Box::new(github::GithubScraper::new(client.clone())),
            Box::new(targets::TargetsScraper::new(client.clone())),
        ];

        Self { scrapers }
    }

    pub async fn run_all(&self, db: &Arc<Mutex<Connection>>) -> Vec<(String, Result<u64, String>)> {
        let mut results = Vec::new();

        for scraper in &self.scrapers {
            let source_name = scraper.name().to_string();
            let run_id = uuid::Uuid::new_v4().to_string();
            let now = chrono::Utc::now().timestamp();

            {
                let conn = db.lock().unwrap();
                let _ = db::record_scrape_start(&conn, &run_id, &source_name, now);
            }

            info!("[SCRAPE] {} starting...", source_name);

            match scraper.scrape().await {
                Ok(bounties) => {
                    let count = bounties.len() as u64;
                    info!("[SCRAPE] {} found {} bounties", source_name, count);

                    let conn = db.lock().unwrap();
                    for bounty in &bounties {
                        if let Err(e) = db::upsert_bounty(&conn, bounty) {
                            error!("[DB] upsert failed: {}", e);
                        }
                    }
                    let _ = db::record_scrape_end(&conn, &run_id, chrono::Utc::now().timestamp(), count, "ok", None);
                    results.push((source_name, Ok(count)));
                }
                Err(e) => {
                    let err_msg = e.to_string();
                    error!("[SCRAPE] {} failed: {}", source_name, err_msg);
                    let conn = db.lock().unwrap();
                    let _ = db::record_scrape_end(
                        &conn,
                        &run_id,
                        chrono::Utc::now().timestamp(),
                        0,
                        "error",
                        Some(&err_msg),
                    );
                    results.push((source_name, Err(err_msg)));
                }
            }
        }

        results
    }
}
