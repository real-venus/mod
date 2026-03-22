//! Claude Job Manager — spawn and manage background Claude CLI processes

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for JobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobStatus::Pending => write!(f, "pending"),
            JobStatus::Running => write!(f, "running"),
            JobStatus::Completed => write!(f, "completed"),
            JobStatus::Failed => write!(f, "failed"),
            JobStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl JobStatus {
    pub fn from_str(s: &str) -> Self {
        match s {
            "running" => Self::Running,
            "completed" => Self::Completed,
            "failed" => Self::Failed,
            "cancelled" => Self::Cancelled,
            _ => Self::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeJob {
    pub id: String,
    pub prompt: String,
    pub model: String,
    pub work_dir: String,
    pub status: JobStatus,
    pub output: String,
    pub error: Option<String>,
    pub pid: Option<u32>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitRequest {
    pub prompt: String,
    #[serde(default = "default_model")]
    pub model: String,
    pub work_dir: Option<String>,
}

fn default_model() -> String {
    "sonnet".to_string()
}

// ── SQLite Job Store ─────────────────────────────────────────────────

struct JobStore {
    db_path: PathBuf,
}

impl JobStore {
    fn new(db_path: PathBuf) -> Self {
        let store = Self { db_path };
        store.init_db();
        store
    }

    fn conn(&self) -> Connection {
        Connection::open(&self.db_path).expect("SQLite open failed")
    }

    fn init_db(&self) {
        let conn = self.conn();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS claude_jobs (
                id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                model TEXT NOT NULL DEFAULT 'sonnet',
                work_dir TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                output TEXT NOT NULL DEFAULT '',
                error TEXT,
                pid INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_jobs_status ON claude_jobs(status);
            CREATE INDEX IF NOT EXISTS idx_jobs_created ON claude_jobs(created_at DESC);",
        )
        .expect("SQLite init failed");
    }

    fn insert(&self, job: &ClaudeJob) {
        let conn = self.conn();
        conn.execute(
            "INSERT INTO claude_jobs (id, prompt, model, work_dir, status, output, error, pid, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                job.id, job.prompt, job.model, job.work_dir,
                job.status.to_string(), job.output, job.error, job.pid,
                job.created_at, job.updated_at
            ],
        )
        .expect("SQLite insert failed");
    }

    fn update_status(&self, id: &str, status: &JobStatus, error: Option<&str>) {
        let conn = self.conn();
        let now = Utc::now().timestamp();
        conn.execute(
            "UPDATE claude_jobs SET status = ?1, error = ?2, updated_at = ?3 WHERE id = ?4",
            params![status.to_string(), error, now, id],
        )
        .ok();
    }

    fn update_pid(&self, id: &str, pid: u32) {
        let conn = self.conn();
        let now = Utc::now().timestamp();
        conn.execute(
            "UPDATE claude_jobs SET pid = ?1, status = 'running', updated_at = ?2 WHERE id = ?3",
            params![pid, now, id],
        )
        .ok();
    }

    fn append_output(&self, id: &str, text: &str) {
        let conn = self.conn();
        let now = Utc::now().timestamp();
        conn.execute(
            "UPDATE claude_jobs SET output = output || ?1, updated_at = ?2 WHERE id = ?3",
            params![text, now, id],
        )
        .ok();
    }

    fn get(&self, id: &str) -> Option<ClaudeJob> {
        let conn = self.conn();
        let mut stmt = conn
            .prepare("SELECT id, prompt, model, work_dir, status, output, error, pid, created_at, updated_at FROM claude_jobs WHERE id = ?1")
            .ok()?;

        stmt.query_row(params![id], |row| {
            Ok(ClaudeJob {
                id: row.get(0)?,
                prompt: row.get(1)?,
                model: row.get(2)?,
                work_dir: row.get(3)?,
                status: JobStatus::from_str(&row.get::<_, String>(4)?),
                output: row.get(5)?,
                error: row.get(6)?,
                pid: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .ok()
    }

    fn list(&self) -> Vec<ClaudeJob> {
        let conn = self.conn();
        let mut stmt = conn
            .prepare("SELECT id, prompt, model, work_dir, status, output, error, pid, created_at, updated_at FROM claude_jobs ORDER BY created_at DESC LIMIT 100")
            .unwrap();

        stmt.query_map([], |row| {
            Ok(ClaudeJob {
                id: row.get(0)?,
                prompt: row.get(1)?,
                model: row.get(2)?,
                work_dir: row.get(3)?,
                status: JobStatus::from_str(&row.get::<_, String>(4)?),
                output: row.get(5)?,
                error: row.get(6)?,
                pid: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    }

    fn delete(&self, id: &str) {
        let conn = self.conn();
        conn.execute("DELETE FROM claude_jobs WHERE id = ?1", params![id]).ok();
    }

    fn mark_stale_running_as_failed(&self) {
        let conn = self.conn();
        let now = Utc::now().timestamp();
        conn.execute(
            "UPDATE claude_jobs SET status = 'failed', error = 'Server restarted', updated_at = ?1 WHERE status = 'running' OR status = 'pending'",
            params![now],
        )
        .ok();
    }
}

// ── Job Manager ──────────────────────────────────────────────────────

pub struct ClaudeJobManager {
    store: Arc<JobStore>,
    streams: Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>,
    claude_bin: String,
}

impl ClaudeJobManager {
    pub fn new(db_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&db_dir).ok();
        let db_path = db_dir.join("claude_jobs.db");
        let store = JobStore::new(db_path);
        let claude_bin = which_claude().unwrap_or_else(|| "claude".to_string());

        Ok(Self {
            store: Arc::new(store),
            streams: Arc::new(RwLock::new(HashMap::new())),
            claude_bin,
        })
    }

    pub fn recover_stale_jobs(&self) -> Result<(), String> {
        self.store.mark_stale_running_as_failed();
        Ok(())
    }

    pub async fn submit(&self, req: SubmitRequest) -> ClaudeJob {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().timestamp();
        let work_dir = req.work_dir.unwrap_or_else(|| {
            std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string())
        });

        let job = ClaudeJob {
            id: id.clone(),
            prompt: req.prompt.clone(),
            model: req.model.clone(),
            work_dir: work_dir.clone(),
            status: JobStatus::Pending,
            output: String::new(),
            error: None,
            pid: None,
            created_at: now,
            updated_at: now,
        };

        self.store.insert(&job);

        // Create broadcast channel for live streaming
        let (tx, _) = broadcast::channel::<String>(4096);
        {
            let mut streams = self.streams.write().await;
            streams.insert(id.clone(), tx.clone());
        }

        // Spawn the process
        let store = Arc::clone(&self.store);
        let streams = Arc::clone(&self.streams);
        let claude_bin = self.claude_bin.clone();
        let job_id = id.clone();
        let prompt = req.prompt;
        let model = req.model;

        tokio::spawn(async move {
            run_claude_process(&job_id, &prompt, &model, &work_dir, &claude_bin, store, streams, tx).await;
        });

        self.store.get(&id).unwrap_or(job)
    }

    pub fn list_jobs(&self) -> Vec<ClaudeJob> {
        self.store.list()
    }

    pub fn get_job(&self, id: &str) -> Option<ClaudeJob> {
        self.store.get(id)
    }

    pub fn delete_job(&self, id: &str) {
        self.store.delete(id);
    }

    pub async fn cancel_job(&self, id: &str) -> Result<(), String> {
        let job = self.store.get(id).ok_or_else(|| format!("Job {} not found", id))?;

        if job.status == JobStatus::Running {
            if let Some(pid) = job.pid {
                #[cfg(unix)]
                unsafe {
                    libc::kill(pid as i32, libc::SIGTERM);
                }
            }
        }

        self.store.update_status(id, &JobStatus::Cancelled, None);
        let mut streams = self.streams.write().await;
        streams.remove(id);
        Ok(())
    }

    pub async fn subscribe(&self, id: &str) -> Option<broadcast::Receiver<String>> {
        let streams = self.streams.read().await;
        streams.get(id).map(|tx| tx.subscribe())
    }
}

// ── Process Runner ───────────────────────────────────────────────────

async fn run_claude_process(
    job_id: &str,
    prompt: &str,
    model: &str,
    work_dir: &str,
    claude_bin: &str,
    store: Arc<JobStore>,
    streams: Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>,
    tx: broadcast::Sender<String>,
) {
    let mut cmd = Command::new(claude_bin);
    cmd.arg("--print")
        .arg("--model")
        .arg(model)
        .arg("--output-format")
        .arg("text")
        .arg("--dangerously-skip-permissions")
        .arg(prompt)
        .current_dir(work_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let err = format!("Failed to spawn claude: {}", e);
            store.update_status(job_id, &JobStatus::Failed, Some(&err));
            tx.send(format!("[ERROR] {}\n", err)).ok();
            return;
        }
    };

    let pid = child.id().unwrap_or(0);
    store.update_pid(job_id, pid);

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let store_out = Arc::clone(&store);
    let tx_out = tx.clone();
    let id_out = job_id.to_string();

    let stdout_task = tokio::spawn(async move {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            let text = format!("{}\n", line);
            store_out.append_output(&id_out, &text);
            tx_out.send(text).ok();
        }
    });

    let store_err = Arc::clone(&store);
    let tx_err = tx.clone();
    let id_err = job_id.to_string();

    let stderr_task = tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            let text = format!("{}\n", line);
            store_err.append_output(&id_err, &text);
            tx_err.send(text).ok();
        }
    });

    let _ = stdout_task.await;
    let _ = stderr_task.await;

    // Wait for exit status
    let status = child.wait().await;
    match status {
        Ok(exit) if exit.success() => {
            store.update_status(job_id, &JobStatus::Completed, None);
        }
        Ok(exit) => {
            let code = exit.code().unwrap_or(-1);
            store.update_status(job_id, &JobStatus::Failed, Some(&format!("Exit code: {}", code)));
        }
        Err(e) => {
            store.update_status(job_id, &JobStatus::Failed, Some(&format!("Wait error: {}", e)));
        }
    }

    tx.send("[DONE]\n".to_string()).ok();

    // Clean up
    let mut s = streams.write().await;
    s.remove(job_id);
}

fn which_claude() -> Option<String> {
    std::process::Command::new("which")
        .arg("claude")
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
            } else {
                None
            }
        })
}
