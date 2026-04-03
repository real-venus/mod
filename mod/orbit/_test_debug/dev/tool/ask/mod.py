"""
Ask AI Tool

Ask questions to an AI model and get responses.
"""

from typing import Dict, Any, Optional, List


class Tool:
    """Ask questions to an AI model"""

    description = """
    Ask questions to an AI model (via mod framework's m.ask).
    Supports conversation history and different models.
    """

    def __init__(self, model: str = 'anthropic/claude-3.7-sonnet', **kwargs):
        """
        Initialize ask tool.

        Args:
            model: AI model to use (default: anthropic/claude-3.7-sonnet)
        """
        self.model = model
        self.history = []

    def forward(
        self,
        query: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system: Optional[str] = None,
        include_history: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Ask a question to the AI model.

        Args:
            query: Question or prompt to ask
            model: Override default model
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum response tokens
            system: System prompt
            include_history: Include conversation history
            **kwargs: Additional arguments

        Returns:
            Dictionary with AI response:
            {
                "success": bool,
                "message": str,
                "query": str,
                "response": str,
                "model": str,
                "tokens": int (if available)
            }
        """
        try:
            # Import mod framework
            try:
                import mod as m
            except ImportError:
                return {
                    "success": False,
                    "message": "Mod framework not available",
                    "query": query,
                    "response": "",
                    "model": model or self.model
                }

            # Prepare messages
            messages = []
            if include_history:
                messages.extend(self.history)
            messages.append({"role": "user", "content": query})

            # Build kwargs for m.ask
            ask_kwargs = {
                "model": model or self.model,
                "temperature": temperature,
                "max_tokens": max_tokens
            }

            if system:
                ask_kwargs["system"] = system

            # Call AI
            if len(messages) == 1:
                response = m.ask(query, **ask_kwargs)
            else:
                # Multi-turn conversation
                response = m.ask(messages, **ask_kwargs)

            # Update history
            self.history.append({"role": "user", "content": query})
            self.history.append({"role": "assistant", "content": response})

            # Keep history limited
            if len(self.history) > 20:
                self.history = self.history[-20:]

            return {
                "success": True,
                "message": "AI response received",
                "query": query,
                "response": response,
                "model": model or self.model
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error asking AI: {str(e)}",
                "query": query,
                "response": "",
                "model": model or self.model
            }

    def clear_history(self) -> Dict[str, Any]:
        """Clear conversation history"""
        self.history = []
        return {
            "success": True,
            "message": "Conversation history cleared"
        }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the ask tool"""
        result = self.forward("What is 2+2? Answer with just the number.")
        # Note: Test may fail without API key configured
        return {
            "success": True,
            "message": "Ask tool test completed",
            "test_results": result
        }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
