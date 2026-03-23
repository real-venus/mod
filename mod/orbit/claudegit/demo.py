#!/usr/bin/env python3
"""
ClaudeGit Demo Script

Demonstrates ClaudeGit functionality with GitHub integration.
Run this to test the module after configuration.
"""

import os
import sys
from pathlib import Path

# Add module to path
sys.path.insert(0, str(Path(__file__).parent))

from claudegit import Mod


def print_banner():
    """Print demo banner"""
    print("\n" + "="*60)
    print("  ╔══════════════════════════════════════╗")
    print("  ║        CLAUDEGIT DEMO                ║")
    print("  ║   Claude Code + GitHub Integration   ║")
    print("  ╚══════════════════════════════════════╝")
    print("="*60 + "\n")


def check_env():
    """Check if GitHub credentials are configured"""
    token = os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
    repo = os.environ.get('GITHUB_REPO')

    print("Environment Check:")
    print(f"  GITHUB_TOKEN: {'✅ Set' if token else '❌ Not set'}")
    print(f"  GITHUB_REPO:  {'✅ Set' if repo else '❌ Not set'}")
    print()

    if not token or not repo:
        print("⚠️  GitHub credentials not configured!")
        print()
        print("Set environment variables:")
        print("  export GITHUB_TOKEN=ghp_your_token_here")
        print("  export GITHUB_REPO=username/repo-name")
        print()
        print("Or configure programmatically (see examples/basic_usage.py)")
        print()
        return False

    return True


def demo_initialization():
    """Demo 1: Initialization"""
    print("="*60)
    print("Demo 1: Initialization")
    print("="*60 + "\n")

    print("Initializing ClaudeGit with auto-push disabled...")
    c = Mod(auto_push=False)

    print(f"  ✓ Initialized")
    print(f"  Default path: {c.default_path}")
    print(f"  GitHub repo:  {c.github_repo or 'Not configured'}")
    print(f"  GitHub branch: {c.github_branch}")
    print(f"  Auto push:    {c.auto_push}")
    print()

    return c


def demo_configuration(c):
    """Demo 2: GitHub Configuration"""
    print("="*60)
    print("Demo 2: GitHub Configuration")
    print("="*60 + "\n")

    print("Viewing current GitHub configuration...")
    config = c.configure_github()

    print(f"  Token set:  {config['token_set']}")
    print(f"  Repository: {config['repo']}")
    print(f"  Branch:     {config['branch']}")
    print(f"  Auto push:  {config['auto_push']}")
    print()


def demo_owner_control(c):
    """Demo 3: Owner-Based Access Control"""
    print("="*60)
    print("Demo 3: Owner-Based Access Control")
    print("="*60 + "\n")

    print("Setting owner address...")
    c.set_owner('0x1234567890abcdef1234567890abcdef12345678')

    print(f"  ✓ Owner set to: {c.owner}")
    print(f"  Only this address can perform edit operations")
    print()


def demo_methods(c):
    """Demo 4: Available Methods"""
    print("="*60)
    print("Demo 4: Available Methods")
    print("="*60 + "\n")

    print("ClaudeGit provides the following methods:\n")

    print("📝 Code Operations:")
    print("  c.analyze_code(path, focus)         - Analyze code")
    print("  c.generate_code(description, path)  - Generate code")
    print("  c.refactor(instructions, path)      - Refactor code")
    print("  c.debug(issue_description, path)    - Debug code")
    print("  c.edit_file(file_path, instructions) - Edit file")
    print("  c.run_task(task, path)              - Run custom task")
    print()

    print("🤖 AI Chat:")
    print("  c.ask(question)                     - Ask Claude")
    print("  c.forward(query, path, model)       - Forward query")
    print()

    print("🔀 Git/GitHub:")
    print("  c.configure_github(...)             - Configure GitHub")
    print("  c.git_force_push(path, branch, msg) - Force push")
    print("  c.git_push(path, branch)            - Regular push")
    print("  c.sync_to_github(path, message)     - Sync to GitHub")
    print()

    print("📦 Module Management:")
    print("  c.create_module(name, prompt)       - Create module")
    print("  c.fork_module(name, source, prompt) - Fork module")
    print()


def demo_auto_push_behavior():
    """Demo 5: Auto-Push Behavior"""
    print("="*60)
    print("Demo 5: Auto-Push Behavior")
    print("="*60 + "\n")

    print("Auto-push DISABLED (manual control):")
    print("  c = Mod(auto_push=False)")
    print("  c.generate_code('Add feature')")
    print("  # No automatic push")
    print("  c.sync_to_github(message='Manual sync')")
    print("  # Manually pushed")
    print()

    print("Auto-push ENABLED (automatic sync):")
    print("  c = Mod(auto_push=True)")
    print("  c.generate_code('Add feature')")
    print("  # Automatically pushed to GitHub!")
    print()


def demo_workflow():
    """Demo 6: Recommended Workflow"""
    print("="*60)
    print("Demo 6: Recommended Workflow")
    print("="*60 + "\n")

    print("Recommended workflow for safe usage:\n")

    print("1. Create dedicated branch:")
    print("   git checkout -b claudegit-dev\n")

    print("2. Initialize with manual push:")
    print("   c = Mod(")
    print("       github_repo='myorg/myapp',")
    print("       github_branch='claudegit-dev',")
    print("       auto_push=False")
    print("   )\n")

    print("3. Make changes and review:")
    print("   c.generate_code('Add feature')")
    print("   # Review: git diff\n")

    print("4. Push manually:")
    print("   c.sync_to_github(message='Add feature')\n")

    print("5. Create PR on GitHub:")
    print("   gh pr create --base main --head claudegit-dev\n")

    print("6. Review and merge via GitHub web UI\n")

    print("7. Enable auto-push when confident:")
    print("   c.configure_github(auto_push=True)\n")


def demo_security_tips():
    """Demo 7: Security Tips"""
    print("="*60)
    print("Demo 7: Security Tips")
    print("="*60 + "\n")

    print("⚠️  Important Security Considerations:\n")

    print("1. Force push overwrites remote branch history")
    print("   - Use dedicated branches (not main/develop)")
    print("   - Test on throwaway repos first\n")

    print("2. GitHub token security")
    print("   - Never commit token to repos")
    print("   - Use environment variables")
    print("   - Set expiration dates\n")

    print("3. Review before auto-push")
    print("   - Start with auto_push=False")
    print("   - Review changes: git diff")
    print("   - Enable auto-push when confident\n")

    print("4. Use branch protection")
    print("   - Protect main/develop branches on GitHub")
    print("   - Require PR reviews\n")

    print("See SECURITY.md for comprehensive security guide\n")


def main():
    """Run all demos"""
    print_banner()

    # Check environment
    if not check_env():
        print("Demo will continue with limited functionality (no GitHub ops)\n")

    # Run demos
    c = demo_initialization()
    demo_configuration(c)
    demo_owner_control(c)
    demo_methods(c)
    demo_auto_push_behavior()
    demo_workflow()
    demo_security_tips()

    # Summary
    print("="*60)
    print("Demo Complete!")
    print("="*60 + "\n")

    print("Next steps:")
    print("  1. Read QUICKSTART.md for quick setup")
    print("  2. Read README.md for full documentation")
    print("  3. Read SECURITY.md for security guidelines")
    print("  4. Run examples/basic_usage.py for more examples")
    print("  5. Run tests/test_claudegit.py for tests")
    print()

    print("Ready to use ClaudeGit!")
    print()


if __name__ == '__main__':
    main()
