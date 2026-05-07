// Disk-backed JSON store with in-memory cache + atomic writes.
//
// We hold a write-lock on each on-disk file using parking_lot; reads are cheap
// because the data fits in memory (at most ~100k snapshot entries / a few
// thousand claims). Writes go through a temp file + rename to prevent
// partial writes on crash.

use anyhow::Context;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    io::Write,
    path::PathBuf,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claim {
    pub amount: f64,
    pub recipient: String,
    pub from: String,
    pub timestamp: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commitment {
    pub source_address: String,
    pub evm_address: String,
    pub source_type: String,
    pub timestamp: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_evm: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chain: Option<serde_json::Value>,
}

pub struct Store {
    snapshot: HashMap<String, f64>,
    claims: RwLock<HashMap<String, Claim>>,
    commitments: RwLock<HashMap<String, Commitment>>,
    used_sigs: RwLock<HashSet<String>>,

    claims_path: PathBuf,
    commitments_path: PathBuf,
    used_sigs_path: PathBuf,
}

impl Store {
    pub fn open(
        snapshot_path: &PathBuf,
        claims_path: PathBuf,
        commitments_path: PathBuf,
        used_sigs_path: PathBuf,
    ) -> anyhow::Result<Self> {
        let snapshot_raw: HashMap<String, serde_json::Value> = if snapshot_path.exists() {
            let s = std::fs::read_to_string(snapshot_path)
                .with_context(|| format!("read snapshot {}", snapshot_path.display()))?;
            serde_json::from_str(&s)
                .with_context(|| format!("parse snapshot {}", snapshot_path.display()))?
        } else {
            tracing::warn!("snapshot not found at {}", snapshot_path.display());
            HashMap::new()
        };

        // Normalize to f64 / 1e9 (matches Python mod.py).
        let snapshot: HashMap<String, f64> = snapshot_raw
            .into_iter()
            .filter_map(|(k, v)| {
                let n = v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))?;
                Some((k, n / 1e9))
            })
            .collect();

        let claims: HashMap<String, Claim> = read_json_or_default(&claims_path)?;
        let commitments: HashMap<String, Commitment> = read_json_or_default(&commitments_path)?;
        let used_sigs: HashSet<String> = read_json_or_default(&used_sigs_path)?;

        Ok(Self {
            snapshot,
            claims: RwLock::new(claims),
            commitments: RwLock::new(commitments),
            used_sigs: RwLock::new(used_sigs),
            claims_path,
            commitments_path,
            used_sigs_path,
        })
    }

    // ── Snapshot ────────────────────────────────────────────

    pub fn snapshot_len(&self) -> usize {
        self.snapshot.len()
    }
    pub fn balance(&self, addr: &str) -> f64 {
        self.snapshot.get(addr).copied().unwrap_or(0.0)
    }
    pub fn snapshot_contains(&self, addr: &str) -> bool {
        self.snapshot.contains_key(addr)
    }
    pub fn snapshot_iter(&self) -> impl Iterator<Item = (&String, &f64)> {
        self.snapshot.iter()
    }
    pub fn snapshot_total(&self) -> f64 {
        self.snapshot.values().sum()
    }

    /// Return a sorted (deterministic) page of (address, balance) entries.
    pub fn snapshot_page(&self, page: usize, limit: usize) -> (Vec<(String, f64)>, usize) {
        let mut sorted: Vec<(&String, &f64)> = self.snapshot.iter().collect();
        sorted.sort_by(|a, b| a.0.cmp(b.0));
        let total = sorted.len();
        let start = page.saturating_mul(limit);
        if start >= total {
            return (vec![], total);
        }
        let end = (start + limit).min(total);
        let page = sorted[start..end]
            .iter()
            .map(|(k, v)| ((*k).clone(), **v))
            .collect();
        (page, total)
    }

    // ── Claims ──────────────────────────────────────────────

    pub fn has_claim(&self, addr: &str) -> bool {
        self.claims.read().contains_key(addr)
    }
    pub fn claim_amount(&self, addr: &str) -> f64 {
        self.claims
            .read()
            .get(addr)
            .map(|c| c.amount)
            .unwrap_or(0.0)
    }
    pub fn claims_total(&self) -> f64 {
        self.claims.read().values().map(|c| c.amount).sum()
    }
    pub fn claims_count(&self) -> usize {
        self.claims.read().len()
    }
    pub fn claims_clone(&self) -> HashMap<String, Claim> {
        self.claims.read().clone()
    }

    pub fn add_claim(&self, addr: &str, claim: Claim) -> anyhow::Result<()> {
        let mut g = self.claims.write();
        if g.contains_key(addr) {
            anyhow::bail!("Already claimed for {addr}");
        }
        g.insert(addr.to_string(), claim);
        write_json_atomic(&self.claims_path, &*g)
    }

    pub fn delete_claim(&self, addr: &str) -> anyhow::Result<bool> {
        let mut g = self.claims.write();
        let removed = g.remove(addr).is_some();
        if removed {
            write_json_atomic(&self.claims_path, &*g)?;
        }
        Ok(removed)
    }

    // ── Commitments ─────────────────────────────────────────

    pub fn get_commitment(&self, addr: &str) -> Option<Commitment> {
        self.commitments.read().get(addr).cloned()
    }
    pub fn commitments_clone(&self) -> HashMap<String, Commitment> {
        self.commitments.read().clone()
    }
    pub fn add_commitment(&self, addr: &str, c: Commitment) -> anyhow::Result<()> {
        let mut g = self.commitments.write();
        g.insert(addr.to_string(), c);
        write_json_atomic(&self.commitments_path, &*g)
    }

    // ── Used signatures (replay protection) ─────────────────

    pub fn is_sig_used(&self, h: &str) -> bool {
        self.used_sigs.read().contains(h)
    }

    pub fn mark_sig_used(&self, h: &str) -> anyhow::Result<()> {
        let mut g = self.used_sigs.write();
        if g.insert(h.to_string()) {
            write_json_atomic(&self.used_sigs_path, &g.iter().cloned().collect::<Vec<_>>())?;
        }
        Ok(())
    }

    // ── Reset (admin only) ──────────────────────────────────

    pub fn reset(&self) -> anyhow::Result<()> {
        {
            let mut g = self.claims.write();
            g.clear();
            write_json_atomic(&self.claims_path, &*g)?;
        }
        {
            let mut g = self.commitments.write();
            g.clear();
            write_json_atomic(&self.commitments_path, &*g)?;
        }
        {
            let mut g = self.used_sigs.write();
            g.clear();
            write_json_atomic(&self.used_sigs_path, &Vec::<String>::new())?;
        }
        Ok(())
    }
}

fn read_json_or_default<T: Default + for<'de> Deserialize<'de>>(p: &PathBuf) -> anyhow::Result<T> {
    if !p.exists() {
        return Ok(T::default());
    }
    let s = std::fs::read_to_string(p).with_context(|| format!("read {}", p.display()))?;
    if s.trim().is_empty() {
        return Ok(T::default());
    }
    Ok(serde_json::from_str(&s).with_context(|| format!("parse {}", p.display()))?)
}

fn write_json_atomic<T: Serialize>(path: &PathBuf, value: &T) -> anyhow::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("path has no parent: {}", path.display()))?;
    std::fs::create_dir_all(parent)?;

    let mut tmp = tempfile::Builder::new()
        .prefix(".bridge-")
        .suffix(".tmp")
        .tempfile_in(parent)?;
    let bytes = serde_json::to_vec_pretty(value)?;
    tmp.write_all(&bytes)?;
    tmp.flush()?;

    // Atomic rename — readers either see the old or new file, never partial.
    tmp.persist(path)
        .map_err(|e| anyhow::anyhow!("atomic rename failed: {e}"))?;
    Ok(())
}
