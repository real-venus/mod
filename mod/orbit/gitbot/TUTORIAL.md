# GitBot Tutorial 🎓

Complete guide to automating GitHub workflows with your signature vibes.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Your First PR](#your-first-pr)
4. [Defining Your Vibes](#defining-your-vibes)
5. [Advanced Workflows](#advanced-workflows)
6. [Real-World Examples](#real-world-examples)
7. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

- Python 3.8+
- Mod framework installed
- GitHub account

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Verify installation
python -c "import mod as m; print(m.mod('gitbot'))"
```

## Authentication

### Step 1: Create GitHub Token

1. Visit [GitHub Settings → Tokens](https://github.com/settings/tokens/new)
2. Click "Generate new token (classic)"
3. Set expiration (recommended: 90 days)
4. Select scopes:
   - ✅ `repo` - Full control of private repositories
   - ✅ `workflow` - Update GitHub Action workflows
   - ✅ `write:packages` - Upload packages to GitHub Package Registry
5. Click "Generate token"
6. Copy the token immediately (you won't see it again!)

### Step 2: Authenticate with GitBot

**Method 1: Interactive Setup**

```python
from gitbot.mod import setup_github_token

# Interactive guide
bot = setup_github_token()
```

**Method 2: Direct Authentication**

```python
import mod as m

bot = m.mod('gitbot')()
result = bot.auth(token='ghp_your_token_here')

if result['status'] == 'success':
    print(f"✅ Authenticated as {result['user']}")
else:
    print(f"❌ Error: {result['message']}")
```

**Method 3: Environment Variable**

```bash
# In your .bashrc or .zshrc
export GITHUB_TOKEN=ghp_your_token_here
```

```python
import os
import mod as m

bot = m.mod('gitbot')(token=os.getenv('GITHUB_TOKEN'))
```

### Verify Authentication

```python
status = bot.get_user()
print(f"User: {status['user']['login']}")
print(f"Name: {status['user']['name']}")
print(f"Repos: {status['user']['public_repos']}")
```

## Your First PR

Let's create a simple PR to add a README to your repository.

### Scenario: Add README to Your Repo

```python
import mod as m

# Initialize
bot = m.mod('gitbot')()

# 1. Create a new branch
branch = bot.create_branch(
    repo="yourusername/your-repo",
    branch_name="docs/add-readme",
    from_branch="main"
)

print(f"✅ Branch created: {branch['branch']}")

# 2. Create README content
readme_content = """# My Awesome Project

> Building something cool

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`javascript
const app = require('./app');
app.start();
\`\`\`

✨ Made with mod framework
"""

# 3. Commit the README
commit = bot.commit_file(
    repo="yourusername/your-repo",
    path="README.md",
    content=readme_content,
    message="Add comprehensive README",
    branch="docs/add-readme"
)

print(f"✅ Committed: {commit['commit_sha']}")

# 4. Create PR
pr = bot.create_pr(
    repo="yourusername/your-repo",
    title="📚 Add comprehensive README",
    body="""
## What this PR does

Adds a comprehensive README with:
- Project overview
- Features list
- Installation instructions
- Usage examples

## Why this matters

Good documentation helps users understand and use the project.

## Testing

- [x] README renders correctly on GitHub
- [x] Links work
- [x] Code examples are accurate
    """,
    head="docs/add-readme",
    base="main"
)

print(f"🎉 PR created: {pr['pr_url']}")
```

## Defining Your Vibes

Your "vibes" are your signature style. Let's customize them!

### Example Vibes Configurations

#### Professional Developer

```python
professional_vibes = {
    "commit_style": "conventional",
    "tone": "professional",
    "emoji_preference": False,
    "pr_template": """
## Summary
{summary}

## Technical Details
{details}

## Testing
{testing}

## Related Issues
{issues}
    """,
    "sign_off": "Reviewed and tested by {author}"
}

bot.save_vibes(professional_vibes)
```

#### Casual Open Source Contributor

```python
casual_vibes = {
    "commit_style": "short",
    "tone": "casual",
    "emoji_preference": True,
    "pr_template": """
## Hey! 👋

{summary}

## What changed
{changes}

## Tested?
{testing}

Peace! ✌️
    """,
    "sign_off": "✨ Made with love and mod framework"
}

bot.save_vibes(casual_vibes)
```

#### Technical/Engineering Team

```python
technical_vibes = {
    "commit_style": "conventional",
    "tone": "technical",
    "emoji_preference": True,
    "pr_template": """
## Change Summary
{summary}

## Implementation Details
{implementation}

## Performance Impact
{performance}

## Test Coverage
{tests}

## Deployment Notes
{deployment}

## Rollback Plan
{rollback}
    """,
    "sign_off": "Engineered with mod framework"
}

bot.save_vibes(technical_vibes)
```

### Using Your Vibes

Once saved, your vibes are automatically applied:

```python
# Emojis are auto-added based on commit type
bot.commit_file(
    repo="owner/repo",
    path="app.js",
    content="// Fixed bug",
    message="fix authentication issue"  # Will become: 🐛 fix authentication issue
)

# Sign-off is auto-added to PRs
pr = bot.create_pr(
    repo="owner/repo",
    title="Update config",
    body="Updated config settings"
)
# Body will include your sign_off automatically
```

## Advanced Workflows

### Workflow 1: Fork, Update, PR

Complete workflow for contributing to external repositories:

```python
import mod as m
import json

bot = m.mod('gitbot')()

# Target repository
target_repo = "upstream-org/awesome-project"

# 1. Fork the repository
print("🍴 Forking repository...")
fork = bot.fork_repo(target_repo)
my_fork = fork['full_name']
print(f"✅ Forked to: {my_fork}")

# 2. Create feature branch
print("🌿 Creating branch...")
branch = bot.create_branch(
    repo=my_fork,
    branch_name="feature/update-dependencies",
    from_branch="main"
)

# 3. Update package.json
print("📝 Updating package.json...")
file_info = bot.get_file(
    repo=my_fork,
    path="package.json",
    branch="main"
)

package = json.loads(file_info['content'])
package['dependencies']['some-lib'] = '^2.0.0'

bot.commit_file(
    repo=my_fork,
    path="package.json",
    content=json.dumps(package, indent=2),
    message="Update some-lib to v2",
    branch="feature/update-dependencies",
    sha=file_info['sha']
)

# 4. Create PR to upstream
print("🚀 Creating pull request...")
my_username = my_fork.split('/')[0]
pr = bot.create_pr(
    repo=target_repo,
    title="⬆️ Update dependencies to latest versions",
    body="""
## Summary
Updates dependencies to their latest stable versions.

## Changes
- Updated `some-lib` from v1.x to v2.0.0

## Breaking Changes
None - all changes are backwards compatible.

## Testing
- [x] Ran full test suite
- [x] Verified build succeeds
- [x] Manual testing completed

## Related Issues
Fixes #123
    """,
    head=f"{my_username}:feature/update-dependencies",
    base="main"
)

print(f"🎉 Success! PR created at: {pr['pr_url']}")
```

### Workflow 2: Batch Update Multiple Repos

Update similar files across multiple repositories:

```python
import mod as m

bot = m.mod('gitbot')()

# List of repositories to update
repos = [
    "myorg/service-api",
    "myorg/service-auth",
    "myorg/service-payments"
]

# New GitHub Actions workflow
workflow_content = """
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
"""

# Update each repo
for repo in repos:
    print(f"\n📦 Processing {repo}...")

    # Create branch
    branch = bot.create_branch(
        repo=repo,
        branch_name="ci/add-github-actions",
        from_branch="main"
    )

    # Add workflow file
    commit = bot.commit_file(
        repo=repo,
        path=".github/workflows/ci.yml",
        content=workflow_content,
        message="Add CI workflow",
        branch="ci/add-github-actions"
    )

    # Create PR
    pr = bot.create_pr(
        repo=repo,
        title="🔧 Add GitHub Actions CI workflow",
        body="""
## Summary
Adds automated CI testing with GitHub Actions.

## What this does
- Runs tests on every push and PR
- Uses Node.js 18
- Caches dependencies for faster runs

## Benefits
- Catch bugs before merge
- Ensure code quality
- Faster feedback loop
        """,
        head="ci/add-github-actions",
        base="main"
    )

    print(f"✅ PR created: {pr['pr_url']}")
```

## Real-World Examples

### Example 1: Contributing to Open Source

```python
import mod as m

bot = m.mod('gitbot')()

# Set your contributor vibes
contributor_vibes = {
    "commit_style": "conventional",
    "tone": "professional",
    "emoji_preference": True,
    "sign_off": "Thanks for maintaining this project! 🙏"
}
bot.save_vibes(contributor_vibes)

# Find a repo you want to contribute to
target = "facebook/react"

# Fork it
fork = bot.fork_repo(target)

# Fix a typo in docs
bot.create_branch(
    repo=fork['full_name'],
    branch_name="docs/fix-typo-in-readme",
    from_branch="main"
)

# Get the file
file = bot.get_file(
    repo=fork['full_name'],
    path="README.md"
)

# Fix typo
fixed_content = file['content'].replace("teh", "the")

# Commit
bot.commit_file(
    repo=fork['full_name'],
    path="README.md",
    content=fixed_content,
    message="Fix typo in README",
    branch="docs/fix-typo-in-readme",
    sha=file['sha']
)

# Create PR
pr = bot.create_pr(
    repo=target,
    title="📝 Fix typo in README",
    body="""
## Summary
Fixes a small typo in the README.

## Changes
- Changed "teh" to "the" on line 42
    """,
    head=f"{fork['full_name'].split('/')[0]}:docs/fix-typo-in-readme",
    base="main"
)

print(f"Contribution PR: {pr['pr_url']}")
```

## Troubleshooting

### Common Issues

#### 1. Authentication Failed

**Problem**: `Invalid token or authentication failed`

**Solutions**:
```python
# Check token format
token = "ghp_..."  # Should start with ghp_

# Verify token scopes
# Re-generate token with correct scopes

# Test authentication
result = bot.auth(token)
print(result)
```

#### 2. Permission Denied

**Problem**: `Resource not accessible by integration`

**Solution**: Your token needs more scopes.
```python
# Required scopes for common operations:
# - Create PR: repo
# - Fork repo: repo
# - Update workflows: workflow
```

#### 3. Branch Already Exists

**Problem**: `Reference already exists`

**Solution**:
```python
# Use unique branch names
import time
branch = f"feature/my-feature-{int(time.time())}"

# Or delete old branch first via Git
```

#### 4. File SHA Mismatch

**Problem**: `SHA mismatch when updating file`

**Solution**:
```python
# Always get latest SHA before updating
file = bot.get_file(repo=repo, path="file.txt")

# Use the SHA in update
bot.commit_file(
    repo=repo,
    path="file.txt",
    content="new content",
    message="update",
    branch="main",
    sha=file['sha']  # Important!
)
```

### Testing Your Setup

```python
import mod as m

def test_gitbot_setup():
    """Test that GitBot is configured correctly"""

    bot = m.mod('gitbot')()

    # Test 1: Authentication
    print("Testing authentication...")
    status = bot.get_user()
    assert status['status'] == 'success', "Authentication failed"
    print(f"✅ Authenticated as {status['user']['login']}")

    # Test 2: Vibes loaded
    print("Testing vibes...")
    vibes = bot.load_vibes()
    assert vibes is not None, "Failed to load vibes"
    print(f"✅ Vibes loaded: {vibes.get('tone', 'default')}")

    print("\n🎉 All tests passed!")

# Run tests
test_gitbot_setup()
```

## Next Steps

1. **Set up your vibes**: Define your signature style
2. **Practice on your repos**: Create test PRs
3. **Automate workflows**: Build custom scripts
4. **Integrate with CI/CD**: Trigger from automation
5. **Share with team**: Standardize PR creation

---

**Happy automating! 🚀**

*Questions? Issues? Contributions welcome!*
