"""Trader search and analysis module for Polymarket"""

import requests
from typing import List, Dict, Optional
from datetime import datetime, timedelta


class TraderSearch:
    """Search and filter top Polymarket traders by performance metrics"""

    def __init__(self):
        self.session = requests.Session()
        self.data_url = "https://data-api.polymarket.com"

    def leaderboard(self,
                   window: str = '7d',
                   limit: int = 100,
                   min_volume: float = 0,
                   min_pnl: float = None,
                   min_trades: int = 0,
                   min_roi: float = None,
                   sort_by: str = 'pnl') -> List[Dict]:
        """
        Get trader leaderboard with advanced filtering

        Args:
            window: Time window ('1d', '7d', '30d', 'all')
            limit: Max number of traders to return (max 100)
            min_volume: Minimum trading volume filter
            min_pnl: Minimum profit/loss filter
            min_trades: Minimum number of trades (requires fetching trade history)
            min_roi: Minimum ROI percentage filter
            sort_by: Sort by 'pnl', 'vol', 'roi', or 'apr'

        Returns:
            List of trader dicts with enhanced metrics
        """
        # Fetch leaderboard data
        url = f"{self.data_url}/v1/leaderboard"
        params = {
            'window': window,
            'limit': limit
        }

        try:
            response = self.session.get(url, params=params).json()

            if not isinstance(response, list):
                return []

            # Enhance with calculated metrics
            traders = []
            for trader in response:
                enhanced = self._enhance_trader_data(trader, window)

                # Apply filters
                if min_volume and enhanced['vol'] < min_volume:
                    continue
                if min_pnl is not None and enhanced['pnl'] < min_pnl:
                    continue
                if min_roi is not None and enhanced['roi'] < min_roi:
                    continue

                traders.append(enhanced)

            # Apply trade count filter (requires additional API calls)
            if min_trades > 0:
                traders = self._filter_by_trade_count(traders, min_trades)

            # Sort by requested metric
            traders = self._sort_traders(traders, sort_by)

            return traders

        except Exception as e:
            print(f"Error fetching leaderboard: {e}")
            return []

    def _enhance_trader_data(self, trader: Dict, window: str) -> Dict:
        """Add calculated metrics like ROI and APR"""
        vol = float(trader.get('vol', 0))
        pnl = float(trader.get('pnl', 0))

        # Calculate ROI
        roi = (pnl / vol * 100) if vol > 0 else 0

        # Calculate APR (annualized)
        window_days = self._window_to_days(window)
        apr = (roi / window_days * 365) if window_days > 0 else 0

        # Calculate risk-adjusted metrics
        sharpe = self._estimate_sharpe(pnl, vol)

        return {
            **trader,
            'roi': round(roi, 2),
            'apr': round(apr, 2),
            'sharpe': round(sharpe, 2),
            'profit_factor': round((pnl + vol) / vol, 2) if vol > 0 else 0,
            'avg_trade_size': vol / 10 if vol > 0 else 0  # Rough estimate
        }

    def _window_to_days(self, window: str) -> int:
        """Convert window string to days"""
        mapping = {
            '1d': 1,
            '7d': 7,
            '30d': 30,
            'all': 365  # Assume 1 year for 'all'
        }
        return mapping.get(window, 7)

    def _estimate_sharpe(self, pnl: float, vol: float) -> float:
        """Rough Sharpe ratio estimation"""
        if vol == 0:
            return 0
        # Simplified: pnl / (vol * 0.15) assuming 15% volatility
        return pnl / (vol * 0.15)

    def _filter_by_trade_count(self, traders: List[Dict], min_trades: int) -> List[Dict]:
        """Filter traders by minimum number of trades (best effort)"""
        filtered = []

        print(f"\nFetching trade counts for {len(traders)} traders (this may take a while)...")

        for i, trader in enumerate(traders, 1):
            if i % 10 == 0:
                print(f"  Progress: {i}/{len(traders)}")

            try:
                address = trader.get('proxyWallet')
                # Fetch trade history - try different endpoints
                url = f"{self.data_url}/users/{address}/trades"
                response = self.session.get(url, params={'limit': 100}, timeout=5)

                # Handle various response formats
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        trade_count = len(data)
                    elif isinstance(data, dict):
                        trades = data.get('trades', data.get('data', []))
                        trade_count = len(trades) if isinstance(trades, list) else 0
                    else:
                        trade_count = 0
                else:
                    # If API fails, skip filter but keep trader
                    trader['trade_count'] = None
                    filtered.append(trader)
                    continue

                trader['trade_count'] = trade_count

                if trade_count >= min_trades:
                    filtered.append(trader)

            except Exception as e:
                # On error, skip filter but keep trader with unknown trade count
                trader['trade_count'] = None
                filtered.append(trader)

        print(f"  Filtered: {len(filtered)} traders with >={min_trades} trades\n")
        return filtered

    def _sort_traders(self, traders: List[Dict], sort_by: str) -> List[Dict]:
        """Sort traders by specified metric"""
        sort_keys = {
            'pnl': lambda x: x.get('pnl', 0),
            'vol': lambda x: x.get('vol', 0),
            'roi': lambda x: x.get('roi', 0),
            'apr': lambda x: x.get('apr', 0),
            'sharpe': lambda x: x.get('sharpe', 0),
            'trade_count': lambda x: x.get('trade_count', 0)
        }

        key_func = sort_keys.get(sort_by, sort_keys['pnl'])
        return sorted(traders, key=key_func, reverse=True)

    def find_top_apr_traders(self,
                            window: str = '30d',
                            limit: int = 20,
                            min_volume: float = 10000,
                            min_trades: int = 5) -> List[Dict]:
        """
        Find traders with highest APR

        Args:
            window: Time window for analysis
            limit: Number of top traders to return
            min_volume: Minimum volume to filter out low-activity traders
            min_trades: Minimum trades to ensure consistency

        Returns:
            List of top APR traders with full stats
        """
        return self.leaderboard(
            window=window,
            limit=100,
            min_volume=min_volume,
            min_trades=min_trades,
            sort_by='apr'
        )[:limit]

    def trader_profile(self, address: str, window: str = '30d') -> Dict:
        """
        Get comprehensive trader profile

        Args:
            address: Trader wallet address
            window: Time window for leaderboard stats

        Returns:
            Dict with positions, trades, stats, and performance metrics
        """
        # Get current positions
        try:
            pos_url = f"{self.data_url}/users/{address}/positions"
            pos_response = self.session.get(pos_url).json()
            positions = pos_response if isinstance(pos_response, list) else pos_response.get('positions', [])
        except Exception:
            positions = []

        # Get trade history
        try:
            trade_url = f"{self.data_url}/users/{address}/trades"
            trade_response = self.session.get(trade_url, params={'limit': 100}).json()
            trade_list = trade_response if isinstance(trade_response, list) else trade_response.get('trades', [])
        except Exception:
            trade_list = []

        # Get leaderboard rank
        leaderboard = self.leaderboard(window=window, limit=100)
        rank_data = next((t for t in leaderboard if t['proxyWallet'].lower() == address.lower()), None)

        profile = {
            'address': address,
            'positions': positions,
            'position_count': len(positions),
            'total_value': sum(float(p.get('currentValue', 0) or 0) for p in positions),
            'recent_trades': trade_list[:10],
            'total_trades': len(trade_list),
            'leaderboard_rank': rank_data.get('rank') if rank_data else None,
            'pnl': rank_data.get('pnl') if rank_data else 0,
            'volume': rank_data.get('vol') if rank_data else 0,
            'roi': rank_data.get('roi') if rank_data else 0,
            'apr': rank_data.get('apr') if rank_data else 0,
        }

        # Calculate win rate from trades
        if trade_list:
            profile['win_rate'] = self._calculate_win_rate(trade_list)

        return profile

    def _calculate_win_rate(self, trades: List[Dict]) -> float:
        """Calculate win rate from trade history"""
        # This is simplified - would need actual resolution data
        # For now, return None as we can't determine winners without market resolution
        return None

    def compare_traders(self, addresses: List[str], window: str = '30d') -> Dict:
        """
        Compare multiple traders side-by-side

        Args:
            addresses: List of trader addresses to compare
            window: Time window for comparison

        Returns:
            Dict with comparison data
        """
        profiles = []

        for address in addresses:
            profile = self.trader_profile(address, window)
            profiles.append(profile)

        # Sort by APR
        profiles.sort(key=lambda x: x.get('apr', 0), reverse=True)

        return {
            'window': window,
            'trader_count': len(profiles),
            'traders': profiles,
            'top_apr': profiles[0] if profiles else None
        }

    def search_by_criteria(self,
                          min_apr: float = 50,
                          min_volume: float = 50000,
                          min_trades: int = 10,
                          window: str = '30d') -> List[Dict]:
        """
        Advanced search with multiple criteria

        Args:
            min_apr: Minimum APR percentage
            min_volume: Minimum trading volume
            min_trades: Minimum number of trades
            window: Time window

        Returns:
            List of traders matching all criteria
        """
        traders = self.leaderboard(
            window=window,
            limit=100,
            min_volume=min_volume,
            min_trades=min_trades,
            sort_by='apr'
        )

        # Filter by APR
        return [t for t in traders if t.get('apr', 0) >= min_apr]

    def display_leaderboard(self, traders: List[Dict], top_n: int = 20):
        """Pretty print leaderboard"""
        print(f"\n{'='*100}")
        print(f"Top {top_n} Polymarket Traders")
        print(f"{'='*100}")
        print(f"{'Rank':<6} {'Username':<25} {'Volume':<15} {'PnL':<15} {'ROI %':<10} {'APR %':<10}")
        print(f"{'-'*100}")

        for trader in traders[:top_n]:
            rank = trader.get('rank', '?')
            username = trader.get('userName', 'Anonymous')[:24]
            vol = f"${trader.get('vol', 0):,.0f}"
            pnl = f"${trader.get('pnl', 0):,.0f}"
            roi = f"{trader.get('roi', 0):.1f}%"
            apr = f"{trader.get('apr', 0):.1f}%"

            print(f"{rank:<6} {username:<25} {vol:<15} {pnl:<15} {roi:<10} {apr:<10}")

        print(f"{'='*100}\n")


# Convenience functions
def top_apr_traders(window: str = '30d', limit: int = 20, min_volume: float = 10000) -> List[Dict]:
    """Quick access to top APR traders"""
    search = TraderSearch()
    return search.find_top_apr_traders(window=window, limit=limit, min_volume=min_volume)


def search_traders(**kwargs) -> List[Dict]:
    """Quick search with custom filters"""
    search = TraderSearch()
    return search.leaderboard(**kwargs)


def trader_stats(address: str, window: str = '30d') -> Dict:
    """Quick trader profile lookup"""
    search = TraderSearch()
    return search.trader_profile(address, window)


def interactive_trader_selection(
    window: str = '30d',
    min_volume: float = 10000,
    min_apr: float = None,
    limit: int = 20
) -> Optional[List[str]]:
    """
    Interactive trader browser with search and selection

    Args:
        window: Time window for analysis
        min_volume: Minimum volume filter
        min_apr: Minimum APR filter
        limit: Number of traders to display

    Returns:
        List of selected trader addresses or None if cancelled
    """
    search = TraderSearch()

    print("\n" + "="*100)
    print("🔍 Polymarket Trader Browser")
    print("="*100)

    while True:
        print("\nOptions:")
        print("  1. Browse top APR traders")
        print("  2. Browse top volume traders")
        print("  3. Browse top PnL traders")
        print("  4. Search by custom criteria")
        print("  5. Lookup trader by address")
        print("  6. Exit")

        choice = input("\nSelect option (1-6): ").strip()

        if choice == '6':
            return None

        traders = []

        if choice == '1':
            sort_by = 'apr'
            print(f"\n🚀 Loading top {limit} APR traders...")
        elif choice == '2':
            sort_by = 'vol'
            print(f"\n💰 Loading top {limit} volume traders...")
        elif choice == '3':
            sort_by = 'pnl'
            print(f"\n📈 Loading top {limit} profit traders...")
        elif choice == '4':
            # Custom search
            print("\n🔧 Custom Search Criteria:")
            try:
                custom_apr = input(f"  Min APR % (default: {min_apr or 'none'}): ").strip()
                custom_vol = input(f"  Min Volume $ (default: {min_volume}): ").strip()
                custom_limit = input(f"  Max results (default: {limit}): ").strip()

                min_apr = float(custom_apr) if custom_apr else min_apr
                min_volume = float(custom_vol) if custom_vol else min_volume
                limit = int(custom_limit) if custom_limit else limit

                sort_by = 'apr'
            except ValueError:
                print("❌ Invalid input, using defaults")
                sort_by = 'apr'
        elif choice == '5':
            # Direct lookup
            address = input("\n📍 Enter trader address: ").strip()
            if address:
                profile = search.trader_profile(address, window)
                _display_trader_profile(profile)

                if input("\n✅ Copy this trader? (y/n): ").strip().lower() == 'y':
                    return [address]
            continue
        else:
            print("❌ Invalid option")
            continue

        # Fetch traders
        traders = search.leaderboard(
            window=window,
            limit=limit,
            min_volume=min_volume,
            sort_by=sort_by
        )

        if min_apr:
            traders = [t for t in traders if t.get('apr', 0) >= min_apr]

        if not traders:
            print("\n⚠️  No traders found matching criteria")
            continue

        # Display results
        _display_trader_list(traders, sort_by)

        # Selection menu
        selected = _select_traders_from_list(traders)
        if selected:
            return selected


def _display_trader_list(traders: List[Dict], sort_by: str):
    """Display formatted trader list"""
    print(f"\n{'='*100}")
    print(f"{'Rank':<6} {'#':<5} {'Username':<20} {'Volume':<15} {'PnL':<15} {'ROI %':<10} {'APR %':<10}")
    print(f"{'-'*100}")

    for i, trader in enumerate(traders, 1):
        rank = trader.get('rank', '?')
        username = trader.get('userName', 'Anonymous')[:19]
        vol = f"${trader.get('vol', 0):,.0f}"
        pnl = f"${trader.get('pnl', 0):,.0f}"
        roi = f"{trader.get('roi', 0):.1f}%"
        apr = f"{trader.get('apr', 0):.1f}%"

        # Highlight metric we're sorting by
        marker = '⭐' if sort_by == 'apr' and trader.get('apr', 0) > 100 else ''

        print(f"{rank:<6} {i:<5} {username:<20} {vol:<15} {pnl:<15} {roi:<10} {apr:<10} {marker}")

    print(f"{'='*100}")


def _select_traders_from_list(traders: List[Dict]) -> Optional[List[str]]:
    """Interactive selection from displayed list"""
    print("\n📋 Selection Options:")
    print("  • Enter numbers (1,2,3) to select multiple traders")
    print("  • Enter range (1-5) to select range")
    print("  • Enter 'all' to select all")
    print("  • Enter 'v' for detailed view")
    print("  • Enter 'q' to go back")

    selection = input("\nYour selection: ").strip().lower()

    if selection == 'q':
        return None

    if selection == 'all':
        return [t.get('proxyWallet') for t in traders]

    if selection == 'v':
        # Detailed view
        idx = input("Enter trader number for details: ").strip()
        try:
            trader_idx = int(idx) - 1
            if 0 <= trader_idx < len(traders):
                trader = traders[trader_idx]
                search = TraderSearch()
                profile = search.trader_profile(trader.get('proxyWallet'), '30d')
                _display_trader_profile(profile)

                if input("\n✅ Copy this trader? (y/n): ").strip().lower() == 'y':
                    return [trader.get('proxyWallet')]
        except ValueError:
            print("❌ Invalid number")
        return None

    # Parse selection
    try:
        selected_addresses = []

        # Handle ranges and comma-separated
        if '-' in selection:
            # Range selection
            start, end = selection.split('-', 1)
            start_idx = int(start.strip()) - 1
            end_idx = int(end.strip())

            for i in range(start_idx, min(end_idx, len(traders))):
                if 0 <= i < len(traders):
                    selected_addresses.append(traders[i].get('proxyWallet'))

        elif ',' in selection:
            # Multiple selection
            nums = [int(n.strip()) - 1 for n in selection.split(',')]
            for i in nums:
                if 0 <= i < len(traders):
                    selected_addresses.append(traders[i].get('proxyWallet'))
        else:
            # Single selection
            idx = int(selection) - 1
            if 0 <= idx < len(traders):
                selected_addresses.append(traders[idx].get('proxyWallet'))

        if selected_addresses:
            print(f"\n✅ Selected {len(selected_addresses)} trader(s)")
            for addr in selected_addresses:
                trader = next((t for t in traders if t.get('proxyWallet') == addr), None)
                if trader:
                    print(f"   • {trader.get('userName', 'Anonymous')} ({addr[:10]}...)")

            confirm = input("\nStart copy trading? (y/n): ").strip().lower()
            if confirm == 'y':
                return selected_addresses

        return None

    except (ValueError, IndexError):
        print("❌ Invalid selection")
        return None


def _display_trader_profile(profile: Dict):
    """Display detailed trader profile"""
    print(f"\n{'='*100}")
    print(f"📊 Trader Profile: {profile.get('address')}")
    print(f"{'='*100}")

    print(f"\n💰 Performance Metrics:")
    print(f"  PnL:              ${profile.get('pnl', 0):,.2f}")
    print(f"  Volume:           ${profile.get('volume', 0):,.2f}")
    print(f"  ROI:              {profile.get('roi', 0):.2f}%")
    print(f"  APR:              {profile.get('apr', 0):.2f}%")
    print(f"  Leaderboard Rank: {profile.get('leaderboard_rank', 'N/A')}")

    print(f"\n📈 Portfolio:")
    print(f"  Active Positions: {profile.get('position_count', 0)}")
    print(f"  Total Value:      ${profile.get('total_value', 0):,.2f}")
    print(f"  Total Trades:     {profile.get('total_trades', 0)}")

    # Show recent positions
    positions = profile.get('positions', [])
    if positions:
        print(f"\n🎯 Recent Positions:")
        for i, pos in enumerate(positions[:5], 1):
            market = pos.get('market', {})
            question = market.get('question', 'Unknown')[:50]
            outcome = pos.get('outcome', 'Unknown')
            size = float(pos.get('size', 0) or 0)
            print(f"  {i}. {question}... ({outcome}, ${size:,.0f})")

    print(f"\n{'='*100}")
