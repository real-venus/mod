"""
Bash Command Execution Tool

Executes shell commands and returns output.
"""

import subprocess
import os
from typing import Dict, Any, Optional


class Tool:
    """Execute bash commands safely"""

    description = """
    Execute bash/shell commands and return output.
    Supports working directory changes and environment variables.
    """

    def __init__(self, cwd: Optional[str] = None, timeout: int = 30, **kwargs):
        """
        Initialize bash tool.

        Args:
            cwd: Working directory for commands (default: current dir)
            timeout: Command timeout in seconds (default: 30)
        """
        self.cwd = cwd or os.getcwd()
        self.timeout = timeout

    def forward(
        self,
        command: str,
        cwd: Optional[str] = None,
        timeout: Optional[int] = None,
        env: Optional[Dict[str, str]] = None,
        shell: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Execute a bash command.

        Args:
            command: Command to execute
            cwd: Override working directory
            timeout: Override timeout
            env: Environment variables to add/override
            shell: Execute through shell (default: True)
            **kwargs: Additional arguments

        Returns:
            Dictionary with execution results:
            {
                "success": bool,
                "message": str,
                "command": str,
                "stdout": str,
                "stderr": str,
                "returncode": int,
                "cwd": str
            }
        """
        try:
            working_dir = cwd or self.cwd
            cmd_timeout = timeout or self.timeout

            # Prepare environment
            cmd_env = os.environ.copy()
            if env:
                cmd_env.update(env)

            # Execute command
            result = subprocess.run(
                command,
                shell=shell,
                cwd=working_dir,
                env=cmd_env,
                capture_output=True,
                text=True,
                timeout=cmd_timeout
            )

            success = result.returncode == 0

            return {
                "success": success,
                "message": "Command executed successfully" if success else f"Command failed with code {result.returncode}",
                "command": command,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "cwd": working_dir
            }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": f"Command timed out after {cmd_timeout} seconds",
                "command": command,
                "stdout": "",
                "stderr": f"Timeout after {cmd_timeout}s",
                "returncode": -1,
                "cwd": working_dir
            }
        except FileNotFoundError:
            return {
                "success": False,
                "message": f"Working directory not found: {working_dir}",
                "command": command,
                "stdout": "",
                "stderr": f"Directory not found: {working_dir}",
                "returncode": -1,
                "cwd": working_dir
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error executing command: {str(e)}",
                "command": command,
                "stdout": "",
                "stderr": str(e),
                "returncode": -1,
                "cwd": working_dir or self.cwd
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the bash tool"""
        # Test simple command
        result = self.forward("echo 'Hello, World!'")
        assert result["success"], "Echo command should succeed"
        assert "Hello, World!" in result["stdout"], "Output should contain test string"

        # Test ls command
        result2 = self.forward("ls -la")
        assert result2["success"], "ls command should succeed"

        return {
            "success": True,
            "message": "Bash tool tests passed",
            "test_results": [result, result2]
        }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
