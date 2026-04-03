use crate::models::*;
use rusqlite::{params, Connection, Result as SqlResult};
use std::path::PathBuf;

pub fn init_db(db_path: PathBuf) -> SqlResult<Connection> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let conn = Connection::open(db_path)?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS bounties (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            source_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            url TEXT NOT NULL,
            reward_amount REAL,
            reward_token TEXT,
            reward_usd REAL,
            status TEXT DEFAULT 'open',
            skills TEXT DEFAULT '[]',
            chain TEXT,
            project_name TEXT,
            deadline INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            scraped_at INTEGER NOT NULL,
            UNIQUE(source, source_id)
        );

        CREATE INDEX IF NOT EXISTS idx_bounties_source ON bounties(source);
        CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
        CREATE INDEX IF NOT EXISTS idx_bounties_reward ON bounties(reward_usd);
        CREATE INDEX IF NOT EXISTS idx_bounties_scraped ON bounties(scraped_at);

        CREATE TABLE IF NOT EXISTS scrape_runs (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            started_at INTEGER NOT NULL,
            finished_at INTEGER,
            bounties_found INTEGER DEFAULT 0,
            status TEXT DEFAULT 'running',
            error TEXT
        );
        ",
    )?;

    Ok(conn)
}

pub fn upsert_bounty(conn: &Connection, b: &Bounty) -> SqlResult<()> {
    let skills_json = serde_json::to_string(&b.skills).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "INSERT INTO bounties (id, source, source_id, title, description, url,
            reward_amount, reward_token, reward_usd, status, skills, chain,
            project_name, deadline, created_at, updated_at, scraped_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
         ON CONFLICT(source, source_id) DO UPDATE SET
            title=excluded.title, description=excluded.description, url=excluded.url,
            reward_amount=excluded.reward_amount, reward_token=excluded.reward_token,
            reward_usd=excluded.reward_usd, status=excluded.status, skills=excluded.skills,
            chain=excluded.chain, project_name=excluded.project_name, deadline=excluded.deadline,
            updated_at=excluded.updated_at, scraped_at=excluded.scraped_at",
        params![
            b.id,
            b.source.to_string(),
            b.source_id,
            b.title,
            b.description,
            b.url,
            b.reward_amount,
            b.reward_token,
            b.reward_usd,
            b.status.to_string(),
            skills_json,
            b.chain,
            b.project_name,
            b.deadline,
            b.created_at,
            b.updated_at,
            b.scraped_at,
        ],
    )?;
    Ok(())
}

pub fn query_bounties(conn: &Connection, filters: &BountyFilters) -> SqlResult<Vec<Bounty>> {
    let mut sql = String::from("SELECT * FROM bounties WHERE 1=1");
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref source) = filters.source {
        sql.push_str(" AND source = ?");
        param_values.push(Box::new(source.clone()));
    }
    if let Some(ref token) = filters.token {
        sql.push_str(" AND reward_token = ?");
        param_values.push(Box::new(token.clone()));
    }
    if let Some(min) = filters.min_reward {
        sql.push_str(" AND reward_usd >= ?");
        param_values.push(Box::new(min));
    }
    if let Some(max) = filters.max_reward {
        sql.push_str(" AND reward_usd <= ?");
        param_values.push(Box::new(max));
    }
    if let Some(ref status) = filters.status {
        sql.push_str(" AND status = ?");
        param_values.push(Box::new(status.clone()));
    }
    if let Some(ref chain) = filters.chain {
        sql.push_str(" AND chain = ?");
        param_values.push(Box::new(chain.clone()));
    }
    if let Some(ref search) = filters.search {
        sql.push_str(" AND (title LIKE ? OR description LIKE ?)");
        let pattern = format!("%{}%", search);
        param_values.push(Box::new(pattern.clone()));
        param_values.push(Box::new(pattern));
    }
    if let Some(ref skills) = filters.skills {
        for skill in skills.split(',') {
            sql.push_str(" AND skills LIKE ?");
            param_values.push(Box::new(format!("%\"{}%", skill.trim())));
        }
    }

    match filters.sort.as_deref() {
        Some("reward_asc") => sql.push_str(" ORDER BY reward_usd ASC NULLS LAST"),
        Some("reward_desc") => sql.push_str(" ORDER BY reward_usd DESC NULLS LAST"),
        Some("deadline") => sql.push_str(" ORDER BY deadline ASC NULLS LAST"),
        _ => sql.push_str(" ORDER BY scraped_at DESC"),
    }

    let limit = filters.limit.unwrap_or(50).min(200);
    let offset = filters.offset.unwrap_or(0);
    sql.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));

    let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_ref.as_slice(), |row| row_to_bounty(row))?;

    let mut bounties = Vec::new();
    for r in rows {
        bounties.push(r?);
    }
    Ok(bounties)
}

pub fn get_bounty_by_id(conn: &Connection, id: &str) -> SqlResult<Option<Bounty>> {
    let mut stmt = conn.prepare("SELECT * FROM bounties WHERE id = ?1")?;
    let mut rows = stmt.query_map(params![id], |row| row_to_bounty(row))?;
    match rows.next() {
        Some(Ok(b)) => Ok(Some(b)),
        _ => Ok(None),
    }
}

pub fn get_stats(conn: &Connection) -> SqlResult<Stats> {
    let total_bounties: u64 = conn
        .query_row("SELECT COUNT(*) FROM bounties", [], |row| row.get(0))
        .unwrap_or(0);

    let open_bounties: u64 = conn
        .query_row(
            "SELECT COUNT(*) FROM bounties WHERE status = 'open'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_value_usd: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(reward_usd), 0) FROM bounties WHERE status = 'open'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let mut by_source = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT source, COUNT(*), COALESCE(SUM(reward_usd), 0) FROM bounties GROUP BY source",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SourceStats {
                source: row.get(0)?,
                count: row.get(1)?,
                total_usd: row.get(2)?,
            })
        })?;
        for r in rows {
            by_source.push(r?);
        }
    }

    let mut by_chain = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT chain, COUNT(*) FROM bounties WHERE chain IS NOT NULL GROUP BY chain ORDER BY COUNT(*) DESC LIMIT 20",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ChainStats {
                chain: row.get(0)?,
                count: row.get(1)?,
            })
        })?;
        for r in rows {
            by_chain.push(r?);
        }
    }

    let mut top_tokens = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT reward_token, COUNT(*), COALESCE(SUM(reward_amount), 0) FROM bounties WHERE reward_token IS NOT NULL GROUP BY reward_token ORDER BY COUNT(*) DESC LIMIT 10",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(TokenStats {
                token: row.get(0)?,
                count: row.get(1)?,
                total_amount: row.get(2)?,
            })
        })?;
        for r in rows {
            top_tokens.push(r?);
        }
    }

    Ok(Stats {
        total_bounties,
        open_bounties,
        total_value_usd,
        by_source,
        by_chain,
        top_tokens,
    })
}

pub fn get_source_info(conn: &Connection) -> SqlResult<Vec<SourceInfo>> {
    let sources = vec!["gitcoin", "immunefi", "github", "bountytargets"];
    let mut infos = Vec::new();

    for source in sources {
        let count: u64 = conn
            .query_row(
                "SELECT COUNT(*) FROM bounties WHERE source = ?1",
                params![source],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let last_run: Option<(i64, String, Option<String>)> = conn
            .query_row(
                "SELECT finished_at, status, error FROM scrape_runs WHERE source = ?1 ORDER BY started_at DESC LIMIT 1",
                params![source],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .ok();

        infos.push(SourceInfo {
            name: source.to_string(),
            enabled: true,
            last_scraped: last_run.as_ref().map(|r| r.0),
            bounty_count: count,
            status: last_run
                .as_ref()
                .map(|r| r.1.clone())
                .unwrap_or_else(|| "pending".to_string()),
            error: last_run.and_then(|r| r.2),
        });
    }
    Ok(infos)
}

pub fn record_scrape_start(conn: &Connection, id: &str, source: &str, started_at: i64) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO scrape_runs (id, source, started_at, status) VALUES (?1, ?2, ?3, 'running')",
        params![id, source, started_at],
    )?;
    Ok(())
}

pub fn record_scrape_end(
    conn: &Connection,
    id: &str,
    finished_at: i64,
    count: u64,
    status: &str,
    error: Option<&str>,
) -> SqlResult<()> {
    conn.execute(
        "UPDATE scrape_runs SET finished_at = ?1, bounties_found = ?2, status = ?3, error = ?4 WHERE id = ?5",
        params![finished_at, count, status, error, id],
    )?;
    Ok(())
}

fn row_to_bounty(row: &rusqlite::Row) -> rusqlite::Result<Bounty> {
    let skills_str: String = row.get("skills")?;
    let skills: Vec<String> =
        serde_json::from_str(&skills_str).unwrap_or_default();
    let source_str: String = row.get("source")?;
    let status_str: String = row.get("status")?;

    Ok(Bounty {
        id: row.get("id")?,
        source: BountySource::from_str(&source_str).unwrap_or(BountySource::Github),
        source_id: row.get("source_id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        url: row.get("url")?,
        reward_amount: row.get("reward_amount")?,
        reward_token: row.get("reward_token")?,
        reward_usd: row.get("reward_usd")?,
        status: BountyStatus::from_str(&status_str),
        skills,
        chain: row.get("chain")?,
        project_name: row.get("project_name")?,
        deadline: row.get("deadline")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        scraped_at: row.get("scraped_at")?,
    })
}
