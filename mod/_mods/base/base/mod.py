import requests
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport

class BaseMod:
    description = """
    Base mod - Uniswap GraphQL scraper
    """
    
    def __init__(self):
        """Initialize Uniswap V3 GraphQL client"""
        self.uniswap_v3_url = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"
        self.transport = RequestsHTTPTransport(url=self.uniswap_v3_url)
        self.client = Client(transport=self.transport, fetch_schema_from_transport=True)
    
    def get_pools(self, first: int = 10):
        """Fetch top Uniswap pools via GraphQL"""
        query = gql("""
            query GetPools($first: Int!) {
                pools(first: $first, orderBy: totalValueLockedUSD, orderDirection: desc) {
                    id
                    token0 {
                        symbol
                        name
                    }
                    token1 {
                        symbol
                        name
                    }
                    totalValueLockedUSD
                    volumeUSD
                    feeTier
                }
            }
        """)
        try:
            result = self.client.execute(query, variable_values={"first": first})
            return result.get('pools', [])
        except Exception as e:
            return {"error": str(e)}
    
    def get_token_info(self, token_address: str):
        """Fetch token information via GraphQL"""
        query = gql("""
            query GetToken($id: ID!) {
                token(id: $id) {
                    id
                    symbol
                    name
                    decimals
                    totalSupply
                    volume
                    volumeUSD
                    txCount
                    totalValueLocked
                    totalValueLockedUSD
                }
            }
        """)
        try:
            result = self.client.execute(query, variable_values={"id": token_address.lower()})
            return result.get('token', {})
        except Exception as e:
            return {"error": str(e)}
    
    def get_swaps(self, first: int = 10):
        """Fetch recent swaps via GraphQL"""
        query = gql("""
            query GetSwaps($first: Int!) {
                swaps(first: $first, orderBy: timestamp, orderDirection: desc) {
                    id
                    timestamp
                    amount0
                    amount1
                    amountUSD
                    token0 {
                        symbol
                    }
                    token1 {
                        symbol
                    }
                }
            }
        """)
        try:
            result = self.client.execute(query, variable_values={"first": first})
            return result.get('swaps', [])
        except Exception as e:
            return {"error": str(e)}
    
    def multiply(self, a, b):
        """Multiply two numbers and return the result."""
        return a * b
    
    def get_bittenso_price(self):
        """Fetch the price of Bittenso cryptocurrency."""
        try:
            response = requests.get('https://api.coingecko.com/api/v3/simple/price?ids=bittenso&vs_currencies=usd')
            response.raise_for_status()
            data = response.json()
            return data.get('bittenso', {}).get('usd', 'Price not available')
        except Exception as e:
            return f"Error fetching price: {str(e)}"
