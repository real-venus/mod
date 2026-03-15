//! Git operations

use crate::error::{ModError, Result};
use git2::{Repository, Signature};
use std::path::Path;

/// Commit and push changes
pub async fn push(message: &str, repo_path: &Path) -> Result<()> {
    let repo = Repository::open(repo_path)?;

    // Get signature from git config
    let config = repo.config()?;
    let name = config.get_string("user.name").unwrap_or_else(|_| "ModRS".to_string());
    let email = config.get_string("user.email").unwrap_or_else(|_| "modrs@example.com".to_string());

    let sig = Signature::now(&name, &email)?;

    // Add all changes
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;

    // Create commit
    let oid = index.write_tree()?;
    let tree = repo.find_tree(oid)?;
    let parent_commit = repo.head()?.peel_to_commit()?;

    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        message,
        &tree,
        &[&parent_commit],
    )?;

    // Push to remote
    let mut remote = repo.find_remote("origin")?;
    remote.push(&["refs/heads/main:refs/heads/main"], None)?;

    Ok(())
}

/// Clone a repository
pub async fn clone(url: &str, dest: impl AsRef<Path>) -> Result<()> {
    Repository::clone(url, dest)?;
    Ok(())
}

/// List Git repositories in a directory
pub async fn list_repos(path: &Path) -> Result<Vec<String>> {
    let mut repos = Vec::new();

    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            let git_dir = path.join(".git");
            if git_dir.exists() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    repos.push(name.to_string());
                }
            }
        }
    }

    repos.sort();
    Ok(repos)
}
