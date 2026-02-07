#!/usr/bin/env python3
"""
Example usage of Claude Code Mod with auto-installation and API key features.
"""

from claude.mod import Mod, run_claude
import os

def example_basic_usage():
    """Example 1: Basic usage with auto-detection"""
    print("Example 1: Basic Usage")
    print("-" * 40)

    # Initialize - Claude CLI will auto-install if not found
    # API key will be auto-detected from environment or config files
    mod = Mod(default_path="/path/to/your/project")

    # Check if API key was detected
    if mod.api_key:
        print(f"✓ API key detected (authenticated)")
    else:
        print("⚠ No API key detected (may prompt during execution)")

    print(f"✓ Claude CLI found at: {mod.claude_bin}")
    print()

def example_with_explicit_api_key():
    """Example 2: Providing API key explicitly"""
    print("Example 2: Explicit API Key")
    print("-" * 40)

    # Pass API key directly (useful in CI/CD environments)
    api_key = os.environ.get('ANTHROPIC_API_KEY', 'your-api-key-here')

    mod = Mod(
        default_path="/path/to/your/project",
        api_key=api_key
    )

    print(f"✓ Initialized with explicit API key")
    print()

def example_convenience_function():
    """Example 3: Using the convenience function"""
    print("Example 3: Convenience Function")
    print("-" * 40)

    # Quick one-liner with automatic setup
    # result = run_claude(
    #     "Analyze the code for potential improvements",
    #     path="/path/to/your/project",
    #     api_key="optional-api-key"  # Optional parameter
    # )

    print("✓ run_claude() can be used for quick queries")
    print()

def example_api_key_sources():
    """Example 4: Different API key sources"""
    print("Example 4: API Key Detection Sources")
    print("-" * 40)

    print("API key is automatically detected from:")
    print("  1. Explicit parameter: Mod(api_key='...')")
    print("  2. Environment: ANTHROPIC_API_KEY or CLAUDE_API_KEY")
    print("  3. Config files:")
    print("     - ~/.anthropic/api_key")
    print("     - ~/.anthropic/api_keys")
    print("     - ~/.claude/api_key")
    print("     - ~/.config/anthropic/api_key")
    print()
    print("Priority order: explicit parameter > environment > config files")
    print()

def main():
    """Run all examples."""
    print("=" * 60)
    print("Claude Code Mod - Usage Examples")
    print("=" * 60)
    print()

    example_basic_usage()
    example_with_explicit_api_key()
    example_convenience_function()
    example_api_key_sources()

    print("=" * 60)
    print("Note: These examples show initialization only.")
    print("For actual Claude Code execution, uncomment the forward()")
    print("calls and provide valid paths and queries.")
    print("=" * 60)

if __name__ == "__main__":
    main()
