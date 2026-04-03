#!/usr/bin/env python3
"""
Basic ClaudeGit Usage Examples

Demonstrates core features of ClaudeGit module.
"""

from claudegit import Mod
import os


def example_1_configure_github():
    """Example 1: Configure GitHub credentials"""
    print("=== Example 1: Configure GitHub ===\n")

    c = Mod()

    # Configure GitHub settings
    config = c.configure_github(
        token=os.environ.get('GITHUB_TOKEN', 'ghp_your_token_here'),
        repo='username/repo-name',
        branch='main',
        auto_push=True
    )

    print(f"GitHub configured: {config}\n")


def example_2_auto_push():
    """Example 2: Auto-push after code operations"""
    print("=== Example 2: Auto-Push Enabled ===\n")

    c = Mod(
        github_token=os.environ.get('GITHUB_TOKEN'),
        github_repo=os.environ.get('GITHUB_REPO'),
        auto_push=True  # Automatically push after every operation
    )

    # These operations will automatically push to GitHub
    # c.generate_code("Create a hello world function", path=".")
    # c.edit_file("test.py", "Add a docstring")

    print("Auto-push is enabled. Every operation will sync to GitHub.\n")


def example_3_manual_push():
    """Example 3: Manual push control"""
    print("=== Example 3: Manual Push ===\n")

    c = Mod(auto_push=False)  # Disable auto-push

    # Make multiple changes without pushing
    print("Making changes (not pushing yet)...")
    # c.generate_code("Add feature A")
    # c.generate_code("Add feature B")
    # c.refactor("Optimize performance")

    # Then manually sync all changes at once
    print("Now syncing all changes to GitHub...")
    # result = c.sync_to_github(message="Add features A & B, optimize performance")
    # print(f"Push result: {result}\n")


def example_4_force_push():
    """Example 4: Force push to overwrite remote"""
    print("=== Example 4: Force Push ===\n")

    c = Mod()

    # Force push (overwrites remote branch)
    # result = c.git_force_push(
    #     path=".",
    #     branch="main",
    #     commit_message="ClaudeGit: major refactor"
    # )

    print("Force push will overwrite remote branch history.\n")
    print("Use with caution!\n")


def example_5_multi_repo():
    """Example 5: Work with multiple repositories"""
    print("=== Example 5: Multi-Repo Development ===\n")

    # Frontend repo
    frontend = Mod(
        github_repo='myorg/frontend',
        github_branch='feature-ui',
        default_path='/path/to/frontend',
        auto_push=True
    )

    # Backend repo
    backend = Mod(
        github_repo='myorg/backend',
        github_branch='feature-api',
        default_path='/path/to/backend',
        auto_push=True
    )

    print("Working with multiple repos:")
    print(f"  Frontend: {frontend.github_repo} -> {frontend.github_branch}")
    print(f"  Backend:  {backend.github_repo} -> {backend.github_branch}\n")

    # Make changes to each repo
    # frontend.generate_code("Add dashboard component")
    # backend.generate_code("Add analytics endpoint")

    print("Each repo automatically pushes to its own branch.\n")


def main():
    """Run all examples"""
    print("\n" + "="*60)
    print("ClaudeGit Examples")
    print("="*60 + "\n")

    example_1_configure_github()
    example_2_auto_push()
    example_3_manual_push()
    example_4_force_push()
    example_5_multi_repo()

    print("="*60)
    print("Examples complete!")
    print("="*60 + "\n")


if __name__ == '__main__':
    main()
