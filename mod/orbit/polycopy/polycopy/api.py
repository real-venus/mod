"""Polymarket API client - self-contained, no external module dependencies"""

import requests
from typing import Dict, List, Optional


class PolymarketAPI:
    """Lightweight Polymarket API client for data fetching"""

    def __init__(self):
        self.session = requests.Session()
        self.base_url = "https://data-api.polymarket.com"
        self.clob_url = "https://clob.polymarket.com"
        self.gamma_url = "https://gamma-api.polymarket.com"

        # Cache for working endpoints (address -> endpoint_url)
        self._position_endpoint_cache = {}
        self._trade_endpoint_cache = {}

    def get_user_positions(self, address: str) -> Dict:
        """Fetch user's current positions - tries multiple endpoints"""

        # Check cache first
        if address in self._position_endpoint_cache:
            cached_url = self._position_endpoint_cache[address]
            try:
                response = self.session.get(cached_url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    positions = data if isinstance(data, list) else data.get('positions', data.get('data', []))
                    total_value = sum(float(p.get('currentValue', 0) or 0) for p in positions)
                    return {'positions': positions, 'totalValue': str(total_value)}
            except Exception:
                # Cache miss, continue to full endpoint search
                pass

        # Try different endpoint formats
        endpoints = [
            f"{self.gamma_url}/positions",  # Try gamma API with query param
            f"{self.base_url}/users/{address}/positions",
            f"{self.clob_url}/positions/{address}",
            f"{self.base_url}/positions?user={address}",
        ]

        for i, url in enumerate(endpoints):
            try:
                # For gamma API, pass address as query param
                params = {'user': address} if i == 0 else {}
                response = self.session.get(url, params=params, timeout=10)

                # If 404, try next endpoint
                if response.status_code == 404:
                    continue

                response.raise_for_status()
                data = response.json()

                # Parse response
                if isinstance(data, list):
                    positions = data
                elif isinstance(data, dict):
                    positions = data.get('positions', data.get('data', []))
                else:
                    positions = []

                # Calculate total value
                total_value = sum(float(p.get('currentValue', 0) or 0) for p in positions)

                # Cache successful endpoint
                self._position_endpoint_cache[address] = url

                return {
                    'positions': positions,
                    'totalValue': str(total_value)
                }

            except requests.exceptions.RequestException as e:
                # Only log if it's the last endpoint
                if url == endpoints[-1]:
                    print(f"[API] All endpoints failed for {address[:10]}... - positions may be empty or address inactive")
                continue
            except Exception as e:
                continue

        # All endpoints failed - return empty but don't spam errors
        return {'positions': [], 'totalValue': '0'}

    def get_user_trades(self, address: str, limit: int = 10) -> Dict:
        """Fetch user's trade history - tries multiple endpoints"""

        endpoints = [
            (f"{self.base_url}/users/{address}/trades", {'limit': limit}),
            (f"{self.clob_url}/trades/{address}", {'limit': limit}),
            (f"{self.base_url}/trades", {'user': address, 'limit': limit}),
        ]

        for url, params in endpoints:
            try:
                response = self.session.get(url, params=params, timeout=10)

                # If 404, try next endpoint
                if response.status_code == 404:
                    continue

                response.raise_for_status()
                data = response.json()

                # Parse response
                if isinstance(data, list):
                    trades = data
                elif isinstance(data, dict):
                    trades = data.get('trades', data.get('data', []))
                else:
                    trades = []

                return {'trades': trades}

            except requests.exceptions.RequestException:
                # Try next endpoint
                continue
            except Exception:
                continue

        # All endpoints failed
        print(f"[API] Could not fetch trades for {address[:10]}... - using empty list")
        return {'trades': []}

    def test_endpoints(self, address: str) -> Dict:
        """
        Test all API endpoints for a given address to find which ones work

        Args:
            address: Wallet address to test

        Returns:
            Dict with endpoint test results
        """
        results = {
            'address': address,
            'positions': {},
            'trades': {}
        }

        # Test position endpoints
        position_endpoints = [
            ("gamma_positions", f"{self.gamma_url}/positions", {'user': address}),
            ("data_users_positions", f"{self.base_url}/users/{address}/positions", {}),
            ("clob_positions", f"{self.clob_url}/positions/{address}", {}),
            ("data_positions_query", f"{self.base_url}/positions", {'user': address}),
        ]

        print(f"\n{'='*80}")
        print(f"Testing Position Endpoints for {address}")
        print(f"{'='*80}\n")

        for name, url, params in position_endpoints:
            try:
                response = self.session.get(url, params=params, timeout=10)
                status = response.status_code
                results['positions'][name] = {
                    'url': url,
                    'params': params,
                    'status': status,
                    'working': status == 200
                }

                if status == 200:
                    data = response.json()
                    positions = data if isinstance(data, list) else data.get('positions', data.get('data', []))
                    results['positions'][name]['count'] = len(positions)
                    print(f"✅ {name:<25} | {status} | {len(positions)} positions")
                else:
                    print(f"❌ {name:<25} | {status}")

            except Exception as e:
                results['positions'][name] = {
                    'url': url,
                    'params': params,
                    'error': str(e),
                    'working': False
                }
                print(f"❌ {name:<25} | ERROR: {str(e)[:40]}")

        # Test trade endpoints
        trade_endpoints = [
            ("data_users_trades", f"{self.base_url}/users/{address}/trades", {'limit': 10}),
            ("clob_trades", f"{self.clob_url}/trades/{address}", {'limit': 10}),
            ("data_trades_query", f"{self.base_url}/trades", {'user': address, 'limit': 10}),
        ]

        print(f"\n{'='*80}")
        print(f"Testing Trade Endpoints for {address}")
        print(f"{'='*80}\n")

        for name, url, params in trade_endpoints:
            try:
                response = self.session.get(url, params=params, timeout=10)
                status = response.status_code
                results['trades'][name] = {
                    'url': url,
                    'params': params,
                    'status': status,
                    'working': status == 200
                }

                if status == 200:
                    data = response.json()
                    trades = data if isinstance(data, list) else data.get('trades', data.get('data', []))
                    results['trades'][name]['count'] = len(trades)
                    print(f"✅ {name:<25} | {status} | {len(trades)} trades")
                else:
                    print(f"❌ {name:<25} | {status}")

            except Exception as e:
                results['trades'][name] = {
                    'url': url,
                    'params': params,
                    'error': str(e),
                    'working': False
                }
                print(f"❌ {name:<25} | ERROR: {str(e)[:40]}")

        print(f"\n{'='*80}\n")
        return results


class PolymarketTrading:
    """
    Trading client for Polymarket - requires private key for execution

    This is a placeholder that wraps the polymarket module when available.
    For actual trading, the polymarket module must be installed.
    """

    def __init__(self, private_key: Optional[str] = None):
        if not private_key:
            raise ValueError("Private key is required for trading functionality")

        # Try to load polymarket module for trading
        try:
            import mod as m
            self.client = m.mod('polymarket')(private_key=private_key)
        except Exception as e:
            raise ImportError(
                f"Polymarket module is required for trading functionality.\n"
                f"Error: {e}\n"
                f"Install from: https://github.com/your-org/polymarket-module"
            )

    def place_order(self, token_id: str, side: str, size: float, price: float) -> Dict:
        """Place an order on Polymarket"""
        return self.client.place_order(
            token_id=token_id,
            side=side,
            size=size,
            price=price
        )
