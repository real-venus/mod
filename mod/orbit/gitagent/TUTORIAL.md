# GitAgent Tutorial 📚

Complete guide to mastering GitAgent - your multi-account GitHub interface.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Account Management](#account-management)
3. [Repository Discovery](#repository-discovery)
4. [PR Workflows](#pr-workflows)
5. [File Operations](#file-operations)
6. [Automation Patterns](#automation-patterns)
7. [Multi-Account Workflows](#multi-account-workflows)
8. [AI Integration](#ai-integration)
9. [Troubleshooting](#troubleshooting)

## Getting Started

### Installation

```bash
cd /Users/broski/mod/mod/orbit/gitagent
pip install -r requirements.txt
```

### First Time Setup

```python
import mod.core.mod as m

# Initialize GitAgent
git = m.mod('gitagent')()

# Add your first GitHub account
result = git.add_account(
    name="personal",
    token="ghp_your_token_here",
    set_default=True
)

print(result)
# Output:
# {
#     "status": "success",
#     "account": "personal",
#     "username": "your-github-username",
#     "message": "Account 'personal' added successfully"
# }
```

### Getting a GitHub Token

1. Visit: https://github.com/settings/tokens/new
2. Name it: "GitAgent"
3. Select scopes:
   - ✅ `repo` - Full control of private repositories
   - ✅ `workflow` - Update GitHub Action workflows
   - ✅ `admin:org` - Full control of orgs and teams (optional)
   - ✅ `delete_repo` - Delete repositories (optional)
4. Click "Generate token"
5. Copy the token (it starts with `ghp_`)

**Important**: Save your token securely! You won't be able to see it again.

## Account Management

### Adding Multiple Accounts

```python
# Add work account
git.add_account("work", "ghp_work_token_here")

# Add bot account
git.add_account("bot", "ghp_bot_token_here")

# Add open source account
git.add_account("oss", "ghp_oss_token_here")
```

### Viewing Your Accounts

```python
accounts = git.list_accounts()

print(accounts)
# Output:
# {
#     "status": "success",
#     "accounts": {
#         "personal": {
#             "username": "john_doe",
#             "name": "John Doe",
#             "email": "john@example.com",
#             "is_default": True,
#             "is_active": True
#         },
#         "work": {
#             "username": "john_work",
#             "name": "John Doe",
#             "email": "john@company.com",
#             "is_default": False,
#             "is_active": False
#         }
#     },
#     "default": "personal",
#     "current": "personal"
# }
```

### Switching Between Accounts

```python
# Switch to work account
git.use_account("work")

# Now all operations use the work account
my_repos = git.list_my_repos()

# Switch back to personal
git.use_account("personal")
```

### Removing an Account

```python
git.remove_account("old-account")
```

## Repository Discovery

### Searching Repositories

#### Basic Search

```python
# Search for Python repos
results = git.search_repos("language:python")

# Search by stars
results = git.search_repos("stars:>1000")

# Combine filters
results = git.search_repos(
    "language:rust stars:>500",
    sort="stars",
    order="desc"
)

print(f"Found {results['total_count']} repositories")
for repo in results['repos']:
    print(f"⭐ {repo['stars']} - {repo['full_name']}")
    print(f"   {repo['description']}")
```

#### Advanced Search Queries

```python
# Machine learning repos
git.search_repos("topic:machine-learning language:python stars:>1000")

# Recently updated TypeScript projects
git.search_repos("language:typescript pushed:>2024-01-01")

# Repos from specific organization
git.search_repos("org:facebook")

# Repos by specific user
git.search_repos("user:torvalds")

# Repos with specific topic
git.search_repos("topic:blockchain")

# Combine multiple criteria
git.search_repos(
    "language:go topic:microservices stars:>100 forks:>50",
    sort="updated"
)
```

### Listing Your Repositories

```python
# All your repos
repos = git.list_my_repos()

# Only repos you own (not member of)
repos = git.list_my_repos(type="owner")

# Only private repos
repos = git.list_my_repos(type="private")

# Only public repos
repos = git.list_my_repos(type="public")

# Sort by creation date
repos = git.list_my_repos(sort="created")

print(f"You have {repos['count']} repositories")
for repo in repos['repos']:
    print(f"{repo['full_name']}")
    print(f"  ⭐ {repo['stars']} | 🍴 {repo['forks']} | {repo['language']}")
```

### Getting Repository Details

```python
repo_info = git.get_repo("facebook/react")

print(f"Name: {repo_info['repo']['full_name']}")
print(f"Description: {repo_info['repo']['description']}")
print(f"Stars: {repo_info['repo']['stars']}")
print(f"Forks: {repo_info['repo']['forks']}")
print(f"Language: {repo_info['repo']['language']}")
print(f"Topics: {', '.join(repo_info['repo']['topics'])}")
print(f"Default branch: {repo_info['repo']['default_branch']}")
print(f"Clone URL: {repo_info['repo']['clone_url']}")
```

### Forking Repositories

```python
# Fork to your personal account
fork_result = git.fork_repo("torvalds/linux")

print(f"Forked to: {fork_result['full_name']}")
print(f"Clone URL: {fork_result['clone_url']}")

# Fork to an organization you belong to
fork_result = git.fork_repo(
    "awesome/project",
    organization="my-org"
)
```

## PR Workflows

### Listing Pull Requests

```python
# List open PRs
prs = git.list_prs("owner/repo", state="open")

for pr in prs['prs']:
    print(f"#{pr['number']}: {pr['title']}")
    print(f"  By: {pr['user']} | Created: {pr['created_at']}")

# List closed PRs
prs = git.list_prs("owner/repo", state="closed")

# List all PRs, sorted by most recent
prs = git.list_prs(
    "owner/repo",
    state="all",
    sort="updated",
    direction="desc"
)
```

### Getting PR Details

```python
pr = git.get_pr("owner/repo", pr_number=123)

print(f"Title: {pr['pr']['title']}")
print(f"Body: {pr['pr']['body']}")
print(f"State: {pr['pr']['state']}")
print(f"Mergeable: {pr['pr']['mergeable']}")
print(f"Commits: {pr['pr']['commits']}")
print(f"Additions: {pr['pr']['additions']}")
print(f"Deletions: {pr['pr']['deletions']}")
print(f"Changed files: {pr['pr']['changed_files']}")
print(f"Head branch: {pr['pr']['head']['ref']}")
print(f"Base branch: {pr['pr']['base']['ref']}")
```

### Creating Pull Requests

#### Basic PR Creation

```python
pr = git.create_pr(
    repo="owner/repo",
    title="Add new feature",
    head="feature-branch",
    base="main",
    body="This PR adds a cool new feature"
)

print(f"PR created: {pr['url']}")
print(f"PR number: #{pr['number']}")
```

#### Create PR from Fork

```python
# First, fork the repo
git.fork_repo("upstream/repo")

# Make changes in your fork...

# Create PR from your fork to upstream
pr = git.create_pr(
    repo="upstream/repo",
    title="Fix bug in authentication",
    head="your-username:bug-fix",  # your-fork:branch
    base="main",
    body="This PR fixes the authentication bug by..."
)
```

#### Create Draft PR

```python
pr = git.create_pr(
    repo="owner/repo",
    title="WIP: Refactor authentication",
    head="refactor-auth",
    base="develop",
    body="Work in progress...",
    draft=True
)
```

### Merging Pull Requests

#### Basic Merge

```python
result = git.merge_pr(
    repo="owner/repo",
    pr_number=123
)

print(f"Merged: {result['merged']}")
print(f"SHA: {result['sha']}")
```

#### Squash Merge

```python
result = git.merge_pr(
    repo="owner/repo",
    pr_number=123,
    merge_method="squash",
    commit_title="Add authentication feature",
    commit_message="Squashed commits from PR #123"
)
```

#### Rebase Merge

```python
result = git.merge_pr(
    repo="owner/repo",
    pr_number=123,
    merge_method="rebase"
)
```

### Auto-Merge All External PRs (🔥 Killer Feature)

```python
# Automatically merge all mergeable PRs from others
result = git.auto_merge_prs("owner/repo")

print(f"Successfully merged: {result['summary']['total_merged']}")
print(f"Failed to merge: {result['summary']['total_failed']}")
print(f"Skipped: {result['summary']['total_skipped']}")

# Detailed results
print("\nMerged:")
for pr in result['merged']:
    print(f"  ✅ #{pr['number']}: {pr['title']}")

print("\nFailed:")
for pr in result['failed']:
    print(f"  ❌ #{pr['number']}: {pr['title']}")
    print(f"     Error: {pr['error']}")

print("\nSkipped:")
for pr in result['skipped']:
    print(f"  ⏭️  #{pr['number']}: {pr['reason']}")

# Auto-merge with squash
result = git.auto_merge_prs(
    "owner/repo",
    merge_method="squash",
    max_prs=20  # Limit to first 20 PRs
)
```

**What auto_merge does:**
- ✅ Merges PRs from other users
- ⏭️  Skips your own PRs
- ⏭️  Skips draft PRs
- ⏭️  Skips PRs with merge conflicts
- 📊 Returns detailed report

## File Operations

### Reading Files

```python
# Get file from default branch
file = git.get_file(
    repo="owner/repo",
    path="README.md"
)

print(file['content'])
print(f"Size: {file['size']} bytes")
print(f"SHA: {file['sha']}")

# Get file from specific branch
file = git.get_file(
    repo="owner/repo",
    path="src/main.py",
    branch="develop"
)
```

### Creating/Updating Files

```python
# Create a new file
result = git.update_file(
    repo="owner/repo",
    path="docs/new-guide.md",
    content="# New Guide\n\nContent here...",
    message="Add new guide",
    branch="main"
)

print(f"Created: {result['path']}")
print(f"Commit SHA: {result['commit_sha']}")

# Update existing file (need SHA)
file = git.get_file("owner/repo", "README.md")

result = git.update_file(
    repo="owner/repo",
    path="README.md",
    content=file['content'] + "\n\n## New Section",
    message="Add new section to README",
    branch="main",
    sha=file['sha']  # Required for updates
)
```

### Complete Edit Workflow

```python
# 1. Get current file
file = git.get_file("owner/repo", "config.json")

# 2. Modify content
import json
config = json.loads(file['content'])
config['new_setting'] = 'value'
new_content = json.dumps(config, indent=2)

# 3. Update file
result = git.update_file(
    repo="owner/repo",
    path="config.json",
    content=new_content,
    message="Update configuration",
    branch="main",
    sha=file['sha']
)
```

## Automation Patterns

### Pattern 1: Fork, Edit, PR Workflow

```python
def contribute_to_repo(upstream_repo, changes):
    """Fork a repo, make changes, create PR"""

    # 1. Fork the repo
    fork = git.fork_repo(upstream_repo)
    my_repo = fork['full_name']

    # 2. Create a feature branch
    git.create_branch(my_repo, "my-contribution")

    # 3. Make changes
    for file_path, new_content in changes.items():
        # Get current file
        file = git.get_file(my_repo, file_path, branch="my-contribution")

        # Update file
        git.update_file(
            repo=my_repo,
            path=file_path,
            content=new_content,
            message=f"Update {file_path}",
            branch="my-contribution",
            sha=file['sha'] if file['status'] == 'success' else None
        )

    # 4. Create PR back to upstream
    pr = git.create_pr(
        repo=upstream_repo,
        title="Improve documentation",
        head=f"{git.current_account}:my-contribution",
        base="main",
        body="This PR improves the documentation by..."
    )

    return pr['url']

# Use it
pr_url = contribute_to_repo(
    "awesome/project",
    changes={
        "README.md": "# Updated README\n...",
        "docs/guide.md": "# Guide\n..."
    }
)

print(f"PR created: {pr_url}")
```

### Pattern 2: Batch PR Acceptance

```python
def accept_all_prs(repos):
    """Accept all PRs across multiple repos"""
    results = {}

    for repo in repos:
        print(f"Processing {repo}...")
        result = git.auto_merge_prs(repo, merge_method="squash")
        results[repo] = result['summary']

        print(f"  Merged: {result['summary']['total_merged']}")
        print(f"  Failed: {result['summary']['total_failed']}")

    return results

# Accept PRs across all your repos
my_repos = git.list_my_repos()
repo_names = [r['full_name'] for r in my_repos['repos']]

results = accept_all_prs(repo_names)
```

### Pattern 3: Multi-Repo File Update

```python
def update_file_across_repos(repos, file_path, new_content, message):
    """Update the same file in multiple repos"""
    results = []

    for repo in repos:
        try:
            # Get current file
            file = git.get_file(repo, file_path)

            # Update it
            result = git.update_file(
                repo=repo,
                path=file_path,
                content=new_content,
                message=message,
                branch="main",
                sha=file['sha']
            )

            results.append({
                "repo": repo,
                "status": "success",
                "commit": result['commit_sha']
            })
        except Exception as e:
            results.append({
                "repo": repo,
                "status": "error",
                "error": str(e)
            })

    return results

# Update LICENSE across all your repos
my_repos = git.list_my_repos()
repo_names = [r['full_name'] for r in my_repos['repos']]

new_license = open('MIT-LICENSE.txt').read()

results = update_file_across_repos(
    repo_names,
    "LICENSE",
    new_license,
    "Update to MIT License"
)

for r in results:
    if r['status'] == 'success':
        print(f"✅ {r['repo']}")
    else:
        print(f"❌ {r['repo']}: {r['error']}")
```

### Pattern 4: Issue Creation from Template

```python
def create_issues_from_list(repo, issues_list):
    """Create multiple issues from a list"""
    created = []

    for issue_data in issues_list:
        issue = git.create_issue(
            repo=repo,
            title=issue_data['title'],
            body=issue_data['body'],
            labels=issue_data.get('labels', []),
            assignees=issue_data.get('assignees', [])
        )
        created.append(issue)

    return created

# Use it
issues = [
    {
        "title": "Add dark mode",
        "body": "Implement dark mode theme",
        "labels": ["enhancement", "ui"]
    },
    {
        "title": "Fix login bug",
        "body": "Login button doesn't work on mobile",
        "labels": ["bug", "mobile"],
        "assignees": ["developer123"]
    }
]

created = create_issues_from_list("owner/repo", issues)
print(f"Created {len(created)} issues")
```

## Multi-Account Workflows

### Pattern 1: Cross-Account PR

```python
# Use work account to create PR on personal repo
git.use_account("work")

# Fork personal repo to work account
git.fork_repo("personal-username/repo")

# Make changes in work fork...

# Create PR from work account to personal repo
git.create_pr(
    repo="personal-username/repo",
    title="Work contribution",
    head="work-username:feature",
    base="main",
    body="Contribution from work account"
)

# Switch to personal account to merge
git.use_account("personal")
git.merge_pr("personal-username/repo", pr_number=123)
```

### Pattern 2: Aggregate Stats Across Accounts

```python
def get_all_repos_stats():
    """Get repo stats across all accounts"""
    all_accounts = git.list_accounts()['accounts']
    stats = {}

    for account_name in all_accounts.keys():
        git.use_account(account_name)
        repos = git.list_my_repos()

        total_stars = sum(r['stars'] for r in repos['repos'])
        total_forks = sum(r['forks'] for r in repos['repos'])

        stats[account_name] = {
            "repos": repos['count'],
            "stars": total_stars,
            "forks": total_forks
        }

    return stats

stats = get_all_repos_stats()
for account, data in stats.items():
    print(f"{account}:")
    print(f"  Repos: {data['repos']}")
    print(f"  Total stars: {data['stars']}")
    print(f"  Total forks: {data['forks']}")
```

## AI Integration

### Prepare Repo for Claude

```python
# Get all files from a repo
files = git.prepare_for_claude("owner/repo")

print(f"Fetched {files['file_count']} files")

# Files are in files['files'] dict
for path, content in files['files'].items():
    print(f"- {path} ({len(content)} chars)")

# Now you can pass to Claude for analysis
# Example: Find all TODO comments
# response = claude.ask(
#     f"Find all TODO comments in this codebase: {json.dumps(files['files'])}"
# )
```

### Get Specific Files for Processing

```python
# Only fetch specific files
files = git.prepare_for_claude(
    "owner/repo",
    files=["src/main.py", "src/utils.py", "README.md"]
)

# Process with AI
# fixed_code = claude.ask(
#     "Refactor these files for better performance",
#     context=files['files']
# )
```

## Troubleshooting

### Common Issues

#### 1. Authentication Failed

```python
# Check if token is valid
result = git.add_account("test", "ghp_...")

if result['status'] == 'error':
    print("Token is invalid. Generate a new one:")
    print("https://github.com/settings/tokens/new")
```

#### 2. No Default Account

```python
# If no account is set
accounts = git.list_accounts()

if not accounts['default']:
    # Set one as default
    first_account = list(accounts['accounts'].keys())[0]
    git._set_default_account(first_account)
    git.use_account(first_account)
```

#### 3. API Rate Limiting

GitHub API limits:
- **Authenticated**: 5000 requests/hour
- **Unauthenticated**: 60 requests/hour

GitAgent automatically uses authentication, so you get 5000 req/hr.

If you hit the limit:
```python
# Wait 1 hour, or
# Use a different account
git.use_account("other-account")
```

## Advanced Tips

### 1. Use Forward Function for Quick Actions

```python
git = m.mod('gitagent')()

# Quick search
git.forward("search", query="language:python stars:>1000")

# Quick fork
git.forward("fork", repo="owner/repo")

# Quick auto-merge
git.forward("auto_merge", repo="owner/repo")

# See all actions
git.forward("help")
```

### 2. Save Common Searches

```python
# Create helper functions for common searches
def find_ml_repos():
    return git.search_repos("topic:machine-learning language:python stars:>500")

def find_rust_projects():
    return git.search_repos("language:rust stars:>1000")

def find_active_projects():
    return git.search_repos("pushed:>2024-01-01 stars:>100")

ml_repos = find_ml_repos()
```

## Next Steps

Now that you've mastered GitAgent:

1. **Set up multiple accounts** for different contexts (work, personal, bots)
2. **Automate your workflows** - use auto-merge, batch operations
3. **Integrate with AI** - use Claude/Codex to enhance your workflow
4. **Build custom tools** - create your own automation patterns
5. **Contribute** - help improve GitAgent!

---

**Questions?** Check out [README.md](README.md) for more examples and patterns.

**Ready to move fast?** GitAgent is your GitHub superpower! ⚡
