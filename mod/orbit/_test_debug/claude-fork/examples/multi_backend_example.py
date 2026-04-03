"""
Multi-Backend Example

Demonstrates using multiple backends in the claude module for different tasks.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from claude import Mod


def example_1_auto_selection():
    """Example 1: Auto-select the best available backend"""
    print("\n" + "="*60)
    print("Example 1: Auto-selecting backend")
    print("="*60)

    mod = Mod()
    print(f"✓ Auto-selected backend: {mod.backend.name}")
    print(f"  Description: {mod.backend.description}")


def example_2_explicit_selection():
    """Example 2: Explicitly choose a backend"""
    print("\n" + "="*60)
    print("Example 2: Explicit backend selection")
    print("="*60)

    # Try each backend
    backends_to_try = ['claude-code', 'dev-tools', 'codex']

    for backend_name in backends_to_try:
        try:
            mod = Mod(backend=backend_name, auto_install=False)
            print(f"✓ {backend_name}: Available")
        except RuntimeError as e:
            print(f"✗ {backend_name}: Not available - {e}")


def example_3_list_backends():
    """Example 3: List all available backends"""
    print("\n" + "="*60)
    print("Example 3: Listing all backends")
    print("="*60)

    backends = Mod.list_backends()
    print(f"\nFound {len(backends)} backends:\n")

    for b in backends:
        status = "✓ Available" if b['available'] else "✗ Not available"
        print(f"{b['name']:15} - {status}")
        print(f"{'':15}   {b['description']}")
        print()


def example_4_switch_backend():
    """Example 4: Switch backends at runtime"""
    print("\n" + "="*60)
    print("Example 4: Switching backends at runtime")
    print("="*60)

    mod = Mod()
    print(f"Started with: {mod.backend.name}")

    # Try to switch to dev-tools
    try:
        mod.switch_backend('dev-tools')
        print(f"Switched to: {mod.backend.name}")
    except Exception as e:
        print(f"Could not switch: {e}")


def example_5_multi_backend_workflow():
    """Example 5: Use different backends for different tasks"""
    print("\n" + "="*60)
    print("Example 5: Multi-backend workflow")
    print("="*60)

    # Use dev-tools for quick file operations
    try:
        dev = Mod(backend='dev-tools')
        print(f"✓ Using {dev.backend.name} for file operations")

        # In a real scenario, you'd do something like:
        # files = dev.forward("List all Python files in current directory")
        # print(f"Found files: {files}")

    except Exception as e:
        print(f"✗ dev-tools not available: {e}")

    # Use claude-code for deeper analysis
    try:
        claude = Mod(backend='claude-code', auto_install=False)
        print(f"✓ Using {claude.backend.name} for analysis")

        # In a real scenario:
        # analysis = claude.analyze_code(focus="security")

    except Exception as e:
        print(f"✗ claude-code not available: {e}")


def example_6_fallback_chain():
    """Example 6: Implement a fallback chain"""
    print("\n" + "="*60)
    print("Example 6: Fallback chain")
    print("="*60)

    def get_available_backend():
        """Try backends in order of preference"""
        preference_order = ['claude-code', 'dev-tools', 'codex']

        for backend_name in preference_order:
            try:
                mod = Mod(backend=backend_name, auto_install=False)
                print(f"✓ Using backend: {backend_name}")
                return mod
            except Exception as e:
                print(f"✗ {backend_name} not available, trying next...")
                continue

        raise RuntimeError("No backends available!")

    try:
        mod = get_available_backend()
        print(f"Successfully initialized with: {mod.backend.name}")
    except RuntimeError as e:
        print(f"Failed to initialize any backend: {e}")


def example_7_backend_comparison():
    """Example 7: Compare backends for the same task"""
    print("\n" + "="*60)
    print("Example 7: Backend comparison")
    print("="*60)

    query = "What is the purpose of this module?"

    backends = Mod.list_backends()
    available = [b for b in backends if b['available']]

    print(f"Testing query with {len(available)} available backends:\n")
    print(f"Query: '{query}'\n")

    for backend_info in available:
        backend_name = backend_info['name']
        try:
            mod = Mod(backend=backend_name)
            print(f"Testing {backend_name}:")
            print(f"  Backend: {mod.backend.name}")
            print(f"  Status: Ready")

            # In a real scenario, you'd execute the query:
            # result = mod.forward(query)
            # print(f"  Result: {result[:100]}...")

        except Exception as e:
            print(f"  Error: {e}")

        print()


def example_8_custom_backend_config():
    """Example 8: Backend-specific configuration"""
    print("\n" + "="*60)
    print("Example 8: Backend-specific configuration")
    print("="*60)

    # Claude Code with specific options
    try:
        claude = Mod(
            backend='claude-code',
            api_key=os.getenv('ANTHROPIC_API_KEY'),
            model='sonnet',
            auto_install=False
        )
        print("✓ Claude Code configured with API key and sonnet model")
    except Exception as e:
        print(f"✗ Claude Code config failed: {e}")

    # Codex with OpenAI key
    try:
        codex = Mod(
            backend='codex',
            api_key=os.getenv('OPENAI_API_KEY'),
            auto_install=False
        )
        print("✓ Codex configured with OpenAI API key")
    except Exception as e:
        print(f"✗ Codex config failed: {e}")

    # Dev tools (no API key needed)
    try:
        dev = Mod(backend='dev-tools')
        print("✓ Dev tools configured (no API key required)")
    except Exception as e:
        print(f"✗ Dev tools config failed: {e}")


def main():
    """Run all examples"""
    print("\n" + "="*60)
    print("CLAUDE MODULE - MULTI-BACKEND EXAMPLES")
    print("="*60)

    examples = [
        example_1_auto_selection,
        example_2_explicit_selection,
        example_3_list_backends,
        example_4_switch_backend,
        example_5_multi_backend_workflow,
        example_6_fallback_chain,
        example_7_backend_comparison,
        example_8_custom_backend_config,
    ]

    for example in examples:
        try:
            example()
        except Exception as e:
            print(f"\n✗ Example failed: {e}")

    print("\n" + "="*60)
    print("All examples completed!")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
