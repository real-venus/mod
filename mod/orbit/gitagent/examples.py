"""
GitAgent Examples
Practical examples of using GitAgent for GitHub automation
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from gitagent.mod import GitAgent


def example_setup():
    """Example: Initial setup with multiple accounts"""
    print("=" * 60)
    print("Example 1: Setup with Multiple Accounts")
    print("=" * 60)

    git = GitAgent()

    # Add personal account
    result = git.add_account(
        name="personal",
        token="ghp_your_personal_token",
        set_default=True
    )
    print(f"Added personal account: {result}")

    # Add work account
    result = git.add_account(
        name="work",
        token="ghp_your_work_token"
    )
    print(f"Added work account: {result}")

    # List all accounts
    accounts = git.list_accounts()
    print(f"\nAll accounts: {accounts}")


def example_search_repos():
    """Example: Search for interesting repositories"""
    print("\n" + "=" * 60)
    print("Example 2: Search for Repositories")
    print("=" * 60)

    git = GitAgent()

    # Search for trending Python ML repos
    results = git.search_repos(
        "language:python topic:machine-learning stars:>1000",
        sort="stars",
        order="desc",
        per_page=10
    )

    print(f"\nFound {results['total_count']} repositories")
    print("\nTop 10 Python ML repositories:")
    for i, repo in enumerate(results['repos'], 1):
        print(f"\n{i}. {repo['full_name']}")
        print(f"   ⭐ {repo['stars']} stars | 🍴 {repo['forks']} forks")
        print(f"   {repo['description']}")
        print(f"   {repo['url']}")


def example_auto_merge():
    """Example: Auto-merge all external PRs"""
    print("\n" + "=" * 60)
    print("Example 3: Auto-Merge External PRs")
    print("=" * 60)

    git = GitAgent()
    git.use_account("personal")

    # Auto-merge all PRs from others in your repo
    result = git.auto_merge_prs(
        "your-username/your-repo",
        merge_method="squash",
        max_prs=20
    )

    print(f"\nAuto-merge results:")
    print(f"Successfully merged: {result['summary']['total_merged']}")
    print(f"Failed: {result['summary']['total_failed']}")
    print(f"Skipped: {result['summary']['total_skipped']}")

    # Show details
    if result['merged']:
        print("\n✅ Merged PRs:")
        for pr in result['merged']:
            print(f"  #{pr['number']}: {pr['title']}")

    if result['failed']:
        print("\n❌ Failed PRs:")
        for pr in result['failed']:
            print(f"  #{pr['number']}: {pr['title']} - {pr['error']}")

    if result['skipped']:
        print("\n⏭️  Skipped PRs:")
        for pr in result['skipped']:
            print(f"  #{pr['number']}: {pr['reason']}")


def example_fork_and_pr():
    """Example: Fork a repo and create a PR"""
    print("\n" + "=" * 60)
    print("Example 4: Fork and Create PR")
    print("=" * 60)

    git = GitAgent()

    # 1. Fork the repository
    print("\n1. Forking repository...")
    fork_result = git.fork_repo("awesome-org/awesome-project")
    my_repo = fork_result['full_name']
    print(f"Forked to: {my_repo}")

    # 2. Create a feature branch
    print("\n2. Creating feature branch...")
    branch_result = git.create_branch(my_repo, "add-documentation")
    print(f"Created branch: {branch_result['branch']}")

    # 3. Update a file
    print("\n3. Updating README...")
    file = git.get_file(my_repo, "README.md", branch="add-documentation")

    new_content = file['content'] + "\n\n## Contributing\n\nPRs are welcome!"

    update_result = git.update_file(
        repo=my_repo,
        path="README.md",
        content=new_content,
        message="Add contributing section",
        branch="add-documentation",
        sha=file['sha']
    )
    print(f"Updated file: {update_result['path']}")

    # 4. Create PR back to original repo
    print("\n4. Creating pull request...")
    pr_result = git.create_pr(
        repo="awesome-org/awesome-project",
        title="Add contributing section to README",
        head=f"{git.current_account}:add-documentation",
        base="main",
        body="This PR adds a contributing section to the README to encourage contributions."
    )
    print(f"PR created: {pr_result['url']}")


def example_multi_account():
    """Example: Work with multiple accounts"""
    print("\n" + "=" * 60)
    print("Example 5: Multi-Account Workflow")
    print("=" * 60)

    git = GitAgent()

    # Work account operations
    print("\n1. Working with work account...")
    git.use_account("work")

    work_repos = git.list_my_repos(type="owner")
    print(f"Work repos: {work_repos['count']}")

    # Personal account operations
    print("\n2. Switching to personal account...")
    git.use_account("personal")

    personal_repos = git.list_my_repos(type="owner")
    print(f"Personal repos: {personal_repos['count']}")

    # Get stats across all accounts
    print("\n3. Stats across all accounts:")
    all_accounts = git.list_accounts()['accounts']

    for account_name in all_accounts.keys():
        git.use_account(account_name)
        repos = git.list_my_repos()

        total_stars = sum(r['stars'] for r in repos['repos'])

        print(f"\n{account_name}:")
        print(f"  Repositories: {repos['count']}")
        print(f"  Total stars: {total_stars}")


def example_batch_operations():
    """Example: Batch operations across repos"""
    print("\n" + "=" * 60)
    print("Example 6: Batch Operations")
    print("=" * 60)

    git = GitAgent()

    # Get all your repos
    repos = git.list_my_repos()

    print(f"\nProcessing {repos['count']} repositories...")

    # Check each repo for open PRs
    repos_with_prs = []

    for repo in repos['repos'][:10]:  # Limit to first 10
        prs = git.list_prs(repo['full_name'], state="open")

        if prs['count'] > 0:
            repos_with_prs.append({
                'repo': repo['full_name'],
                'pr_count': prs['count']
            })

    print("\nRepositories with open PRs:")
    for item in repos_with_prs:
        print(f"  {item['repo']}: {item['pr_count']} PRs")


def example_file_operations():
    """Example: File operations"""
    print("\n" + "=" * 60)
    print("Example 7: File Operations")
    print("=" * 60)

    git = GitAgent()

    repo = "your-username/your-repo"

    # 1. Read a file
    print("\n1. Reading config file...")
    file = git.get_file(repo, "config.json")
    print(f"File size: {file['size']} bytes")

    # 2. Parse and modify
    print("\n2. Modifying content...")
    import json

    config = json.loads(file['content'])
    config['version'] = '2.0.0'
    config['updated'] = '2024-03-22'

    new_content = json.dumps(config, indent=2)

    # 3. Update file
    print("\n3. Updating file...")
    result = git.update_file(
        repo=repo,
        path="config.json",
        content=new_content,
        message="Update config version to 2.0.0",
        branch="main",
        sha=file['sha']
    )

    print(f"Updated: {result['path']}")
    print(f"Commit SHA: {result['commit_sha']}")


def example_ai_integration():
    """Example: Prepare files for AI processing"""
    print("\n" + "=" * 60)
    print("Example 8: AI Integration")
    print("=" * 60)

    git = GitAgent()

    # Get all files from a repo for AI processing
    print("\nFetching repository files for AI processing...")
    files = git.prepare_for_claude("your-username/your-repo")

    print(f"Fetched {files['file_count']} files")
    print("\nFiles:")
    for path, content in list(files['files'].items())[:10]:
        print(f"  - {path} ({len(content)} chars)")

    # In real usage, you would pass these files to Claude
    # Example:
    # response = claude.ask(
    #     "Analyze this codebase and suggest improvements",
    #     context=files['files']
    # )


def example_forward_function():
    """Example: Using the forward function"""
    print("\n" + "=" * 60)
    print("Example 9: Forward Function")
    print("=" * 60)

    git = GitAgent()

    # Show help
    print("\n1. Getting help:")
    help_info = git.forward("help")
    print(help_info)

    # Quick search
    print("\n2. Quick search:")
    results = git.forward("search", query="language:rust stars:>500")
    print(f"Found {results['total_count']} Rust repos")

    # List my repos
    print("\n3. List my repos:")
    repos = git.forward("my_repos", type="owner")
    print(f"You own {repos['count']} repositories")

    # Get repo details
    print("\n4. Get repo details:")
    repo = git.forward("get_repo", repo="torvalds/linux")
    print(f"Repo: {repo['repo']['full_name']}")
    print(f"Stars: {repo['repo']['stars']}")


def example_issue_management():
    """Example: Managing issues"""
    print("\n" + "=" * 60)
    print("Example 10: Issue Management")
    print("=" * 60)

    git = GitAgent()

    repo = "your-username/your-repo"

    # List open issues
    print("\n1. Listing open issues:")
    issues = git.list_issues(repo, state="open")
    print(f"Found {issues['count']} open issues")

    for issue in issues['issues'][:5]:
        print(f"  #{issue['number']}: {issue['title']}")

    # Create a new issue
    print("\n2. Creating new issue:")
    new_issue = git.create_issue(
        repo=repo,
        title="Add dark mode support",
        body="Users have requested dark mode. This would improve accessibility.",
        labels=["enhancement", "ui"],
        assignees=["developer123"]
    )

    print(f"Created issue: {new_issue['url']}")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("GitAgent Examples")
    print("=" * 60)
    print("\nThese examples demonstrate GitAgent's capabilities.")
    print("Uncomment the examples you want to run.\n")

    # Uncomment the examples you want to run:

    # example_setup()
    # example_search_repos()
    # example_auto_merge()
    # example_fork_and_pr()
    # example_multi_account()
    # example_batch_operations()
    # example_file_operations()
    # example_ai_integration()
    # example_forward_function()
    # example_issue_management()

    print("\n" + "=" * 60)
    print("To run examples, uncomment them in the __main__ block")
    print("=" * 60)
