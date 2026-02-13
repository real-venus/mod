import requests
from typing import List, Dict, Any


class Mod:
    description = """
    GitHub Repository Search - Search GitHub repos using only requests library
    """

    def __init__(self):
        self.base_url = "https://api.github.com/search/repositories"
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "GitSearch-Agent"
        }

    def forward(self, query: str, sort: str = "stars", order: str = "desc", per_page: int = 10) -> List[Dict[str, Any]]:
        """
        Search GitHub repositories based on query.
        
        Args:
            query: Search query string
            sort: Sort by 'stars', 'forks', 'updated' (default: 'stars')
            order: Order 'asc' or 'desc' (default: 'desc')
            per_page: Number of results per page (default: 10, max: 100)
            
        Returns:
            List of repository dictionaries with key info
        """
        params = {
            "q": query,
            "sort": sort,
            "order": order,
            "per_page": min(per_page, 100)
        }
        
        try:
            response = requests.get(self.base_url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            repos = []
            for item in data.get("items", []):
                repos.append({
                    "name": item.get("name"),
                    "full_name": item.get("full_name"),
                    "description": item.get("description"),
                    "url": item.get("html_url"),
                    "stars": item.get("stargazers_count"),
                    "forks": item.get("forks_count"),
                    "language": item.get("language"),
                    "updated_at": item.get("updated_at"),
                    "topics": item.get("topics", [])
                })
            
            return repos
            
        except requests.exceptions.RequestException as e:
            return [{"error": f"Request failed: {str(e)}"}]
        except Exception as e:
            return [{"error": f"Unexpected error: {str(e)}"}]
