# GitBot 🤖

> *"Automate your GitHub workflow with signature vibes"*

## Overview

GitBot is a powerful GitHub automation module that allows you to create pull requests to any repository while maintaining your unique signature style ("vibes"). Built on the mod framework, it provides seamless GitHub integration with AI-powered commit message generation and consistent branding.

## ✨ Features

- **🔐 GitHub Authentication**: Secure token-based authentication with local storage
- **🚀 PR Creation**: Create pull requests to any repository
- **🎨 Signature Vibes**: Maintain consistent commit message style and PR templates
- **🍴 Repo Forking**: Automatically fork repositories for contributions
- **🌿 Branch Management**: Create and manage branches programmatically
- **📝 File Operations**: Commit files directly via GitHub API
- **😊 Smart Emojis**: Auto-add contextual emojis to commits based on type
- **🎯 Multi-Repo Support**: Work across multiple repositories seamlessly

## 🚀 Quick Start

### Installation

```bash
# Navigate to gitbot directory
cd /Users/broski/mod/mod/orbit/gitbot

# Install dependencies
pip install -r requirements.txt
```

### Authentication

First, you need a GitHub Personal Access Token:

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens/new)
2. Create token with these scopes:
   - ✓ `repo` (full repository access)
   - ✓ `workflow` (workflow management)
   - ✓ `write:packages` (package publishing)
3. Copy the token (starts with `ghp_`)

```python
import mod as m

# Initialize and authenticate
bot = m.mod('gitbot')()
result = bot.auth(token='ghp_your_token_here')

# Or use the interactive setup
from gitbot.mod import setup_github_token
bot = setup_github_token()
```

### Define Your Vibes

Set your signature style for commits and PRs:

```python
vibes = {
    "commit_style": "short",           # short, conventional, descriptive
    "tone": "casual",                  # professional, casual, technical
    "emoji_preference": True,          # auto-add emojis to commits
    "pr_template": """
## Changes
{changes}

## Testing
- [ ] Tested locally
- [ ] All tests pass

## Notes
Built with mod framework
    """,
    "sign_off": "✨ Made with mod framework"
}

bot.save_vibes(vibes)
```

## 📚 Usage Examples

### Create a Pull Request

```python
# 1. Fork the repository (if you don't have write access)
fork_result = bot.fork_repo("owner/repo")
print(f"Forked to: {fork_result['full_name']}")

# 2. Create a new branch
branch_result = bot.create_branch(
    repo="yourusername/repo",
    branch_name="feature/my-awesome-feature",
    from_branch="main"
)

# 3. Commit changes
commit_result = bot.commit_file(
    repo="yourusername/repo",
    path="README.md",
    content="# Updated README\n\nNew content here!",
    message="Update README with new info",
    branch="feature/my-awesome-feature"
)

# 4. Create PR
pr_result = bot.create_pr(
    repo="owner/repo",
    title="Add awesome new feature",
    body="""
## What this PR does
- Adds new feature X
- Improves performance
- Fixes bug Y

## Testing
Tested locally and all tests pass.
    """,
    head="yourusername:feature/my-awesome-feature",
    base="main"
)

print(f"PR created: {pr_result['pr_url']}")
```

### Quick File Update Workflow

```python
# Get current file content
file_info = bot.get_file(
    repo="owner/repo",
    path="config.json",
    branch="main"
)

# Modify content
import json
config = json.loads(file_info['content'])
config['new_setting'] = 'value'
new_content = json.dumps(config, indent=2)

# Commit the change
bot.commit_file(
    repo="owner/repo",
    path="config.json",
    content=new_content,
    message="Update config settings",
    branch="main",
    sha=file_info['sha']  # Required for updates
)
```

### List PRs

```python
# List open PRs
prs = bot.list_prs("owner/repo", state="open")
for pr in prs['prs']:
    print(f"#{pr['number']}: {pr['title']} by {pr['author']}")

# List all PRs
all_prs = bot.list_prs("owner/repo", state="all")
```

### Check Authentication Status

```python
status = bot.get_user()
if status['status'] == 'success':
    user = status['user']
    print(f"Logged in as: {user['login']}")
    print(f"Name: {user['name']}")
    print(f"Public repos: {user['public_repos']}")
```

## 🎨 Vibes Configuration

Your "vibes" define how GitBot styles your commits and PRs:

```python
vibes = {
    # Commit message style
    "commit_style": "short",  # Options: short, conventional, descriptive

    # Communication tone
    "tone": "casual",  # Options: professional, casual, technical, friendly

    # Auto-add emojis
    "emoji_preference": True,  # Adds contextual emojis like 🐛 for fixes, ✨ for features

    # PR description template
    "pr_template": """
## Summary
{summary}

## Changes
{changes}

## Testing
{testing}
    """,

    # Signature/footer for PRs
    "sign_off": "✨ Made with mod framework"
}
```

### Emoji Auto-Detection

When `emoji_preference` is enabled, GitBot automatically adds emojis based on commit message content:

- 🐛 Fix/bug commits
- ✨ Feature/add commits
- 🔧 Update/config commits
- 🚀 Other commits

## 🔧 Advanced Usage

### Integration with Mod Framework

```python
import mod as m

# Use with mod's module system
bot = m.mod('gitbot')()

# Use forward() for common actions
bot.forward('auth', token='ghp_...')
bot.forward('status')
bot.forward('fork', repo='owner/repo')
```

### Batch Operations

```python
# Create multiple PRs across different repos
repos = ['owner/repo1', 'owner/repo2', 'owner/repo3']

for repo in repos:
    # Fork repo
    fork = bot.fork_repo(repo)

    # Create feature branch
    bot.create_branch(
        repo=fork['full_name'],
        branch_name="feature/batch-update",
        from_branch="main"
    )

    # Make changes and create PR
    # ... your changes here ...

    pr = bot.create_pr(
        repo=repo,
        title="Automated update",
        body="Batch update across repositories",
        head=f"{fork['full_name'].split('/')[0]}:feature/batch-update"
    )

    print(f"Created PR: {pr['pr_url']}")
```

### Working with Existing Forks

```python
# Check if you already have a fork
user_info = bot.get_user()
username = user_info['user']['login']

# Create PR from existing fork
pr = bot.create_pr(
    repo="upstream/repo",
    title="My contribution",
    body="Description of changes",
    head=f"{username}:feature-branch",
    base="main"
)
```

## 🏗️ Project Structure

```
gitbot/
├── gitbot/
│   └── mod.py              # Main GitBot implementation
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Container orchestration
├── requirements.txt        # Python dependencies
├── TUTORIAL.md            # Comprehensive tutorial
└── README.md              # This file
```

## 🐳 Docker Deployment

Run GitBot in a containerized environment:

```bash
# Build and launch
docker-compose up --build

# Run in detached mode
docker-compose up -d

# Stop containers
docker-compose down
```

## 🔒 Security Best Practices

1. **Never commit tokens**: Store tokens in `~/.mod/gitbot/config.json` (automatically gitignored)
2. **Use minimal scopes**: Only grant necessary permissions to tokens
3. **Rotate tokens**: Periodically regenerate tokens
4. **Use environment variables**: For production deployments:
   ```bash
   export GITHUB_TOKEN=ghp_your_token
   ```
   ```python
   import os
   bot = m.mod('gitbot')(token=os.getenv('GITHUB_TOKEN'))
   ```

## 💡 Use Cases

- **🤝 Open Source Contributions**: Automate PR creation to multiple repos
- **🔄 Batch Updates**: Update dependencies across many repositories
- **📚 Documentation**: Auto-generate and update docs
- **🤖 Bot Accounts**: Create automated PR bots for teams
- **🎯 Standardization**: Enforce consistent PR formats and commit styles
- **🚀 CI/CD Integration**: Trigger PRs from automated workflows

## 🎯 API Reference

### Authentication Methods

#### `auth(token: str) -> Dict`
Authenticate with GitHub and save token.

#### `get_user() -> Dict`
Get current authenticated user information.

#### `save_token(token: str) -> Dict`
Save token to config file.

#### `load_token() -> Optional[str]`
Load token from config file.

### PR Operations

#### `create_pr(repo, title, body, head, base="main", draft=False) -> Dict`
Create a new pull request.

**Parameters:**
- `repo`: Repository in format "owner/repo"
- `title`: PR title
- `body`: PR description
- `head`: Branch containing changes (format: "username:branch")
- `base`: Base branch to merge into
- `draft`: Create as draft PR

#### `list_prs(repo, state="open") -> Dict`
List pull requests for a repository.

### Repository Operations

#### `fork_repo(repo: str) -> Dict`
Fork a repository to your account.

#### `create_branch(repo, branch_name, from_branch="main") -> Dict`
Create a new branch.

### File Operations

#### `commit_file(repo, path, content, message, branch="main", sha=None) -> Dict`
Create or update a file.

**Parameters:**
- `sha`: Required when updating existing file (get via `get_file`)

#### `get_file(repo, path, branch="main") -> Dict`
Get file content and metadata.

### Configuration

#### `save_vibes(vibes: Dict) -> Dict`
Save your signature PR style.

#### `load_vibes() -> Dict`
Load saved vibes configuration.

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/awesome`)
3. Make your changes
4. Run tests (if applicable)
5. Commit with good vibes (`git commit -m "✨ Add awesome feature"`)
6. Push to your fork
7. Create a PR using GitBot itself! 😄

## 📝 License

Open source and available under permissive licensing.

## 🌟 Philosophy

GitBot embodies the mod framework philosophy:

- **🎯 Purpose-Built**: Designed specifically for GitHub automation
- **🧩 Modular**: Integrate seamlessly with other mod modules
- **💎 Simplicity**: Clean, intuitive API
- **🚀 Production-Ready**: Battle-tested and reliable
- **🎨 Personality**: Maintain your unique style and vibes

## 🔗 Quick Links

- 📘 [Complete Tutorial](TUTORIAL.md)
- 🏠 [Mod Framework](https://github.com/mod-ai/mod)
- 🐙 [GitHub API Docs](https://docs.github.com/en/rest)
- 🔑 [Create Personal Token](https://github.com/settings/tokens/new)

---

**🚀 Ready to automate your GitHub workflow?**

👉 **Start with the [TUTORIAL.md](TUTORIAL.md) for step-by-step examples!**

*Built with mod framework. Crafted with vibes.* ✨

---

<div align="center">
  <sub>Automate with style. Contribute with vibes. 🎨</sub>
</div>
