import os
import json
import requests
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path
from datetime import datetime
import base64


class GitAgent:
    """
    GitAgent - Multi-account GitHub interface with advanced repo management

    Features:
    - Multi-account GitHub management with easy switching
    - Repository search, fork, clone operations
    - PR management with auto-merge capabilities
    - AI integration ready (Claude/Codex)
    - Smart conflict resolution
    - Better-than-GitHub interface
    """

    def __init__(self, account: Optional[str] = None):
        """
        Initialize GitAgent

        Args:
            account: Account name to use (uses default if not provided)
        """
        self.config_dir = Path.home() / '.mod' / 'gitagent'
        self.config_dir.mkdir(parents=True, exist_ok=True)

        self.accounts_file = self.config_dir / 'accounts.json'
        self.config_file = self.config_dir / 'config.json'
        self.repos_cache_file = self.config_dir / 'repos_cache.json'

        self.base_url = "https://api.github.com"
        self.current_account = None
        self.token = None
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "GitAgent-Mod",
        }

        # Load and set account
        if account:
            self.use_account(account)
        else:
            self._load_default_account()

    # ============================================
    # Account Management
    # ============================================

    def add_account(self, name: str, token: str, set_default: bool = False) -> Dict[str, Any]:
        """
        Add a GitHub account

        Args:
            name: Account identifier (e.g., "work", "personal", "bot")
            token: GitHub personal access token
            set_default: Set as default account

        Returns:
            Dict with status and user info
        """
        # Verify token
        headers = {
            **self.headers,
            "Authorization": f"token {token}"
        }

        response = requests.get(f"{self.base_url}/user", headers=headers)

        if response.status_code != 200:
            return {
                "status": "error",
                "message": "Invalid token or authentication failed",
                "code": response.status_code
            }

        user_info = response.json()

        # Load existing accounts
        accounts = self._load_accounts()

        # Add account
        accounts[name] = {
            "token": token,
            "username": user_info["login"],
            "name": user_info.get("name"),
            "email": user_info.get("email"),
            "avatar_url": user_info.get("avatar_url"),
            "created_at": datetime.now().isoformat()
        }

        # Save accounts
        with open(self.accounts_file, 'w') as f:
            json.dump(accounts, f, indent=2)

        # Set default if requested or first account
        if set_default or len(accounts) == 1:
            self._set_default_account(name)

        return {
            "status": "success",
            "account": name,
            "username": user_info["login"],
            "message": f"Account '{name}' added successfully"
        }

    def list_accounts(self) -> Dict[str, Any]:
        """List all configured accounts"""
        accounts = self._load_accounts()
        default = self._get_default_account()

        return {
            "status": "success",
            "accounts": {
                name: {
                    "username": info["username"],
                    "name": info.get("name"),
                    "email": info.get("email"),
                    "is_default": name == default,
                    "is_active": name == self.current_account
                }
                for name, info in accounts.items()
            },
            "default": default,
            "current": self.current_account
        }

    def use_account(self, name: str) -> Dict[str, Any]:
        """
        Switch to a different account

        Args:
            name: Account identifier

        Returns:
            Dict with status and account info
        """
        accounts = self._load_accounts()

        if name not in accounts:
            return {
                "status": "error",
                "message": f"Account '{name}' not found. Use add_account() first."
            }

        account = accounts[name]
        self.current_account = name
        self.token = account["token"]
        self.headers["Authorization"] = f"token {self.token}"

        return {
            "status": "success",
            "account": name,
            "username": account["username"]
        }

    def remove_account(self, name: str) -> Dict[str, Any]:
        """Remove an account"""
        accounts = self._load_accounts()

        if name not in accounts:
            return {"status": "error", "message": f"Account '{name}' not found"}

        del accounts[name]

        with open(self.accounts_file, 'w') as f:
            json.dump(accounts, f, indent=2)

        # If this was current or default, switch to another
        if name == self.current_account or name == self._get_default_account():
            if accounts:
                first_account = list(accounts.keys())[0]
                self._set_default_account(first_account)
                self.use_account(first_account)
            else:
                self.current_account = None
                self.token = None

        return {
            "status": "success",
            "message": f"Account '{name}' removed"
        }

    def _load_accounts(self) -> Dict[str, Any]:
        """Load all accounts from storage"""
        if not self.accounts_file.exists():
            return {}

        try:
            with open(self.accounts_file, 'r') as f:
                return json.load(f)
        except:
            return {}

    def _set_default_account(self, name: str):
        """Set default account"""
        config = self._load_config()
        config["default_account"] = name
        with open(self.config_file, 'w') as f:
            json.dump(config, f, indent=2)

    def _get_default_account(self) -> Optional[str]:
        """Get default account name"""
        config = self._load_config()
        return config.get("default_account")

    def _load_default_account(self):
        """Load and activate default account"""
        default = self._get_default_account()
        if default:
            self.use_account(default)

    def _load_config(self) -> Dict[str, Any]:
        """Load config"""
        if not self.config_file.exists():
            return {}
        try:
            with open(self.config_file, 'r') as f:
                return json.load(f)
        except:
            return {}

    def _check_auth(self) -> Optional[Dict[str, Any]]:
        """Check if authenticated"""
        if not self.token:
            return {
                "status": "error",
                "message": "Not authenticated. Use add_account() or use_account() first."
            }
        return None

    # ============================================
    # Repository Operations
    # ============================================

    def search_repos(
        self,
        query: str,
        sort: str = "stars",
        order: str = "desc",
        per_page: int = 30
    ) -> Dict[str, Any]:
        """
        Search GitHub repositories

        Args:
            query: Search query (e.g., "language:python stars:>100")
            sort: Sort by "stars", "forks", "updated", etc.
            order: "asc" or "desc"
            per_page: Results per page (max 100)

        Returns:
            Dict with search results
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/search/repositories"
        params = {
            "q": query,
            "sort": sort,
            "order": order,
            "per_page": per_page
        }

        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            data = response.json()
            return {
                "status": "success",
                "total_count": data["total_count"],
                "repos": [
                    {
                        "full_name": repo["full_name"],
                        "description": repo.get("description"),
                        "stars": repo["stargazers_count"],
                        "forks": repo["forks_count"],
                        "language": repo.get("language"),
                        "url": repo["html_url"],
                        "clone_url": repo["clone_url"],
                        "updated_at": repo["updated_at"]
                    }
                    for repo in data["items"]
                ]
            }

        return {
            "status": "error",
            "message": "Search failed",
            "code": response.status_code
        }

    def get_repo(self, repo: str) -> Dict[str, Any]:
        """
        Get detailed repository information

        Args:
            repo: Repository in format "owner/repo"

        Returns:
            Dict with repo details
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}"
        response = requests.get(url, headers=self.headers)

        if response.status_code == 200:
            repo_data = response.json()
            return {
                "status": "success",
                "repo": {
                    "full_name": repo_data["full_name"],
                    "description": repo_data.get("description"),
                    "stars": repo_data["stargazers_count"],
                    "forks": repo_data["forks_count"],
                    "open_issues": repo_data["open_issues_count"],
                    "language": repo_data.get("language"),
                    "default_branch": repo_data["default_branch"],
                    "clone_url": repo_data["clone_url"],
                    "ssh_url": repo_data["ssh_url"],
                    "homepage": repo_data.get("homepage"),
                    "topics": repo_data.get("topics", []),
                    "created_at": repo_data["created_at"],
                    "updated_at": repo_data["updated_at"],
                    "is_fork": repo_data["fork"],
                    "parent": repo_data.get("parent", {}).get("full_name") if repo_data["fork"] else None
                }
            }

        return {
            "status": "error",
            "message": f"Repository '{repo}' not found",
            "code": response.status_code
        }

    def list_my_repos(
        self,
        type: str = "all",
        sort: str = "updated",
        per_page: int = 100
    ) -> Dict[str, Any]:
        """
        List repositories for current account

        Args:
            type: "all", "owner", "public", "private", "member"
            sort: "created", "updated", "pushed", "full_name"
            per_page: Results per page (max 100)

        Returns:
            Dict with repo list
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/user/repos"
        params = {
            "type": type,
            "sort": sort,
            "per_page": per_page
        }

        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            repos = response.json()
            return {
                "status": "success",
                "count": len(repos),
                "repos": [
                    {
                        "full_name": repo["full_name"],
                        "description": repo.get("description"),
                        "private": repo["private"],
                        "stars": repo["stargazers_count"],
                        "forks": repo["forks_count"],
                        "language": repo.get("language"),
                        "default_branch": repo["default_branch"],
                        "updated_at": repo["updated_at"]
                    }
                    for repo in repos
                ]
            }

        return {
            "status": "error",
            "message": "Failed to list repositories",
            "code": response.status_code
        }

    def fork_repo(self, repo: str, organization: Optional[str] = None) -> Dict[str, Any]:
        """
        Fork a repository

        Args:
            repo: Repository in format "owner/repo"
            organization: Optional organization to fork to

        Returns:
            Dict with fork info
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}/forks"
        data = {}
        if organization:
            data["organization"] = organization

        response = requests.post(url, headers=self.headers, json=data if data else None)

        if response.status_code == 202:
            fork = response.json()
            return {
                "status": "success",
                "full_name": fork["full_name"],
                "clone_url": fork["clone_url"],
                "ssh_url": fork["ssh_url"],
                "url": fork["html_url"],
                "message": "Fork created successfully"
            }

        return {
            "status": "error",
            "message": response.json().get("message", "Fork failed"),
            "code": response.status_code
        }

    # ============================================
    # Pull Request Operations
    # ============================================

    def list_prs(
        self,
        repo: str,
        state: str = "open",
        sort: str = "created",
        direction: str = "desc"
    ) -> Dict[str, Any]:
        """
        List pull requests for a repository

        Args:
            repo: Repository in format "owner/repo"
            state: "open", "closed", "all"
            sort: "created", "updated", "popularity", "long-running"
            direction: "asc" or "desc"

        Returns:
            Dict with PR list
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}/pulls"
        params = {
            "state": state,
            "sort": sort,
            "direction": direction
        }

        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            prs = response.json()
            return {
                "status": "success",
                "count": len(prs),
                "prs": [
                    {
                        "number": pr["number"],
                        "title": pr["title"],
                        "state": pr["state"],
                        "user": pr["user"]["login"],
                        "url": pr["html_url"],
                        "created_at": pr["created_at"],
                        "updated_at": pr["updated_at"],
                        "head": {
                            "ref": pr["head"]["ref"],
                            "repo": pr["head"]["repo"]["full_name"] if pr["head"]["repo"] else None
                        },
                        "base": {
                            "ref": pr["base"]["ref"]
                        },
                        "mergeable": pr.get("mergeable"),
                        "draft": pr.get("draft", False)
                    }
                    for pr in prs
                ]
            }

        return {
            "status": "error",
            "message": "Failed to list PRs",
            "code": response.status_code
        }

    def get_pr(self, repo: str, pr_number: int) -> Dict[str, Any]:
        """
        Get detailed PR information

        Args:
            repo: Repository in format "owner/repo"
            pr_number: PR number

        Returns:
            Dict with PR details
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}/pulls/{pr_number}"
        response = requests.get(url, headers=self.headers)

        if response.status_code == 200:
            pr = response.json()
            return {
                "status": "success",
                "pr": {
                    "number": pr["number"],
                    "title": pr["title"],
                    "body": pr["body"],
                    "state": pr["state"],
                    "user": pr["user"]["login"],
                    "url": pr["html_url"],
                    "created_at": pr["created_at"],
                    "updated_at": pr["updated_at"],
                    "merged": pr.get("merged", False),
                    "mergeable": pr.get("mergeable"),
                    "mergeable_state": pr.get("mergeable_state"),
                    "draft": pr.get("draft", False),
                    "head": {
                        "ref": pr["head"]["ref"],
                        "sha": pr["head"]["sha"],
                        "repo": pr["head"]["repo"]["full_name"] if pr["head"]["repo"] else None
                    },
                    "base": {
                        "ref": pr["base"]["ref"],
                        "sha": pr["base"]["sha"]
                    },
                    "commits": pr.get("commits"),
                    "additions": pr.get("additions"),
                    "deletions": pr.get("deletions"),
                    "changed_files": pr.get("changed_files")
                }
            }

        return {
            "status": "error",
            "message": f"PR #{pr_number} not found",
            "code": response.status_code
        }

    def create_pr(
        self,
        repo: str,
        title: str,
        head: str,
        base: str = "main",
        body: str = "",
        draft: bool = False,
        maintainer_can_modify: bool = True
    ) -> Dict[str, Any]:
        """
        Create a pull request

        Args:
            repo: Repository in format "owner/repo"
            title: PR title
            head: Branch with changes (format: "user:branch" or just "branch")
            base: Base branch to merge into
            body: PR description
            draft: Create as draft PR
            maintainer_can_modify: Allow maintainers to edit

        Returns:
            Dict with PR info
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}/pulls"

        data = {
            "title": title,
            "head": head,
            "base": base,
            "body": body,
            "draft": draft,
            "maintainer_can_modify": maintainer_can_modify
        }

        response = requests.post(url, headers=self.headers, json=data)

        if response.status_code == 201:
            pr = response.json()
            return {
                "status": "success",
                "number": pr["number"],
                "url": pr["html_url"],
                "state": pr["state"],
                "title": pr["title"]
            }

        return {
            "status": "error",
            "message": response.json().get("message", "Failed to create PR"),
            "code": response.status_code
        }

    def merge_pr(
        self,
        repo: str,
        pr_number: int,
        commit_title: Optional[str] = None,
        commit_message: Optional[str] = None,
        merge_method: str = "merge"
    ) -> Dict[str, Any]:
        """
        Merge a pull request

        Args:
            repo: Repository in format "owner/repo"
            pr_number: PR number
            commit_title: Optional custom merge commit title
            commit_message: Optional custom merge commit message
            merge_method: "merge", "squash", or "rebase"

        Returns:
            Dict with merge result
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}/pulls/{pr_number}/merge"

        data = {"merge_method": merge_method}
        if commit_title:
            data["commit_title"] = commit_title
        if commit_message:
            data["commit_message"] = commit_message

        response = requests.put(url, headers=self.headers, json=data)

        if response.status_code == 200:
            result = response.json()
            return {
                "status": "success",
                "merged": result["merged"],
                "sha": result["sha"],
                "message": result["message"]
            }

        return {
            "status": "error",
            "message": response.json().get("message", "Merge failed"),
            "code": response.status_code
        }

    def auto_merge_prs(
        self,
        repo: str,
        merge_method: str = "merge",
        max_prs: int = 10
    ) -> Dict[str, Any]:
        """
        Auto-merge all mergeable PRs from others (not your own)

        Args:
            repo: Repository in format "owner/repo"
            merge_method: "merge", "squash", or "rebase"
            max_prs: Maximum number of PRs to auto-merge

        Returns:
            Dict with merge results
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        # Get current user
        user_response = requests.get(f"{self.base_url}/user", headers=self.headers)
        if user_response.status_code != 200:
            return {"status": "error", "message": "Failed to get user info"}

        current_user = user_response.json()["login"]

        # Get open PRs
        prs_result = self.list_prs(repo, state="open")
        if prs_result["status"] != "success":
            return prs_result

        merged = []
        failed = []
        skipped = []

        for pr in prs_result["prs"][:max_prs]:
            # Skip own PRs
            if pr["user"] == current_user:
                skipped.append({
                    "number": pr["number"],
                    "reason": "own PR"
                })
                continue

            # Skip drafts
            if pr["draft"]:
                skipped.append({
                    "number": pr["number"],
                    "reason": "draft PR"
                })
                continue

            # Get detailed PR info to check mergeable status
            pr_detail = self.get_pr(repo, pr["number"])
            if pr_detail["status"] != "success":
                failed.append({
                    "number": pr["number"],
                    "error": "Failed to get PR details"
                })
                continue

            # Check if mergeable
            if pr_detail["pr"]["mergeable"] is False:
                skipped.append({
                    "number": pr["number"],
                    "reason": "not mergeable (conflicts)"
                })
                continue

            # Attempt merge
            merge_result = self.merge_pr(repo, pr["number"], merge_method=merge_method)

            if merge_result["status"] == "success":
                merged.append({
                    "number": pr["number"],
                    "title": pr["title"],
                    "sha": merge_result["sha"]
                })
            else:
                failed.append({
                    "number": pr["number"],
                    "title": pr["title"],
                    "error": merge_result["message"]
                })

        return {
            "status": "success",
            "merged": merged,
            "failed": failed,
            "skipped": skipped,
            "summary": {
                "total_merged": len(merged),
                "total_failed": len(failed),
                "total_skipped": len(skipped)
            }
        }

    # ============================================
    # Branch Operations
    # ============================================

    def list_branches(self, repo: str) -> Dict[str, Any]:
        """
        List all branches in a repository

        Args:
            repo: Repository in format "owner/repo"

        Returns:
            Dict with branch list
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}/branches"
        response = requests.get(url, headers=self.headers)

        if response.status_code == 200:
            branches = response.json()
            return {
                "status": "success",
                "count": len(branches),
                "branches": [
                    {
                        "name": branch["name"],
                        "sha": branch["commit"]["sha"],
                        "protected": branch.get("protected", False)
                    }
                    for branch in branches
                ]
            }

        return {
            "status": "error",
            "message": "Failed to list branches",
            "code": response.status_code
        }

    def create_branch(
        self,
        repo: str,
        branch_name: str,
        from_branch: Optional[str] = None,
        from_sha: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new branch

        Args:
            repo: Repository in format "owner/repo"
            branch_name: Name for new branch
            from_branch: Branch to create from (default: repo default branch)
            from_sha: Specific SHA to create from (overrides from_branch)

        Returns:
            Dict with branch info
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        # Get SHA to branch from
        if from_sha:
            sha = from_sha
        elif from_branch:
            ref_url = f"{self.base_url}/repos/{repo}/git/ref/heads/{from_branch}"
            ref_response = requests.get(ref_url, headers=self.headers)
            if ref_response.status_code != 200:
                return {
                    "status": "error",
                    "message": f"Branch '{from_branch}' not found"
                }
            sha = ref_response.json()["object"]["sha"]
        else:
            # Get default branch
            repo_info = self.get_repo(repo)
            if repo_info["status"] != "success":
                return repo_info
            default_branch = repo_info["repo"]["default_branch"]
            ref_url = f"{self.base_url}/repos/{repo}/git/ref/heads/{default_branch}"
            ref_response = requests.get(ref_url, headers=self.headers)
            sha = ref_response.json()["object"]["sha"]

        # Create branch
        url = f"{self.base_url}/repos/{repo}/git/refs"
        data = {
            "ref": f"refs/heads/{branch_name}",
            "sha": sha
        }

        response = requests.post(url, headers=self.headers, json=data)

        if response.status_code == 201:
            return {
                "status": "success",
                "branch": branch_name,
                "sha": sha
            }

        return {
            "status": "error",
            "message": response.json().get("message", "Failed to create branch"),
            "code": response.status_code
        }

    # ============================================
    # File Operations
    # ============================================

    def get_file(
        self,
        repo: str,
        path: str,
        branch: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get file content from repository

        Args:
            repo: Repository in format "owner/repo"
            path: File path in repo
            branch: Branch name (uses default branch if not specified)

        Returns:
            Dict with file content and metadata
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}/contents/{path}"
        params = {}
        if branch:
            params["ref"] = branch

        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            file_data = response.json()

            # Decode content if it's a file
            if file_data["type"] == "file":
                content = base64.b64decode(file_data["content"]).decode('utf-8', errors='ignore')
            else:
                content = None

            return {
                "status": "success",
                "path": file_data["path"],
                "type": file_data["type"],
                "size": file_data["size"],
                "sha": file_data["sha"],
                "content": content,
                "download_url": file_data.get("download_url")
            }

        return {
            "status": "error",
            "message": f"File '{path}' not found",
            "code": response.status_code
        }

    def update_file(
        self,
        repo: str,
        path: str,
        content: str,
        message: str,
        branch: str,
        sha: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create or update a file

        Args:
            repo: Repository in format "owner/repo"
            path: File path in repo
            content: File content
            message: Commit message
            branch: Branch to commit to
            sha: File SHA if updating (get via get_file)

        Returns:
            Dict with commit info
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}/contents/{path}"

        data = {
            "message": message,
            "content": base64.b64encode(content.encode()).decode(),
            "branch": branch
        }

        if sha:
            data["sha"] = sha

        response = requests.put(url, headers=self.headers, json=data)

        if response.status_code in [200, 201]:
            result = response.json()
            return {
                "status": "success",
                "commit_sha": result["commit"]["sha"],
                "content_sha": result["content"]["sha"],
                "path": path
            }

        return {
            "status": "error",
            "message": response.json().get("message", "Failed to update file"),
            "code": response.status_code
        }

    # ============================================
    # Issues
    # ============================================

    def list_issues(
        self,
        repo: str,
        state: str = "open",
        labels: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        List issues for a repository

        Args:
            repo: Repository in format "owner/repo"
            state: "open", "closed", "all"
            labels: Filter by labels

        Returns:
            Dict with issue list
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}/issues"
        params = {"state": state}

        if labels:
            params["labels"] = ",".join(labels)

        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            issues = response.json()
            return {
                "status": "success",
                "count": len(issues),
                "issues": [
                    {
                        "number": issue["number"],
                        "title": issue["title"],
                        "state": issue["state"],
                        "user": issue["user"]["login"],
                        "labels": [label["name"] for label in issue.get("labels", [])],
                        "url": issue["html_url"],
                        "created_at": issue["created_at"],
                        "updated_at": issue["updated_at"]
                    }
                    for issue in issues
                    if "pull_request" not in issue  # Exclude PRs
                ]
            }

        return {
            "status": "error",
            "message": "Failed to list issues",
            "code": response.status_code
        }

    def create_issue(
        self,
        repo: str,
        title: str,
        body: str = "",
        labels: Optional[List[str]] = None,
        assignees: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Create an issue

        Args:
            repo: Repository in format "owner/repo"
            title: Issue title
            body: Issue description
            labels: Labels to add
            assignees: Users to assign

        Returns:
            Dict with issue info
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        url = f"{self.base_url}/repos/{repo}/issues"

        data = {
            "title": title,
            "body": body
        }

        if labels:
            data["labels"] = labels
        if assignees:
            data["assignees"] = assignees

        response = requests.post(url, headers=self.headers, json=data)

        if response.status_code == 201:
            issue = response.json()
            return {
                "status": "success",
                "number": issue["number"],
                "url": issue["html_url"],
                "title": issue["title"]
            }

        return {
            "status": "error",
            "message": response.json().get("message", "Failed to create issue"),
            "code": response.status_code
        }

    # ============================================
    # AI Integration Helpers
    # ============================================

    def prepare_for_claude(self, repo: str, files: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Prepare repository files for Claude processing

        Args:
            repo: Repository in format "owner/repo"
            files: Specific files to fetch (fetches all if None)

        Returns:
            Dict with file contents ready for AI processing
        """
        auth_check = self._check_auth()
        if auth_check:
            return auth_check

        # Get repo info
        repo_info = self.get_repo(repo)
        if repo_info["status"] != "success":
            return repo_info

        # Get file tree
        url = f"{self.base_url}/repos/{repo}/git/trees/{repo_info['repo']['default_branch']}?recursive=1"
        response = requests.get(url, headers=self.headers)

        if response.status_code != 200:
            return {
                "status": "error",
                "message": "Failed to fetch file tree"
            }

        tree = response.json()["tree"]

        # Filter for files
        file_list = [
            item for item in tree
            if item["type"] == "blob"
        ]

        # Filter if specific files requested
        if files:
            file_list = [f for f in file_list if f["path"] in files]

        # Fetch file contents
        file_contents = {}
        for file_info in file_list[:50]:  # Limit to 50 files
            file_result = self.get_file(repo, file_info["path"])
            if file_result["status"] == "success" and file_result["content"]:
                file_contents[file_info["path"]] = file_result["content"]

        return {
            "status": "success",
            "repo": repo,
            "file_count": len(file_contents),
            "files": file_contents
        }

    # ============================================
    # Main Forward Function
    # ============================================

    def forward(self, action: str = "help", **kwargs) -> Any:
        """
        Main forward function for common operations

        Actions:
            Account Management:
            - add_account: Add GitHub account
            - list_accounts: List all accounts
            - use_account: Switch account
            - remove_account: Remove account

            Repository Operations:
            - search: Search repositories
            - my_repos: List your repositories
            - get_repo: Get repo details
            - fork: Fork a repository

            PR Operations:
            - list_prs: List pull requests
            - get_pr: Get PR details
            - create_pr: Create pull request
            - merge_pr: Merge a PR
            - auto_merge: Auto-merge all mergeable PRs

            Other:
            - help: Show this help
        """
        if action == "help":
            return {
                "actions": {
                    "account_management": [
                        "add_account: Add GitHub account with token",
                        "list_accounts: List all configured accounts",
                        "use_account: Switch to different account",
                        "remove_account: Remove account"
                    ],
                    "repositories": [
                        "search: Search GitHub repositories",
                        "my_repos: List your repositories",
                        "get_repo: Get repository details",
                        "fork: Fork a repository"
                    ],
                    "pull_requests": [
                        "list_prs: List pull requests",
                        "get_pr: Get PR details",
                        "create_pr: Create pull request",
                        "merge_pr: Merge a PR",
                        "auto_merge: Auto-merge all mergeable PRs from others"
                    ],
                    "files": [
                        "get_file: Get file content",
                        "update_file: Create/update file"
                    ],
                    "issues": [
                        "list_issues: List issues",
                        "create_issue: Create new issue"
                    ]
                },
                "examples": [
                    "m.mod('gitagent')().add_account('work', 'ghp_...')",
                    "m.mod('gitagent')().use_account('personal')",
                    "m.mod('gitagent')().search_repos('language:python stars:>1000')",
                    "m.mod('gitagent')().auto_merge('owner/repo')"
                ]
            }

        # Route to appropriate method
        action_map = {
            # Accounts
            "add_account": lambda: self.add_account(kwargs.get("name"), kwargs.get("token"), kwargs.get("set_default", False)),
            "list_accounts": lambda: self.list_accounts(),
            "use_account": lambda: self.use_account(kwargs.get("name")),
            "remove_account": lambda: self.remove_account(kwargs.get("name")),

            # Repos
            "search": lambda: self.search_repos(kwargs.get("query"), **{k: v for k, v in kwargs.items() if k != "query"}),
            "my_repos": lambda: self.list_my_repos(**kwargs),
            "get_repo": lambda: self.get_repo(kwargs.get("repo")),
            "fork": lambda: self.fork_repo(kwargs.get("repo"), kwargs.get("organization")),

            # PRs
            "list_prs": lambda: self.list_prs(kwargs.get("repo"), **{k: v for k, v in kwargs.items() if k != "repo"}),
            "get_pr": lambda: self.get_pr(kwargs.get("repo"), kwargs.get("pr_number")),
            "create_pr": lambda: self.create_pr(**kwargs),
            "merge_pr": lambda: self.merge_pr(**kwargs),
            "auto_merge": lambda: self.auto_merge_prs(kwargs.get("repo"), **{k: v for k, v in kwargs.items() if k != "repo"}),

            # Files
            "get_file": lambda: self.get_file(**kwargs),
            "update_file": lambda: self.update_file(**kwargs),

            # Issues
            "list_issues": lambda: self.list_issues(**kwargs),
            "create_issue": lambda: self.create_issue(**kwargs),
        }

        if action in action_map:
            return action_map[action]()

        return {
            "status": "error",
            "message": f"Unknown action: {action}. Use action='help' for available actions."
        }


# Alias for backward compatibility and mod framework pattern
Mod = GitAgent
