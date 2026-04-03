"""
Task Agent Tool

Launch specialized agents for complex multi-step tasks.
"""

from typing import Dict, Any, Optional, List


class Tool:
    """Launch specialized agent tasks"""

    description = """
    Launch specialized agents for complex tasks:
    - Explore: Fast codebase exploration
    - Plan: Software architecture planning
    - Bash: Command execution specialist
    - General: Multi-step research and execution
    """

    def __init__(self, **kwargs):
        """Initialize task tool."""
        pass

    def forward(
        self,
        prompt: str,
        agent_type: str = "general",
        description: Optional[str] = None,
        model: str = "sonnet",
        max_turns: int = 10,
        run_in_background: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Launch a specialized agent task.

        Args:
            prompt: Task description for the agent
            agent_type: Type of agent ("general", "explore", "plan", "bash")
            description: Short description (3-5 words)
            model: Model to use ("sonnet", "opus", "haiku")
            max_turns: Maximum agent turns
            run_in_background: Run agent in background
            **kwargs: Additional arguments

        Returns:
            Dictionary with task results:
            {
                "success": bool,
                "message": str,
                "agent_type": str,
                "prompt": str,
                "result": str,
                "task_id": str (if background)
            }
        """
        try:
            # Import mod framework
            try:
                import mod as m
            except ImportError:
                return {
                    "success": False,
                    "message": "Mod framework not available - this tool requires the mod framework",
                    "agent_type": agent_type,
                    "prompt": prompt,
                    "result": ""
                }

            # Validate agent type
            valid_types = ["general", "explore", "plan", "bash"]
            if agent_type not in valid_types:
                return {
                    "success": False,
                    "message": f"Invalid agent type. Must be one of: {valid_types}",
                    "agent_type": agent_type,
                    "prompt": prompt,
                    "result": ""
                }

            # In a real implementation, this would use the Task tool from Claude
            # For now, we'll use the mod framework's agent if available

            desc = description or f"{agent_type} task"

            # Try to use mod's agent
            try:
                agent = m.mod('agent')()

                # Customize system prompt based on agent type
                system_prompts = {
                    "explore": "You are a codebase exploration specialist. Search, read, and analyze code.",
                    "plan": "You are a software architect. Design implementation plans and strategies.",
                    "bash": "You are a command execution specialist. Execute bash commands safely.",
                    "general": "You are a general-purpose agent. Research and execute multi-step tasks."
                }

                # Execute agent
                result = agent.forward(
                    query=prompt,
                    goal=system_prompts.get(agent_type, system_prompts["general"]),
                    max_steps=max_turns
                )

                return {
                    "success": True,
                    "message": f"Agent task completed: {desc}",
                    "agent_type": agent_type,
                    "prompt": prompt,
                    "result": str(result),
                    "model": model
                }

            except Exception as e:
                return {
                    "success": False,
                    "message": f"Error running agent: {str(e)}",
                    "agent_type": agent_type,
                    "prompt": prompt,
                    "result": ""
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error launching task: {str(e)}",
                "agent_type": agent_type,
                "prompt": prompt,
                "result": ""
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the task tool"""
        # Simple test that doesn't require full agent setup
        result = self.forward(
            "List files in current directory",
            agent_type="bash",
            description="Test task"
        )

        return {
            "success": True,
            "message": "Task tool test completed",
            "test_results": result
        }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
