"""
HTTP Request Tool

Make HTTP requests (GET, POST, PUT, DELETE, etc.)
"""

import requests
from typing import Dict, Any, Optional


class Tool:
    """Make HTTP requests"""

    description = """
    Make HTTP requests with support for:
    - All HTTP methods (GET, POST, PUT, DELETE, etc.)
    - Headers and authentication
    - JSON and form data
    - File uploads
    - Timeout and retry
    """

    def __init__(self, timeout: int = 30, **kwargs):
        """
        Initialize HTTP tool.

        Args:
            timeout: Request timeout in seconds (default: 30)
        """
        self.timeout = timeout

    def forward(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        timeout: Optional[int] = None,
        auth: Optional[tuple] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make an HTTP request.

        Args:
            url: Request URL
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            headers: Request headers
            params: URL query parameters
            data: Form data
            json: JSON body data
            timeout: Request timeout
            auth: Tuple of (username, password) for basic auth
            **kwargs: Additional requests kwargs

        Returns:
            Dictionary with response:
            {
                "success": bool,
                "message": str,
                "status_code": int,
                "headers": dict,
                "body": str,
                "json": dict (if JSON response),
                "url": str
            }
        """
        try:
            # Prepare request
            req_timeout = timeout or self.timeout
            method = method.upper()

            # Make request
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                data=data,
                json=json,
                timeout=req_timeout,
                auth=auth,
                **kwargs
            )

            # Parse response
            result = {
                "success": response.ok,
                "message": f"{method} request to {url} completed with status {response.status_code}",
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response.text,
                "url": response.url
            }

            # Try to parse JSON
            try:
                result["json"] = response.json()
            except:
                result["json"] = None

            return result

        except requests.Timeout:
            return {
                "success": False,
                "message": f"Request timed out after {req_timeout} seconds",
                "status_code": 0,
                "headers": {},
                "body": "",
                "url": url
            }
        except requests.RequestException as e:
            return {
                "success": False,
                "message": f"Request error: {str(e)}",
                "status_code": 0,
                "headers": {},
                "body": str(e),
                "url": url
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error making request: {str(e)}",
                "status_code": 0,
                "headers": {},
                "body": str(e),
                "url": url
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the HTTP tool"""
        # Test GET request
        result = self.forward("https://httpbin.org/get")
        assert result["success"], "GET request should succeed"
        assert result["status_code"] == 200, "Should return 200"

        return {
            "success": True,
            "message": "HTTP tool tests passed",
            "test_results": result
        }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
