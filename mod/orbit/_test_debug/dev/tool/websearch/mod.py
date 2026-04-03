"""
Web Search Tool

Searches the web using DuckDuckGo and returns relevant results.
"""

import requests
from typing import Dict, List, Any, Optional


class Tool:
    """Web search tool for finding information online"""

    description = """
    Search the web for information using DuckDuckGo.
    Returns a list of search results with titles, snippets, and URLs.
    """

    def __init__(self, max_results: int = 5, **kwargs):
        """
        Initialize web search tool.

        Args:
            max_results: Maximum number of results to return (default: 5)
        """
        self.max_results = max_results

    def forward(
        self,
        query: str,
        max_results: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Search the web for the given query.

        Args:
            query: Search query string
            max_results: Override default max results
            **kwargs: Additional arguments

        Returns:
            Dictionary with search results:
            {
                "success": bool,
                "message": str,
                "query": str,
                "results": [
                    {
                        "title": str,
                        "snippet": str,
                        "url": str
                    },
                    ...
                ]
            }
        """
        try:
            if not query or not query.strip():
                return {
                    "success": False,
                    "message": "Query cannot be empty",
                    "query": query,
                    "results": []
                }

            max_res = max_results or self.max_results

            # Use DuckDuckGo HTML search
            url = "https://html.duckduckgo.com/html/"
            params = {"q": query}
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }

            response = requests.post(url, data=params, headers=headers, timeout=10)
            response.raise_for_status()

            # Parse results (simplified - in production use BeautifulSoup)
            from html.parser import HTMLParser

            class DDGParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.results = []
                    self.current_result = {}
                    self.in_result = False
                    self.in_title = False
                    self.in_snippet = False

                def handle_starttag(self, tag, attrs):
                    attrs_dict = dict(attrs)
                    if tag == 'a' and attrs_dict.get('class') == 'result__a':
                        self.in_title = True
                        self.current_result = {'url': attrs_dict.get('href', '')}
                    elif tag == 'a' and attrs_dict.get('class') == 'result__snippet':
                        self.in_snippet = True

                def handle_data(self, data):
                    if self.in_title:
                        self.current_result['title'] = data.strip()
                    elif self.in_snippet:
                        self.current_result['snippet'] = data.strip()

                def handle_endtag(self, tag):
                    if self.in_title:
                        self.in_title = False
                    elif self.in_snippet:
                        self.in_snippet = False
                        if all(k in self.current_result for k in ['title', 'snippet', 'url']):
                            self.results.append(self.current_result.copy())
                            self.current_result = {}

            parser = DDGParser()
            parser.feed(response.text)
            results = parser.results[:max_res]

            # Fallback: Use DuckDuckGo API alternative
            if not results:
                try:
                    api_url = f"https://api.duckduckgo.com/?q={query}&format=json"
                    api_response = requests.get(api_url, timeout=10)
                    data = api_response.json()

                    results = []
                    for item in data.get('RelatedTopics', [])[:max_res]:
                        if 'Text' in item and 'FirstURL' in item:
                            results.append({
                                'title': item.get('Text', '')[:100],
                                'snippet': item.get('Text', ''),
                                'url': item.get('FirstURL', '')
                            })
                except:
                    pass

            return {
                "success": True,
                "message": f"Found {len(results)} results for '{query}'",
                "query": query,
                "results": results
            }

        except requests.Timeout:
            return {
                "success": False,
                "message": "Search request timed out",
                "query": query,
                "results": []
            }
        except requests.RequestException as e:
            return {
                "success": False,
                "message": f"Network error: {str(e)}",
                "query": query,
                "results": []
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error searching: {str(e)}",
                "query": query,
                "results": []
            }

    def test(self, **kwargs) -> Dict[str, Any]:
        """Test the web search tool"""
        result = self.forward("Python programming language")
        assert result["success"], "Search should succeed"
        assert len(result["results"]) > 0, "Should return results"
        return {
            "success": True,
            "message": "Web search test passed",
            "test_results": result
        }


if __name__ == "__main__":
    tool = Tool()
    print(tool.test())
