#!/usr/bin/env python3
"""
GitBot Examples - Quick reference for common operations

Usage:
    python examples.py
"""

import mod as m
import json
import os


def setup_example():
    """Example: Set up GitBot with your token"""
    print("\n=== Setup Example ===\n")

    # Initialize
    bot = m.mod('gitbot')()

    # Authenticate (replace with your token)
    token = os.getenv('GITHUB_TOKEN') or 'ghp_your_token_here'
    result = bot.auth(token=token)

    if result['status'] == 'success':
        print(f"✅ Authenticated as: {result['user']}")
        return bot
    else:
        print(f"❌ Authentication failed: {result['message']}")
        return None


def vibes_example(bot):
    """Example: Set your signature vibes"""
    print("\n=== Vibes Example ===\n")

    # Define your signature style
    my_vibes = {
        "commit_style": "short",
        "tone": "casual",
        "emoji_preference": True,
        "sign_off": "✨ Made with mod framework"
    }

    # Save vibes
    result = bot.save_vibes(my_vibes)
    print(f"Vibes saved: {result}")

    # Load and display
    vibes = bot.load_vibes()
    print(f"\nYour vibes:")
    for key, value in vibes.items():
        print(f"  {key}: {value}")


def simple_pr_example(bot):
    """Example: Create a simple PR"""
    print("\n=== Simple PR Example ===\n")

    # Replace with your repo
    repo = "yourusername/your-repo"

    # 1. Create branch
    print("Creating branch...")
    branch_result = bot.create_branch(
        repo=repo,
        branch_name="docs/update-readme",
        from_branch="main"
    )

    if branch_result['status'] == 'success':
        print(f"✅ Branch created: {branch_result['branch']}")
    else:
        print(f"❌ Failed to create branch: {branch_result.get('message')}")
        return

    # 2. Commit a file
    print("\nCommitting changes...")
    readme_content = "# My Project\n\nUpdated README content!"

    commit_result = bot.commit_file(
        repo=repo,
        path="README.md",
        content=readme_content,
        message="Update README",
        branch="docs/update-readme"
    )

    if commit_result['status'] == 'success':
        print(f"✅ Committed: {commit_result['commit_sha']}")
    else:
        print(f"❌ Failed to commit: {commit_result.get('message')}")
        return

    # 3. Create PR
    print("\nCreating PR...")
    pr_result = bot.create_pr(
        repo=repo,
        title="📚 Update README",
        body="""
## What this PR does
Updates the README with better documentation.

## Changes
- Improved project description
- Added usage examples
        """,
        head="docs/update-readme",
        base="main"
    )

    if pr_result['status'] == 'success':
        print(f"🎉 PR created: {pr_result['pr_url']}")
    else:
        print(f"❌ Failed to create PR: {pr_result.get('message')}")


def fork_and_contribute_example(bot):
    """Example: Fork a repo and create PR"""
    print("\n=== Fork & Contribute Example ===\n")

    # Repository to contribute to
    target_repo = "octocat/Hello-World"

    # 1. Fork the repo
    print(f"Forking {target_repo}...")
    fork_result = bot.fork_repo(target_repo)

    if fork_result['status'] == 'success':
        my_fork = fork_result['full_name']
        print(f"✅ Forked to: {my_fork}")

        # 2. Create branch in fork
        print("\nCreating branch in fork...")
        branch_result = bot.create_branch(
            repo=my_fork,
            branch_name="feature/my-contribution",
            from_branch="master"  # Some repos use master
        )

        if branch_result['status'] == 'success':
            print(f"✅ Branch created: {branch_result['branch']}")

            # 3. Make changes (example: add a file)
            print("\nAdding new file...")
            commit_result = bot.commit_file(
                repo=my_fork,
                path="CONTRIBUTING.md",
                content="# Contributing\n\nThanks for contributing!",
                message="Add contributing guide",
                branch="feature/my-contribution"
            )

            if commit_result['status'] == 'success':
                print(f"✅ Changes committed")

                # 4. Create PR to original repo
                print("\nCreating PR to upstream...")
                my_username = my_fork.split('/')[0]
                pr_result = bot.create_pr(
                    repo=target_repo,
                    title="Add contributing guide",
                    body="Adds a contributing guide to help new contributors.",
                    head=f"{my_username}:feature/my-contribution",
                    base="master"
                )

                if pr_result['status'] == 'success':
                    print(f"🎉 PR created: {pr_result['pr_url']}")
                else:
                    print(f"Note: {pr_result.get('message')}")
    else:
        print(f"❌ Fork failed: {fork_result.get('message')}")


def list_prs_example(bot):
    """Example: List PRs in a repo"""
    print("\n=== List PRs Example ===\n")

    # Use a popular repo for demo
    repo = "octocat/Hello-World"

    # List open PRs
    print(f"Fetching PRs for {repo}...")
    result = bot.list_prs(repo=repo, state="all")

    if result['status'] == 'success':
        prs = result['prs']
        print(f"\nFound {len(prs)} PRs:")
        for pr in prs[:5]:  # Show first 5
            print(f"  #{pr['number']}: {pr['title']}")
            print(f"    by {pr['author']} - {pr['state']}")
            print(f"    {pr['url']}\n")
    else:
        print(f"Failed to list PRs: {result.get('message')}")


def update_file_example(bot):
    """Example: Update an existing file"""
    print("\n=== Update File Example ===\n")

    # Replace with your repo
    repo = "yourusername/your-repo"
    file_path = "package.json"

    # 1. Get current file
    print(f"Fetching {file_path}...")
    file_result = bot.get_file(
        repo=repo,
        path=file_path,
        branch="main"
    )

    if file_result['status'] == 'success':
        print(f"✅ File fetched")

        # 2. Modify content
        try:
            package = json.loads(file_result['content'])
            package['version'] = '2.0.0'
            new_content = json.dumps(package, indent=2)

            # 3. Create branch
            branch_result = bot.create_branch(
                repo=repo,
                branch_name="chore/bump-version",
                from_branch="main"
            )

            # 4. Commit update
            print("\nCommitting update...")
            commit_result = bot.commit_file(
                repo=repo,
                path=file_path,
                content=new_content,
                message="Bump version to 2.0.0",
                branch="chore/bump-version",
                sha=file_result['sha']  # Important for updates!
            )

            if commit_result['status'] == 'success':
                print(f"✅ File updated")

                # 5. Create PR
                pr_result = bot.create_pr(
                    repo=repo,
                    title="🔖 Bump version to 2.0.0",
                    body="Updates package version for new release.",
                    head="chore/bump-version",
                    base="main"
                )

                if pr_result['status'] == 'success':
                    print(f"🎉 PR created: {pr_result['pr_url']}")
        except json.JSONDecodeError:
            print("Error: File is not valid JSON")
    else:
        print(f"Failed to get file: {file_result.get('message')}")


def batch_update_example(bot):
    """Example: Update multiple repos at once"""
    print("\n=== Batch Update Example ===\n")

    # List of repos to update
    repos = [
        "myorg/repo1",
        "myorg/repo2",
        "myorg/repo3"
    ]

    # File to add to all repos
    new_file_content = """# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities to security@example.com
"""

    for repo in repos:
        print(f"\n📦 Updating {repo}...")

        # Create branch
        branch_result = bot.create_branch(
            repo=repo,
            branch_name="docs/add-security-policy",
            from_branch="main"
        )

        if branch_result['status'] != 'success':
            print(f"  ⏭️  Skipping (branch exists or error)")
            continue

        # Add file
        commit_result = bot.commit_file(
            repo=repo,
            path="SECURITY.md",
            content=new_file_content,
            message="Add security policy",
            branch="docs/add-security-policy"
        )

        if commit_result['status'] != 'success':
            print(f"  ❌ Failed to commit")
            continue

        # Create PR
        pr_result = bot.create_pr(
            repo=repo,
            title="🔒 Add security policy",
            body="Adds a security policy document for vulnerability reporting.",
            head="docs/add-security-policy",
            base="main"
        )

        if pr_result['status'] == 'success':
            print(f"  ✅ PR created: {pr_result['pr_url']}")
        else:
            print(f"  ❌ PR failed: {pr_result.get('message')}")


def main():
    """Run all examples"""
    print("🤖 GitBot Examples\n")
    print("These examples demonstrate common GitBot operations.")
    print("⚠️  Remember to replace 'yourusername/your-repo' with your actual repo!\n")

    # Setup
    bot = setup_example()
    if not bot:
        print("\n❌ Setup failed. Please check your GitHub token.")
        return

    # Run examples (comment out ones you don't want to run)
    vibes_example(bot)
    list_prs_example(bot)

    # These create PRs - uncomment when ready to test:
    # simple_pr_example(bot)
    # fork_and_contribute_example(bot)
    # update_file_example(bot)
    # batch_update_example(bot)

    print("\n✅ Examples complete!")
    print("\nNext steps:")
    print("  1. Set up your vibes with save_vibes()")
    print("  2. Try creating a PR to your own repo")
    print("  3. Explore the TUTORIAL.md for more advanced workflows")


if __name__ == "__main__":
    main()
