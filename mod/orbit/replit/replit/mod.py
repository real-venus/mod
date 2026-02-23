import os
import json
from typing import Optional, Dict, List, Any, Union
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport


class Mod:
    """
    Replit GraphQL API Client

    A comprehensive Python client for interacting with Replit's GraphQL API.
    Supports user queries, repl management, and platform metadata retrieval.

    Authentication:
        - Set REPLIT_SID environment variable with your connect.sid cookie
        - Obtain from browser DevTools while logged in to Replit

    Usage:
        client = Mod()
        user = client.get_user_by_username("username")
        repls = client.get_user_repls("username")
    """

    description = """Replit GraphQL API Client - query users, repls, and platform data"""

    # Replit GraphQL endpoint
    GRAPHQL_ENDPOINT = "https://replit.com/graphql"

    def __init__(self, sid: Optional[str] = None):
        """
        Initialize Replit API client

        Args:
            sid: Replit session ID (connect.sid cookie). Falls back to REPLIT_SID env var
        """
        self.sid = sid or os.getenv("REPLIT_SID")
        self.client = self._create_client()

    def _create_client(self) -> Client:
        """Create and configure GraphQL client with authentication"""
        headers = {}
        if self.sid:
            headers["Cookie"] = f"connect.sid={self.sid}"

        transport = RequestsHTTPTransport(
            url=self.GRAPHQL_ENDPOINT,
            headers=headers,
            verify=True,
            retries=3,
        )

        return Client(transport=transport, fetch_schema_from_transport=False)

    def execute(self, query: str, variables: Optional[Dict] = None) -> Dict:
        """
        Execute raw GraphQL query

        Args:
            query: GraphQL query string
            variables: Optional query variables

        Returns:
            Query result as dictionary
        """
        return self.client.execute(gql(query), variable_values=variables or {})

    # ========================
    # USER QUERIES
    # ========================

    def get_user_by_username(self, username: str) -> Optional[Dict]:
        """
        Get user information by username

        Args:
            username: Replit username

        Returns:
            User data including id, bio, firstName, lastName, timeCreated, etc.
        """
        query = """
        query UserByUsername($username: String!) {
            userByUsername(username: $username) {
                id
                username
                firstName
                lastName
                bio
                url
                displayName
                fullName
                image
                timeCreated
                isVerified
                locale
                roles {
                    id
                    name
                    tagline
                }
                subscription {
                    planId
                }
            }
        }
        """
        result = self.execute(query, {"username": username})
        return result.get("userByUsername")

    def get_current_user(self) -> Optional[Dict]:
        """
        Get currently authenticated user

        Returns:
            Current user data (requires authentication)
        """
        query = """
        query CurrentUser {
            currentUser {
                id
                username
                firstName
                lastName
                bio
                url
                displayName
                email
                gate {
                    id
                    type
                }
                timeCreated
                isVerified
            }
        }
        """
        result = self.execute(query)
        return result.get("currentUser")

    # ========================
    # REPL QUERIES
    # ========================

    def get_repl_by_id(self, repl_id: str) -> Optional[Dict]:
        """
        Get repl by ID

        Args:
            repl_id: Repl ID

        Returns:
            Repl data including title, description, language, files, etc.
        """
        query = """
        query ReplById($id: String!) {
            repl(id: $id) {
                id
                title
                slug
                description
                isPrivate
                isStarred
                timeCreated
                timeUpdated
                url
                imageUrl
                lang {
                    id
                    displayName
                    canUseShellRunner
                }
                owner {
                    id
                    username
                }
                size
                hostedUrl
            }
        }
        """
        result = self.execute(query, {"id": repl_id})
        return result.get("repl")

    def get_repl_by_url(self, url: str) -> Optional[Dict]:
        """
        Get repl by URL (e.g., @username/repl-name)

        Args:
            url: Repl URL path

        Returns:
            Repl data
        """
        query = """
        query ReplByUrl($url: String!) {
            repl(url: $url) {
                id
                title
                slug
                description
                isPrivate
                timeCreated
                url
                lang {
                    id
                    displayName
                }
                owner {
                    id
                    username
                }
            }
        }
        """
        result = self.execute(query, {"url": url})
        return result.get("repl")

    def get_user_repls(self, username: str, count: int = 10) -> List[Dict]:
        """
        Get user's public repls

        Args:
            username: Replit username
            count: Number of repls to fetch (default 10)

        Returns:
            List of repl data
        """
        query = """
        query UserRepls($username: String!, $count: Int!) {
            userByUsername(username: $username) {
                publicRepls(count: $count) {
                    items {
                        id
                        title
                        slug
                        description
                        timeCreated
                        url
                        imageUrl
                        lang {
                            displayName
                        }
                    }
                }
            }
        }
        """
        result = self.execute(query, {"username": username, "count": count})
        user_data = result.get("userByUsername")
        if user_data and "publicRepls" in user_data:
            return user_data["publicRepls"].get("items", [])
        return []

    def search_repls(self, query_text: str, count: int = 10) -> List[Dict]:
        """
        Search for repls

        Args:
            query_text: Search query
            count: Number of results (default 10)

        Returns:
            List of matching repls
        """
        query = """
        query SearchRepls($query: String!, $count: Int!) {
            replSearch(options: {query: $query, count: $count}) {
                items {
                    id
                    title
                    description
                    url
                    lang {
                        displayName
                    }
                    owner {
                        username
                    }
                }
            }
        }
        """
        result = self.execute(query, {"query": query_text, "count": count})
        search_data = result.get("replSearch")
        if search_data:
            return search_data.get("items", [])
        return []

    # ========================
    # LANGUAGE QUERIES
    # ========================

    def get_languages(self) -> List[Dict]:
        """
        Get all available programming languages on Replit

        Returns:
            List of language data
        """
        query = """
        query Languages {
            languages {
                id
                displayName
                key
                category
                canUseShellRunner
            }
        }
        """
        result = self.execute(query)
        return result.get("languages", [])

    # ========================
    # MUTATIONS (requires auth)
    # ========================

    def create_repl(self, title: str, language: str, is_private: bool = True) -> Optional[Dict]:
        """
        Create a new repl (requires authentication)

        Args:
            title: Repl title
            language: Language key (e.g., "python3", "nodejs")
            is_private: Private or public (default True)

        Returns:
            Created repl data
        """
        mutation = """
        mutation CreateRepl($title: String!, $language: String!, $isPrivate: Boolean!) {
            createRepl(input: {
                title: $title
                languageKey: $language
                isPrivate: $isPrivate
            }) {
                id
                title
                url
                slug
            }
        }
        """
        result = self.execute(mutation, {
            "title": title,
            "language": language,
            "isPrivate": is_private
        })
        return result.get("createRepl")

    def update_repl(self, repl_id: str, title: Optional[str] = None,
                    description: Optional[str] = None) -> Optional[Dict]:
        """
        Update repl metadata (requires authentication and ownership)

        Args:
            repl_id: Repl ID
            title: New title (optional)
            description: New description (optional)

        Returns:
            Updated repl data
        """
        mutation = """
        mutation UpdateRepl($id: String!, $title: String, $description: String) {
            updateRepl(input: {
                id: $id
                title: $title
                description: $description
            }) {
                id
                title
                description
            }
        }
        """
        variables = {"id": repl_id}
        if title:
            variables["title"] = title
        if description:
            variables["description"] = description

        result = self.execute(mutation, variables)
        return result.get("updateRepl")

    def delete_repl(self, repl_id: str) -> bool:
        """
        Delete a repl (requires authentication and ownership)

        Args:
            repl_id: Repl ID

        Returns:
            True if successful
        """
        mutation = """
        mutation DeleteRepl($id: String!) {
            deleteRepl(id: $id) {
                id
            }
        }
        """
        result = self.execute(mutation, {"id": repl_id})
        return result.get("deleteRepl") is not None

    # ========================
    # UTILITY METHODS
    # ========================

    def forward(self, username: str, query: Optional[str] = None) -> Dict:
        """
        Main forward method - versatile query dispatcher

        Args:
            username: Username to query
            query: Optional query type ('user', 'repls', or custom GraphQL)

        Returns:
            Query results
        """
        if query == "repls":
            return {"repls": self.get_user_repls(username)}
        elif query and query.startswith("query "):
            # Custom GraphQL query
            return self.execute(query)
        else:
            # Default: get user info
            return {"user": self.get_user_by_username(username)}

    def get_repl_info(self, identifier: str) -> Optional[Dict]:
        """
        Get repl info by ID or URL (auto-detects)

        Args:
            identifier: Repl ID or URL path

        Returns:
            Repl data
        """
        if identifier.startswith("@"):
            return self.get_repl_by_url(identifier)
        else:
            return self.get_repl_by_id(identifier)

    def __repr__(self) -> str:
        auth_status = "authenticated" if self.sid else "unauthenticated"
        return f"<ReplitMod {auth_status}>"

    def __str__(self) -> str:
        return self.description
