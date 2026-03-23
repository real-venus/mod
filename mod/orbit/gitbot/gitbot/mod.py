import os
import requests
import json
from typing import Optional, Dict, Any, List
from pathlib import Path


class Mod:
    """
    GitBot - AI-powered GitHub bot for automated PR creation with signature vibes

    Features:
    - GitHub OAuth authentication & token management
    - Create PRs to any repository
    - Maintain consistent signature style ("vibes")
    - AI-powered commit message generation
    - Multi-repo management
    """

    description = """
    GitBot - Create PRs to any GitHub repo with your signature vibes
    """

    def __init__(self, token: Optional[str] = None):
        """
        Initialize GitBot with GitHub token

        Args:
            token: GitHub personal access token (optional, will use stored token if not provided)
        """
        self.config_dir = Path.home() / '.mod' / 'gitbot'
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.config_file = self.config_dir / 'config.json'
        self.vibes_file = self.config_dir / 'vibes.json'

        self.token = token or self.load_token()
        self.base_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "GitBot-Mod",
        }
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"

    def save_token(self, token: str) -> Dict[str, str]:
        """Save GitHub token to config"""
        config = {"token": token}
        with open(self.config_file, 'w') as f:
            json.dump(config, f, indent=2)
        return {"status": "success", "message": "Token saved securely"}

    def load_token(self) -> Optional[str]:
        """Load GitHub token from config"""
        if not self.config_file.exists():
            return None
        try:
            with open(self.config_file, 'r') as f:
                config = json.load(f)
                return config.get('token')
        except:
            return None

    def auth(self, token: str) -> Dict[str, Any]:
        """
        Authenticate with GitHub using personal access token

        Args:
            token: GitHub personal access token

        Returns:
            Dict with user info and auth status
        """
        self.token = token
        self.headers["Authorization"] = f"token {token}"

        # Verify token by getting user info
        response = requests.get(f"{self.base_url}/user", headers=self.headers)

        if response.status_code == 200:
            user = response.json()
            self.save_token(token)
            return {
                "status": "success",
                "user": user["login"],
                "name": user.get("name"),
                "email": user.get("email"),
                "bio": user.get("bio"),
            }
        else:
            return {
                "status": "error",
                "message": "Invalid token or authentication failed",
                "code": response.status_code
            }

    def get_user(self) -> Dict[str, Any]:
        """Get current authenticated user info"""
        if not self.token:
            return {"status": "error", "message": "Not authenticated. Use auth() first."}

        response = requests.get(f"{self.base_url}/user", headers=self.headers)
        if response.status_code == 200:
            return {"status": "success", "user": response.json()}
        return {"status": "error", "message": "Failed to get user info"}

    def save_vibes(self, vibes: Dict[str, Any]) -> Dict[str, str]:
        """
        Save your signature PR style/vibes

        Args:
            vibes: Dict containing:
                - commit_style: e.g., "short", "emoji", "conventional"
                - pr_template: PR description template
                - tone: e.g., "professional", "casual", "technical"
                - emoji_preference: bool
                - sign_off: Your signature/footer
        """
        with open(self.vibes_file, 'w') as f:
            json.dump(vibes, f, indent=2)
        return {"status": "success", "message": "Vibes saved"}

    def load_vibes(self) -> Dict[str, Any]:
        """Load saved vibes"""
        if not self.vibes_file.exists():
            # Default vibes
            return {
                "commit_style": "short",
                "tone": "casual",
                "emoji_preference": True,
                "sign_off": "✨ Made with mod framework"
            }
        with open(self.vibes_file, 'r') as f:
            return json.load(f)

    def create_pr(
        self,
        repo: str,
        title: str,
        body: str,
        head: str,
        base: str = "main",
        draft: bool = False
    ) -> Dict[str, Any]:
        """
        Create a pull request

        Args:
            repo: Repository in format "owner/repo"
            title: PR title
            body: PR description
            head: Branch containing changes
            base: Base branch to merge into (default: "main")
            draft: Create as draft PR (default: False)

        Returns:
            Dict with PR info or error
        """
        if not self.token:
            return {"status": "error", "message": "Not authenticated. Use auth() first."}

        url = f"{self.base_url}/repos/{repo}/pulls"

        # Add vibes to PR body
        vibes = self.load_vibes()
        if vibes.get("sign_off"):
            body = f"{body}\n\n---\n{vibes['sign_off']}"

        data = {
            "title": title,
            "body": body,
            "head": head,
            "base": base,
            "draft": draft
        }

        response = requests.post(url, headers=self.headers, json=data)

        if response.status_code == 201:
            pr = response.json()
            return {
                "status": "success",
                "pr_number": pr["number"],
                "pr_url": pr["html_url"],
                "state": pr["state"],
                "title": pr["title"]
            }
        else:
            return {
                "status": "error",
                "message": response.json().get("message", "Failed to create PR"),
                "code": response.status_code
            }

    def fork_repo(self, repo: str) -> Dict[str, Any]:
        """
        Fork a repository to your account

        Args:
            repo: Repository in format "owner/repo"

        Returns:
            Dict with fork info
        """
        if not self.token:
            return {"status": "error", "message": "Not authenticated"}

        url = f"{self.base_url}/repos/{repo}/forks"
        response = requests.post(url, headers=self.headers)

        if response.status_code == 202:
            fork = response.json()
            return {
                "status": "success",
                "fork_url": fork["html_url"],
                "full_name": fork["full_name"]
            }
        return {
            "status": "error",
            "message": response.json().get("message"),
            "code": response.status_code
        }

    def create_branch(self, repo: str, branch_name: str, from_branch: str = "main") -> Dict[str, Any]:
        """
        Create a new branch in a repository

        Args:
            repo: Repository in format "owner/repo"
            branch_name: Name of new branch
            from_branch: Branch to create from (default: "main")

        Returns:
            Dict with branch info
        """
        if not self.token:
            return {"status": "error", "message": "Not authenticated"}

        # Get SHA of from_branch
        ref_url = f"{self.base_url}/repos/{repo}/git/ref/heads/{from_branch}"
        ref_response = requests.get(ref_url, headers=self.headers)

        if ref_response.status_code != 200:
            return {"status": "error", "message": f"Failed to get {from_branch} reference"}

        sha = ref_response.json()["object"]["sha"]

        # Create new branch
        create_url = f"{self.base_url}/repos/{repo}/git/refs"
        data = {
            "ref": f"refs/heads/{branch_name}",
            "sha": sha
        }

        response = requests.post(create_url, headers=self.headers, json=data)

        if response.status_code == 201:
            return {
                "status": "success",
                "branch": branch_name,
                "sha": sha
            }
        return {
            "status": "error",
            "message": response.json().get("message"),
            "code": response.status_code
        }

    def commit_file(
        self,
        repo: str,
        path: str,
        content: str,
        message: str,
        branch: str = "main",
        sha: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create or update a file via GitHub API

        Args:
            repo: Repository in format "owner/repo"
            path: File path in repo
            content: File content (will be base64 encoded)
            message: Commit message
            branch: Branch to commit to
            sha: SHA of file if updating (get via get_file)

        Returns:
            Dict with commit info
        """
        if not self.token:
            return {"status": "error", "message": "Not authenticated"}

        import base64

        url = f"{self.base_url}/repos/{repo}/contents/{path}"

        # Apply vibes to commit message
        vibes = self.load_vibes()
        if vibes.get("emoji_preference") and not any(c in message for c in "🚀✨🎉🔧🐛"):
            # Add emoji based on commit type
            if "fix" in message.lower() or "bug" in message.lower():
                message = f"🐛 {message}"
            elif "feat" in message.lower() or "add" in message.lower():
                message = f"✨ {message}"
            elif "update" in message.lower():
                message = f"🔧 {message}"
            else:
                message = f"🚀 {message}"

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
                "path": path
            }
        return {
            "status": "error",
            "message": response.json().get("message"),
            "code": response.status_code
        }

    def get_file(self, repo: str, path: str, branch: str = "main") -> Dict[str, Any]:
        """
        Get file content from repository

        Args:
            repo: Repository in format "owner/repo"
            path: File path in repo
            branch: Branch to get file from

        Returns:
            Dict with file content and metadata
        """
        if not self.token:
            return {"status": "error", "message": "Not authenticated"}

        import base64

        url = f"{self.base_url}/repos/{repo}/contents/{path}"
        params = {"ref": branch}

        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            file_data = response.json()
            content = base64.b64decode(file_data["content"]).decode()
            return {
                "status": "success",
                "content": content,
                "sha": file_data["sha"],
                "path": file_data["path"]
            }
        return {
            "status": "error",
            "message": response.json().get("message", "File not found"),
            "code": response.status_code
        }

    def list_prs(self, repo: str, state: str = "open") -> Dict[str, Any]:
        """
        List pull requests for a repository

        Args:
            repo: Repository in format "owner/repo"
            state: PR state - "open", "closed", "all" (default: "open")

        Returns:
            Dict with list of PRs
        """
        if not self.token:
            return {"status": "error", "message": "Not authenticated"}

        url = f"{self.base_url}/repos/{repo}/pulls"
        params = {"state": state}

        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            prs = response.json()
            return {
                "status": "success",
                "prs": [
                    {
                        "number": pr["number"],
                        "title": pr["title"],
                        "state": pr["state"],
                        "url": pr["html_url"],
                        "author": pr["user"]["login"],
                        "created_at": pr["created_at"]
                    }
                    for pr in prs
                ]
            }
        return {
            "status": "error",
            "message": "Failed to list PRs",
            "code": response.status_code
        }

    def forward(self, action: str = "help", **kwargs) -> Any:
        """
        Main forward function for common operations

        Actions:
            - help: Show available commands
            - auth: Authenticate with token
            - create_pr: Create a pull request
            - fork: Fork a repository
            - vibes: Save/load your signature style
            - status: Check authentication status
        """
        if action == "help":
            return {
                "actions": [
                    "auth: Authenticate with GitHub token",
                    "create_pr: Create a pull request",
                    "fork: Fork a repository",
                    "vibes: Manage your PR signature style",
                    "status: Check authentication status"
                ],
                "example": "m.mod('gitbot')().auth(token='ghp_...')"
            }

        elif action == "auth":
            return self.auth(kwargs.get("token"))

        elif action == "create_pr":
            return self.create_pr(**kwargs)

        elif action == "fork":
            return self.fork_repo(kwargs.get("repo"))

        elif action == "vibes":
            if "save" in kwargs:
                return self.save_vibes(kwargs["save"])
            return self.load_vibes()

        elif action == "status":
            return self.get_user()

        else:
            return {"status": "error", "message": f"Unknown action: {action}"}


def setup_github_token():
    """
    Interactive setup for GitHub token
    Guide user through creating a personal access token
    """
    print("\n🔐 GitHub Token Setup\n")
    print("1. Go to: https://github.com/settings/tokens/new")
    print("2. Generate a new token with these scopes:")
    print("   ✓ repo (full access)")
    print("   ✓ workflow")
    print("   ✓ write:packages")
    print("3. Copy the token and paste below\n")

    token = input("Enter your GitHub token: ").strip()

    if token:
        bot = Mod(token)
        result = bot.auth(token)
        if result["status"] == "success":
            print(f"\n✅ Authenticated as: {result['user']}")
            return bot
        else:
            print(f"\n❌ Authentication failed: {result['message']}")
            return None
    return None
