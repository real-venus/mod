"""Polymarket copy trading SDK - Main anchor module"""

import mod as m
import asyncio
import time
from typing import List, Union, Dict
from .monitor import AccountMonitor
from .executor import TradeExecutor
from .copier import CopyTradingMonitor
from .config import DEFAULT_CONFIG, ConfigSchema
from .traders import TraderSearch, top_apr_traders, search_traders, trader_stats, interactive_trader_selection
from .api import PolymarketAPI


class Mod:
    description = "Polymarket copy trading SDK - Monitor and mirror trades from target addresses"

    def __init__(self, config: dict = None):
        """Initialize with optional config override"""
        stored_config = m.get('polycopy/config', default={})
        self.config = ConfigSchema.validate({**DEFAULT_CONFIG, **stored_config, **(config or {})})

        # Use self-contained API client for data fetching
        self._client = PolymarketAPI()
        self.monitors = {}  # address -> CopyTradingMonitor
        self.futures = {}   # address -> future
        self._trader_search = None

    @property
    def client(self):
        """Get Polymarket API client"""
        return self._client

    @property
    def trader_search(self):
        """Lazy-load trader search when first accessed"""
        if self._trader_search is None:
            self._trader_search = TraderSearch()
        return self._trader_search

    def forward(self,
                addresses: Union[str, List[str]] = None,
                mode: str = 'copy',
                **kwargs) -> dict:
        """
        Main entry point

        Args:
            addresses: Single address or list to monitor
            mode: 'monitor' (watch only), 'copy' (execute), 'server' (continuous)
            **kwargs: Config overrides (dry_run, multiplier, etc.)

        Returns:
            Status dict with positions, trades, stats
        """
        # Override config with kwargs
        if kwargs:
            config_updates = {k: v for k, v in kwargs.items() if k in DEFAULT_CONFIG}
            self.config.update(config_updates)

        # Parse addresses
        if addresses is None:
            addresses = self.config.get('addresses', [])
        if isinstance(addresses, str):
            addresses = [addresses]

        if not addresses:
            return {'error': 'No addresses specified'}

        if mode == 'server':
            return self.monitor_continuous(addresses)
        elif mode == 'copy':
            return self.copy_trades(addresses)
        elif mode == 'monitor':
            return self.get_status(addresses)
        else:
            return {'error': f'Unknown mode: {mode}'}

    def copy_trades(self, addresses: List[str]) -> dict:
        """Start copy trading for N addresses"""
        if len(addresses) == 1:
            # Single address - simple async execution
            return self._run_single(addresses[0])
        else:
            # Multiple addresses - parallel via thread pool
            return self._run_parallel(addresses)

    def _run_single(self, address: str) -> dict:
        """Run single address monitor"""
        copier = CopyTradingMonitor(self.client, address, self.config)
        self.monitors[address] = copier

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(copier.start())
        except KeyboardInterrupt:
            copier.stop()
            return copier.get_stats()
        finally:
            loop.close()

        return copier.get_stats()

    def _run_parallel(self, addresses: List[str]) -> dict:
        """Run N addresses in parallel using thread pool"""
        print(f"\nStarting parallel copy trading for {len(addresses)} addresses...")

        executor = m.executor(mode='thread', max_workers=len(addresses))

        for address in addresses:
            print(f"  Spawning monitor for {address}")
            future = executor.submit(
                fn=self._run_single,
                params={'address': address}
            )
            self.futures[address] = future

        return {
            'status': 'monitoring',
            'addresses': addresses,
            'count': len(addresses),
            'mode': 'parallel'
        }

    def monitor_continuous(self, addresses: List[str]):
        """Server mode - runs indefinitely via m.serve()"""
        print(f"\n{'='*60}")
        print(f"Starting continuous copy trading server")
        print(f"Monitoring {len(addresses)} addresses")
        print(f"{'='*60}\n")

        self._run_parallel(addresses)

        # Keep alive with periodic health checks
        try:
            while True:
                time.sleep(60)
                stats = self.stats()
                m.put('polycopy/health', {
                    **stats,
                    'timestamp': time.time()
                })
                print(f"[Health Check] {stats}")
        except KeyboardInterrupt:
            self.stop()

    def positions(self, address: str = None) -> dict:
        """Get current positions"""
        if address:
            return m.get(f'polycopy/positions/{address}', default={})
        else:
            # All addresses
            return {addr: m.get(f'polycopy/positions/{addr}', default={})
                    for addr in self.config['addresses']}

    def stats(self) -> dict:
        """Get copy trading statistics"""
        # Aggregate stats from all monitors
        total_stats = {
            'total_trades': 0,
            'total_volume': 0,
            'success_count': 0,
            'fail_count': 0,
            'active_positions': 0
        }

        for address, copier in self.monitors.items():
            if hasattr(copier, 'get_stats'):
                stats = copier.get_stats()
                total_stats['total_trades'] += stats.get('total_trades', 0)
                total_stats['total_volume'] += stats.get('total_volume', 0)
                total_stats['success_count'] += stats.get('success_count', 0)
                total_stats['fail_count'] += stats.get('fail_count', 0)
                total_stats['active_positions'] += stats.get('active_positions', 0)

        if total_stats['total_trades'] > 0:
            total_stats['success_rate'] = (total_stats['success_count'] / total_stats['total_trades'] * 100)
        else:
            total_stats['success_rate'] = 0

        # Also include stored stats
        stored = m.get('polycopy/stats', default={})
        if stored:
            for key in ['total_trades', 'total_volume', 'success_count', 'fail_count']:
                total_stats[key] += stored.get(key, 0)

        return total_stats

    def get_status(self, addresses: List[str]) -> dict:
        """Get status for addresses without starting copy trading"""
        status = {}
        for address in addresses:
            try:
                positions_data = self.client.get_user_positions(address)
                trades_data = self.client.get_user_trades(address, limit=10)
                status[address] = {
                    'positions': positions_data.get('positions', []),
                    'position_count': len(positions_data.get('positions', [])),
                    'recent_trades': trades_data.get('trades', []),
                    'total_value': positions_data.get('totalValue', '0')
                }
            except Exception as e:
                status[address] = {'error': str(e)}
        return status

    def config_update(self, **updates) -> dict:
        """Update configuration"""
        self.config.update(updates)
        validated = ConfigSchema.validate(self.config)
        m.put('polycopy/config', validated)
        return validated

    def stop(self) -> dict:
        """Stop all monitoring"""
        print("\nStopping all monitors...")
        for address, copier in self.monitors.items():
            if hasattr(copier, 'stop'):
                copier.stop()

        # Save final stats
        final_stats = self.stats()
        m.put('polycopy/stats', final_stats)

        return {'status': 'stopped', 'final_stats': final_stats}

    def test_api(self, address: str = None) -> dict:
        """
        Test API connectivity for a trader address

        Args:
            address: Trader address to test (uses first from config if not provided)

        Returns:
            Dict with API endpoint test results

        Example:
            # Test with specific address
            results = m.test_api('0x916f7165c2c836aba22edb6453cdbb5f3ea253ba')

            # Test with first configured address
            results = m.test_api()
        """
        if not address:
            addresses = self.config.get('addresses', [])
            if not addresses:
                return {'error': 'No address specified and none in config'}
            address = addresses[0]

        return self.client.test_endpoints(address)

    # Trader search and discovery methods
    def find_traders(self,
                    window: str = '30d',
                    limit: int = 20,
                    min_volume: float = 10000,
                    min_pnl: float = None,
                    min_trades: int = 0,
                    min_apr: float = None,
                    sort_by: str = 'apr',
                    display: bool = True) -> List[Dict]:
        """
        Search for top traders by APR and other metrics

        Args:
            window: Time window ('1d', '7d', '30d', 'all')
            limit: Max traders to return
            min_volume: Minimum trading volume filter
            min_pnl: Minimum profit/loss filter
            min_trades: Minimum number of trades
            min_apr: Minimum APR percentage filter
            sort_by: Sort by 'pnl', 'vol', 'roi', or 'apr'
            display: Print formatted leaderboard

        Returns:
            List of trader dicts with enhanced metrics

        Example:
            # Find traders with >100% APR
            traders = m.find_traders(min_apr=100, min_volume=50000, min_trades=10)

            # Top volume traders
            traders = m.find_traders(sort_by='vol', limit=10)
        """
        traders = self.trader_search.leaderboard(
            window=window,
            limit=limit,
            min_volume=min_volume,
            min_pnl=min_pnl,
            min_trades=min_trades,
            sort_by=sort_by
        )

        # Apply APR filter if specified
        if min_apr is not None:
            traders = [t for t in traders if t.get('apr', 0) >= min_apr]

        if display and traders:
            self.trader_search.display_leaderboard(traders, top_n=limit)

        return traders

    def top_apr(self,
                window: str = '30d',
                limit: int = 20,
                min_volume: float = 10000,
                display: bool = True) -> List[Dict]:
        """
        Quick access to top APR traders

        Args:
            window: Time window for analysis
            limit: Number of traders to return
            min_volume: Minimum volume to filter noise
            display: Print formatted leaderboard

        Returns:
            List of top APR traders

        Example:
            # Get top 10 APR traders in last 7 days
            top = m.top_apr(window='7d', limit=10)
        """
        return self.find_traders(
            window=window,
            limit=limit,
            min_volume=min_volume,
            sort_by='apr',
            display=display
        )

    def trader_profile(self, address: str, window: str = '30d') -> Dict:
        """
        Get comprehensive trader profile

        Args:
            address: Trader wallet address
            window: Time window for stats

        Returns:
            Full trader profile with positions, trades, metrics

        Example:
            profile = m.trader_profile('0xc257ea7e3a81ca8e16df8935d44d513959fa358e')
        """
        return self.trader_search.trader_profile(address, window)

    def compare_traders(self, addresses: List[str], window: str = '30d') -> Dict:
        """
        Compare multiple traders side-by-side

        Args:
            addresses: List of trader addresses
            window: Time window for comparison

        Returns:
            Comparison data sorted by APR

        Example:
            comparison = m.compare_traders([
                '0xc257ea7e3a81ca8e16df8935d44d513959fa358e',
                '0xb45a797faa52b0fd8adc56d30382022b7b12192c'
            ])
        """
        return self.trader_search.compare_traders(addresses, window)

    def search_smart_traders(self,
                            min_apr: float = 100,
                            min_volume: float = 50000,
                            min_trades: int = 10,
                            window: str = '30d',
                            display: bool = True) -> List[Dict]:
        """
        Find high-quality traders with strong metrics

        Args:
            min_apr: Minimum APR percentage (default 100%)
            min_volume: Minimum trading volume
            min_trades: Minimum number of trades
            window: Time window
            display: Print results

        Returns:
            List of traders matching all criteria

        Example:
            # Find super traders: >200% APR, >100k volume, >20 trades
            smart = m.search_smart_traders(min_apr=200, min_volume=100000, min_trades=20)
        """
        traders = self.trader_search.search_by_criteria(
            min_apr=min_apr,
            min_volume=min_volume,
            min_trades=min_trades,
            window=window
        )

        if display and traders:
            self.trader_search.display_leaderboard(traders, top_n=len(traders))

        return traders

    def browse(self,
              window: str = '30d',
              min_volume: float = 10000,
              min_apr: float = None,
              limit: int = 20,
              auto_start: bool = True) -> dict:
        """
        Interactive trader browser - search, view, and select traders to copy

        Args:
            window: Time window for analysis (1d, 7d, 30d, all)
            min_volume: Minimum trading volume filter
            min_apr: Minimum APR percentage filter
            limit: Number of traders to display
            auto_start: If True, automatically start copy trading after selection

        Returns:
            Status dict with selected traders and monitoring status

        Example:
            # Browse and select traders interactively
            m.browse()

            # Customize filters
            m.browse(min_apr=100, min_volume=50000, window='7d')

            # Just browse without auto-starting
            m.browse(auto_start=False)
        """
        selected_addresses = interactive_trader_selection(
            window=window,
            min_volume=min_volume,
            min_apr=min_apr,
            limit=limit
        )

        if not selected_addresses:
            return {'status': 'cancelled', 'message': 'No traders selected'}

        # Save selected addresses to config
        self.config_update(addresses=selected_addresses)

        print(f"\n✅ Saved {len(selected_addresses)} trader(s) to config")

        if auto_start:
            print(f"\n🚀 Starting copy trading...")
            return self.copy_trades(selected_addresses)
        else:
            return {
                'status': 'selected',
                'addresses': selected_addresses,
                'count': len(selected_addresses),
                'message': f'Selected {len(selected_addresses)} traders. Run m.copy_trades() to start.'
            }
