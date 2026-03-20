use std::sync::RwLock;
use chrono::Utc;

use crate::types::WatchedWallet;

pub struct WatchlistManager {
    wallets: RwLock<Vec<WatchedWallet>>,
    data_path: String,
}

impl WatchlistManager {
    pub fn new(data_path: &str) -> Self {
        let manager = Self {
            wallets: RwLock::new(Vec::new()),
            data_path: data_path.to_string(),
        };
        manager.load();
        manager
    }

    fn file_path(&self) -> String {
        format!("{}/watchlist.json", self.data_path)
    }

    fn load(&self) {
        let path = self.file_path();
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(wallets) = serde_json::from_str::<Vec<WatchedWallet>>(&data) {
                *self.wallets.write().unwrap() = wallets;
            }
        }
    }

    fn save(&self) {
        let wallets = self.wallets.read().unwrap();
        if let Ok(json) = serde_json::to_string_pretty(&*wallets) {
            let _ = std::fs::write(self.file_path(), json);
        }
    }

    pub fn get_watchlist(&self) -> Vec<WatchedWallet> {
        self.wallets.read().unwrap().clone()
    }

    pub fn add_wallet(&self, address: String, nickname: Option<String>) -> WatchedWallet {
        let addr = address.to_lowercase();
        let wallet = WatchedWallet {
            address: addr,
            nickname,
            added_at: Utc::now(),
            last_synced: None,
        };
        let mut wallets = self.wallets.write().unwrap();
        // Don't add duplicates
        if !wallets.iter().any(|w| w.address == wallet.address) {
            wallets.push(wallet.clone());
        }
        drop(wallets);
        self.save();
        wallet
    }

    pub fn remove_wallet(&self, address: &str) -> bool {
        let addr = address.to_lowercase();
        let mut wallets = self.wallets.write().unwrap();
        let before = wallets.len();
        wallets.retain(|w| w.address != addr);
        let removed = wallets.len() < before;
        drop(wallets);
        if removed {
            self.save();
        }
        removed
    }

    pub fn update_sync_time(&self, address: &str) {
        let addr = address.to_lowercase();
        let mut wallets = self.wallets.write().unwrap();
        if let Some(w) = wallets.iter_mut().find(|w| w.address == addr) {
            w.last_synced = Some(Utc::now());
        }
        drop(wallets);
        self.save();
    }

    pub fn exists(&self, address: &str) -> bool {
        let addr = address.to_lowercase();
        self.wallets.read().unwrap().iter().any(|w| w.address == addr)
    }
}
