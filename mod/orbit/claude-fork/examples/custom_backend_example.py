"""
Custom Backend Example

Shows how to create and register your own custom AI code backend.
"""

import sys
from pathlib import Path
from typing import Dict, Any, Optional, Union

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from claude.backends import Backend, registry
from claude import Mod


# ═══════════════════════════════════════════════════════════════
# Example 1: Simple Echo Backend (for testing)
# ═══════════════════════════════════════════════════════════════

class EchoBackend(Backend):
    """
    A simple backend that echoes back the query.
    Useful for testing and understanding the backend interface.
    """

    @property
    def name(self) -> str:
        return "echo"

    @property
    def description(self) -> str:
        return "Simple echo backend for testing"

    def is_available(self) -> bool:
        """Always available since it's just echoing"""
        return True

    def install(self) -> bool:
        """Nothing to install"""
        return True

    def forward(
        self,
        query: str,
        path: Optional[str] = None,
        model: str = "default",
        stream_output: bool = False,
        **kwargs
    ) -> Union[str, Dict[str, Any]]:
        """Echo back the query with metadata"""

        if stream_output:
            print(f"\n{'='*60}")
            print("ECHO BACKEND OUTPUT")
            print(f"{'='*60}\n")
            print(f"Query: {query}")
            print(f"Path: {path}")
            print(f"Model: {model}")
            print(f"\n{'='*60}")
            print("ECHO BACKEND FINISHED")
            print(f"{'='*60}\n")

        return {
            "success": True,
            "backend": self.name,
            "query": query,
            "path": path,
            "model": model,
            "response": f"Echo: {query}"
        }


# ═══════════════════════════════════════════════════════════════
# Example 2: Local Model Backend (stub - extend with actual model)
# ═══════════════════════════════════════════════════════════════

class LocalModelBackend(Backend):
    """
    Backend for running local AI models (Llama, Mistral, etc).
    This is a stub - extend with actual model loading.
    """

    @property
    def name(self) -> str:
        return "local-model"

    @property
    def description(self) -> str:
        return "Local AI model (Llama, Mistral, etc.)"

    def __init__(self, model_path: Optional[str] = None, **kwargs):
        self.model_path = model_path
        self.model = None

    def is_available(self) -> bool:
        """Check if model is loaded"""
        # In a real implementation, check if model file exists
        # and can be loaded
        return self.model_path is not None

    def install(self) -> bool:
        """Download and set up the model"""
        # In a real implementation:
        # 1. Download model from HuggingFace
        # 2. Set up llama.cpp or similar
        # 3. Load model into memory
        print("To implement: Download and load local model")
        return False

    def forward(
        self,
        query: str,
        path: Optional[str] = None,
        model: str = "default",
        stream_output: bool = False,
        **kwargs
    ) -> Union[str, Dict[str, Any]]:
        """Run query through local model"""

        if not self.model:
            raise RuntimeError("Model not loaded. Call install() first.")

        # In a real implementation:
        # 1. Format prompt with context from path
        # 2. Run through local model
        # 3. Parse and return results

        return {
            "success": True,
            "backend": self.name,
            "response": "Local model response would go here",
            "model": model
        }


# ═══════════════════════════════════════════════════════════════
# Example 3: Gemini Backend
# ═══════════════════════════════════════════════════════════════

class GeminiBackend(Backend):
    """
    Backend for Google's Gemini AI.
    Requires google-generativeai package.
    """

    @property
    def name(self) -> str:
        return "gemini"

    @property
    def description(self) -> str:
        return "Google Gemini AI"

    def __init__(self, api_key: Optional[str] = None, **kwargs):
        import os
        self.api_key = api_key or os.getenv('GOOGLE_API_KEY')
        self._genai = None

    def is_available(self) -> bool:
        """Check if Gemini is available"""
        try:
            import google.generativeai as genai
            self._genai = genai
            return bool(self.api_key)
        except ImportError:
            return False

    def install(self) -> bool:
        """Install Gemini package"""
        import subprocess
        try:
            subprocess.run(
                ["pip", "install", "google-generativeai"],
                capture_output=True,
                timeout=60
            )
            return self.is_available()
        except Exception:
            return False

    def forward(
        self,
        query: str,
        path: Optional[str] = None,
        model: str = "gemini-pro",
        stream_output: bool = False,
        **kwargs
    ) -> Union[str, Dict[str, Any]]:
        """Execute query with Gemini"""

        if not self._genai:
            raise RuntimeError("Gemini not available")

        self._genai.configure(api_key=self.api_key)
        model_obj = self._genai.GenerativeModel(model)

        # Build prompt with context
        prompt = f"""You are an expert code assistant.
Working directory: {path or 'unknown'}

Task: {query}

Provide clear, actionable code suggestions and explanations.
"""

        if stream_output:
            print(f"\n{'='*60}")
            print("GEMINI OUTPUT (LIVE)")
            print(f"{'='*60}\n")

            response = model_obj.generate_content(prompt, stream=True)
            full_text = []
            for chunk in response:
                if chunk.text:
                    print(chunk.text, end='', flush=True)
                    full_text.append(chunk.text)

            print(f"\n{'='*60}")
            print("GEMINI FINISHED")
            print(f"{'='*60}\n")

            return {
                "success": True,
                "backend": self.name,
                "response": ''.join(full_text),
                "model": model
            }
        else:
            response = model_obj.generate_content(prompt)
            return {
                "success": True,
                "backend": self.name,
                "response": response.text,
                "model": model
            }


# ═══════════════════════════════════════════════════════════════
# Usage Examples
# ═══════════════════════════════════════════════════════════════

def demo_custom_backends():
    """Demonstrate custom backends"""

    print("\n" + "="*60)
    print("CUSTOM BACKEND EXAMPLES")
    print("="*60 + "\n")

    # Register custom backends
    print("Registering custom backends...")
    registry.register('echo', EchoBackend)
    registry.register('local-model', LocalModelBackend)
    registry.register('gemini', GeminiBackend)
    print("✓ Registered: echo, local-model, gemini\n")

    # Example 1: Echo backend
    print("\n" + "-"*60)
    print("Example 1: Echo Backend")
    print("-"*60)

    try:
        mod = Mod(backend='echo')
        result = mod.forward("Analyze security vulnerabilities", stream_output=True)
        print(f"\nResult: {result}\n")
    except Exception as e:
        print(f"Error: {e}\n")

    # Example 2: List all backends (including custom ones)
    print("\n" + "-"*60)
    print("Example 2: List All Backends")
    print("-"*60)

    backends = Mod.list_backends()
    print(f"\nTotal backends: {len(backends)}\n")
    for b in backends:
        status = "✓" if b['available'] else "✗"
        print(f"{status} {b['name']:15} - {b['description']}")

    # Example 3: Switch between backends
    print("\n" + "-"*60)
    print("Example 3: Switch Between Backends")
    print("-"*60)

    try:
        mod = Mod(backend='echo')
        print(f"Started with: {mod.backend.name}")

        # Switch to another backend
        mod.switch_backend('dev-tools')
        print(f"Switched to: {mod.backend.name}")

        # Switch back to custom backend
        mod.switch_backend('echo')
        print(f"Switched back to: {mod.backend.name}")
    except Exception as e:
        print(f"Error: {e}")

    # Example 4: Gemini backend (if available)
    print("\n" + "-"*60)
    print("Example 4: Gemini Backend")
    print("-"*60)

    try:
        mod = Mod(backend='gemini', auto_install=False)
        print(f"✓ Gemini backend initialized")
        # Uncomment to actually use it:
        # result = mod.forward("Explain this code pattern", stream_output=True)
    except Exception as e:
        print(f"✗ Gemini not available: {e}")

    print("\n" + "="*60)
    print("Custom backend examples completed!")
    print("="*60 + "\n")


def create_your_own_backend():
    """Template for creating your own backend"""

    print("\n" + "="*60)
    print("CREATE YOUR OWN BACKEND - Template")
    print("="*60 + "\n")

    template = '''
from claude.backends import Backend, registry
from typing import Dict, Any, Optional, Union

class MyBackend(Backend):
    """Your custom backend description"""

    @property
    def name(self) -> str:
        return "my-backend"  # Unique identifier

    @property
    def description(self) -> str:
        return "My custom AI backend"  # Human-readable description

    def __init__(self, api_key: Optional[str] = None, **kwargs):
        """Initialize your backend"""
        self.api_key = api_key
        # Add your initialization code here

    def is_available(self) -> bool:
        """Check if backend is ready to use"""
        # Check dependencies, API keys, etc.
        return True  # or False

    def install(self) -> bool:
        """Install/setup the backend"""
        # Download models, install packages, etc.
        return True  # or False

    def forward(
        self,
        query: str,
        path: Optional[str] = None,
        model: str = "default",
        stream_output: bool = False,
        **kwargs
    ) -> Union[str, Dict[str, Any]]:
        """Execute a query"""

        # 1. Process the query
        # 2. Call your AI service/model
        # 3. Return results

        return {
            "success": True,
            "backend": self.name,
            "response": "Your response here"
        }

# Register it
registry.register('my-backend', MyBackend)

# Use it
from claude import Mod
mod = Mod(backend='my-backend')
result = mod.forward("Your query here")
'''

    print(template)
    print("\n✓ Copy this template and customize it for your needs!\n")


if __name__ == "__main__":
    # Run the demo
    demo_custom_backends()

    # Show template
    create_your_own_backend()
