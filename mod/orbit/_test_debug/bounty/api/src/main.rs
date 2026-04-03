mod api;
mod db;
mod models;
mod scrapers;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::info;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let port: u16 = std::env::args()
        .nth(1)
        .and_then(|p| p.parse().ok())
        .unwrap_or(4242);

    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let db_path = PathBuf::from(&home).join(".mod").join("bounty").join("bounty.db");

    info!("[INIT] Database: {}", db_path.display());

    let conn = db::init_db(db_path).expect("Failed to initialize database");
    let db = Arc::new(Mutex::new(conn));
    let scraper_mgr = Arc::new(scrapers::ScraperManager::new());

    // Background scrape loop
    let bg_db = db.clone();
    let bg_mgr = scraper_mgr.clone();
    tokio::spawn(async move {
        let interval_mins: u64 = std::env::var("SCRAPE_INTERVAL_MINS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        // Initial scrape on startup
        info!("[SCRAPE] Running initial scrape...");
        let results = bg_mgr.run_all(&bg_db).await;
        for (source, result) in &results {
            match result {
                Ok(count) => info!("[SCRAPE] {} -> {} bounties", source, count),
                Err(e) => info!("[SCRAPE] {} -> error: {}", source, e),
            }
        }

        // Then loop
        loop {
            tokio::time::sleep(Duration::from_secs(interval_mins * 60)).await;
            info!("[SCRAPE] Running scheduled scrape...");
            bg_mgr.run_all(&bg_db).await;
        }
    });

    let state = api::AppState {
        db,
        scraper: scraper_mgr,
    };

    let app = api::router(state);

    info!("  ____                   _           _   _             _            ");
    info!(" | __ )  ___  _   _ _ __ | |_ _   _  | | | |_   _ _ __ | |_ ___ _ __ ");
    info!(" |  _ \\ / _ \\| | | | '_ \\| __| | | | | |_| | | | | '_ \\| __/ _ \\ '__|");
    info!(" | |_) | (_) | |_| | | | | |_| |_| | |  _  | |_| | | | | ||  __/ |   ");
    info!(" |____/ \\___/ \\__,_|_| |_|\\__|\\__, | |_| |_|\\__,_|_| |_|\\__\\___|_|   ");
    info!("                              |___/                                    ");
    info!("[SERVER] Listening on 0.0.0.0:{}", port);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .expect("Failed to bind");
    axum::serve(listener, app).await.expect("Server failed");
}
