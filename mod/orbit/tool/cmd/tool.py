import subprocess
from typing import Dict, Any, List, Union

class Tool:
    """
    Command line tool that executes shell commands and returns the output.
    """
    
    def forward(
        self,
        cmd: Union[str, List[str]], **kwargs) -> Dict[str, Any]:
        """
        Execute a shell command and return the results.
        
        Args:
            cmd: Command to execute (string or list of arguments)
            **kwargs: Additional arguments passed to subprocess.run
            
        Returns:
            Dictionary with:
            - success: Whether the command executed successfully
            - stdout: Standard output from the command
            - stderr: Standard error from the command
            - returncode: Exit code of the command
        """
        try:
            # Determine if we need shell=True
            shell = isinstance(cmd, str)
            
            # Run the command and capture output
            result = subprocess.run(
                cmd,
                shell=shell,
                capture_output=True,
                text=True,
                **kwargs
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "output": result.stdout if result.returncode == 0 else result.stderr
            }
            
        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "returncode": -1,
                "output": str(e)
            }
