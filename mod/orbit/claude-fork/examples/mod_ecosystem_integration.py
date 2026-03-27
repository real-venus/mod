"""
Mod Ecosystem Integration Example

Shows how the pluggable backend system integrates with other mod framework modules:
- agent module
- dev.tool modules
- model.openrouter
- And other orbit modules
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import mod as m
    MOD_AVAILABLE = True
except ImportError:
    MOD_AVAILABLE = False
    print("⚠️  mod framework not available - some examples will be skipped")


def example_1_claude_with_agent():
    """Example 1: Use claude module alongside agent module"""
    print("\n" + "="*60)
    print("Example 1: Claude + Agent Integration")
    print("="*60)

    if not MOD_AVAILABLE:
        print("Skipped - mod framework required")
        return

    try:
        # Use claude for specific code operations
        from claude import Mod
        claude = Mod(backend='dev-tools')  # Use dev-tools for integration

        print("✓ Claude module initialized with dev-tools backend")

        # Use agent for general tasks
        agent = m.mod('agent')()
        print("✓ Agent module initialized")

        # They can work together:
        # - Agent for planning and reasoning
        # - Claude for code operations
        print("\nBoth modules can work together:")
        print("  - Use agent for planning: agent.forward(goal='Plan feature')")
        print("  - Use claude for code: claude.forward('Implement feature')")

    except Exception as e:
        print(f"Error: {e}")


def example_2_claude_with_dev_tools():
    """Example 2: Claude using dev.tool primitives"""
    print("\n" + "="*60)
    print("Example 2: Claude + Dev Tools")
    print("="*60)

    if not MOD_AVAILABLE:
        print("Skipped - mod framework required")
        return

    try:
        from claude import Mod

        # Initialize with dev-tools backend
        claude = Mod(backend='dev-tools')
        print(f"✓ Using backend: {claude.backend.name}")

        # The dev-tools backend uses these tools internally:
        tools = [
            'bash',     # Shell commands
            'read',     # File reading
            'write',    # File writing
            'edit',     # File editing
            'grep',     # Content search
            'glob',     # File patterns
            'ask',      # AI queries
        ]

        print("\nDev-tools backend has access to:")
        for tool in tools:
            print(f"  - dev.tool.{tool}")

        # You can also use tools directly alongside claude
        bash = m.mod('dev.tool.bash')()
        result = bash.forward("echo 'Direct tool usage'")
        print(f"\n✓ Direct tool usage works: {result.get('success')}")

    except Exception as e:
        print(f"Error: {e}")


def example_3_multi_module_workflow():
    """Example 3: Complex workflow using multiple modules"""
    print("\n" + "="*60)
    print("Example 3: Multi-Module Workflow")
    print("="*60)

    if not MOD_AVAILABLE:
        print("Skipped - mod framework required")
        return

    try:
        from claude import Mod

        print("Scenario: Analyze a codebase and generate report\n")

        # Step 1: Use dev.tool.glob to find files
        print("Step 1: Finding Python files...")
        glob = m.mod('dev.tool.glob')()
        files = glob.forward("**/*.py", path=".")
        print(f"  Found {files.get('total', 0)} Python files")

        # Step 2: Use dev.tool.grep to search for patterns
        print("\nStep 2: Searching for TODOs...")
        grep = m.mod('dev.tool.grep')()
        todos = grep.forward("TODO|FIXME", path=".", file_pattern="*.py")
        print(f"  Found {todos.get('total_matches', 0)} TODO comments")

        # Step 3: Use claude to analyze findings
        print("\nStep 3: Analyzing with Claude...")
        claude = Mod(backend='dev-tools')
        print(f"  Using {claude.backend.name} backend")
        # In real scenario:
        # analysis = claude.forward(f"Analyze these findings: {todos}")

        print("\n✓ Multi-module workflow completed")

    except Exception as e:
        print(f"Error: {e}")


def example_4_backend_comparison():
    """Example 4: Compare backends using same mod ecosystem"""
    print("\n" + "="*60)
    print("Example 4: Backend Comparison in Mod Ecosystem")
    print("="*60)

    from claude import Mod

    # Test different backends
    backends_to_try = [
        ('claude-code', 'Official Claude CLI'),
        ('dev-tools', 'Mod framework tools'),
        ('codex', 'OpenAI Codex'),
    ]

    print("\nTesting backends in mod ecosystem:\n")

    for backend_name, description in backends_to_try:
        try:
            mod = Mod(backend=backend_name, auto_install=False)
            print(f"✓ {backend_name:15} - {description}")
            print(f"  {'':15}   Status: Available")

            # Show integration points
            if backend_name == 'dev-tools' and MOD_AVAILABLE:
                print(f"  {'':15}   Integrates with: dev.tool.* modules")

        except Exception as e:
            print(f"✗ {backend_name:15} - {description}")
            print(f"  {'':15}   Status: {str(e)[:50]}")


def example_5_cross_module_ai():
    """Example 5: Using AI across different modules"""
    print("\n" + "="*60)
    print("Example 5: Cross-Module AI Usage")
    print("="*60)

    if not MOD_AVAILABLE:
        print("Skipped - mod framework required")
        return

    try:
        from claude import Mod

        print("The mod ecosystem has multiple AI entry points:\n")

        # 1. Claude module (code-focused)
        print("1. Claude module (code operations):")
        claude = Mod()
        print(f"   - Backend: {claude.backend.name}")
        print(f"   - Use: mod.forward('Analyze code')")
        print(f"   - Also: mod.ask() for OpenRouter")

        # 2. Dev.tool.ask (general AI)
        print("\n2. Dev tools ask (general queries):")
        print(f"   - Use: m.mod('dev.tool.ask')().forward('Question')")

        # 3. Model.openrouter (direct API access)
        print("\n3. OpenRouter (direct model access):")
        print(f"   - Use: m.mod('model.openrouter')().forward('Query')")

        print("\nAll three can work together:")
        print("  - Use claude for code operations")
        print("  - Use dev.tool.ask for quick queries")
        print("  - Use openrouter for custom model selection")

    except Exception as e:
        print(f"Error: {e}")


def example_6_extensibility():
    """Example 6: Extending with custom backends"""
    print("\n" + "="*60)
    print("Example 6: Extensibility in Mod Ecosystem")
    print("="*60)

    from claude.backends import Backend, registry

    # Create a backend that uses another mod module
    class AgentBackend(Backend):
        """Backend that uses the agent module"""

        @property
        def name(self):
            return "agent"

        @property
        def description(self):
            return "Mod framework agent module backend"

        def is_available(self):
            if not MOD_AVAILABLE:
                return False
            try:
                m.mod('agent')
                return True
            except:
                return False

        def install(self):
            return self.is_available()

        def forward(self, query, path=None, **kwargs):
            if not MOD_AVAILABLE:
                raise RuntimeError("Mod framework required")

            agent = m.mod('agent')()
            result = agent.forward(
                query=query,
                goal="Execute code operation",
                max_steps=10
            )

            return {
                "success": True,
                "backend": self.name,
                "response": str(result)
            }

    # Register it
    registry.register('agent', AgentBackend)
    print("✓ Registered custom 'agent' backend")

    # Now you can use agent as a backend!
    from claude import Mod

    try:
        mod = Mod(backend='agent', auto_install=False)
        print(f"✓ Claude module now using: {mod.backend.name}")
        print(f"  Description: {mod.backend.description}")
    except Exception as e:
        print(f"✗ Agent backend not available: {e}")

    print("\n✓ This shows how any mod module can be a backend!")


def example_7_practical_scenario():
    """Example 7: Practical scenario using mod ecosystem"""
    print("\n" + "="*60)
    print("Example 7: Practical Scenario")
    print("="*60)

    print("\nScenario: Security audit using mod ecosystem\n")

    if not MOD_AVAILABLE:
        print("Simulated workflow (mod framework not available):")
    else:
        print("Real workflow with mod framework:")

    print("""
1. Use dev.tool.glob to find all Python files
   → files = m.mod('dev.tool.glob')()(**/*.py')

2. Use dev.tool.grep to search for security issues
   → grep = m.mod('dev.tool.grep')()(pattern='password|secret')

3. Use claude with dev-tools backend for AI analysis
   → claude = Mod(backend='dev-tools')
   → analysis = claude.analyze_code(focus='security')

4. Use dev.tool.write to generate report
   → write = m.mod('dev.tool.write')()
   → write.forward('report.md', analysis)

5. Optional: Use agent for remediation planning
   → agent = m.mod('agent')()
   → plan = agent.forward(goal='Fix security issues')

All modules work together seamlessly!
""")

    print("✓ This is the power of the mod ecosystem")


def main():
    """Run all integration examples"""
    print("\n" + "="*60)
    print("MOD ECOSYSTEM INTEGRATION EXAMPLES")
    print("="*60)

    examples = [
        example_1_claude_with_agent,
        example_2_claude_with_dev_tools,
        example_3_multi_module_workflow,
        example_4_backend_comparison,
        example_5_cross_module_ai,
        example_6_extensibility,
        example_7_practical_scenario,
    ]

    for example in examples:
        try:
            example()
        except Exception as e:
            print(f"\n✗ Example failed: {e}")

    print("\n" + "="*60)
    print("Integration examples completed!")
    print("="*60 + "\n")

    if MOD_AVAILABLE:
        print("✅ Full mod ecosystem available")
        print("✅ All integration examples ran")
    else:
        print("⚠️  Some examples skipped (mod framework not available)")
        print("   Install mod framework for full integration")

    print()


if __name__ == "__main__":
    main()
