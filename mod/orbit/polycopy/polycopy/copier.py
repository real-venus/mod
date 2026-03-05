"""Copy trading monitor - orchestrates monitoring and execution"""

from .monitor import AccountMonitor
from .executor import TradeExecutor


class CopyTradingMonitor:
    """Orchestrates monitoring + execution for single address"""

    def __init__(self, client, address: str, config: dict):
        self.config = config
        self.address = address
        self.executor = TradeExecutor(config.get('private_key'), config)
        self.executed_positions = set()  # Track what we've copied
        self.target_positions = {}       # Track target's current state
        self.stats = {
            'total_trades': 0,
            'total_volume': 0,
            'success_count': 0,
            'fail_count': 0
        }

        # Create monitor with callback
        self.monitor = AccountMonitor(
            address=address,
            client=client,
            poll_interval=config.get('poll_interval', 30)
        )
        self.monitor.on_change = self.handle_changes

    async def start(self):
        """Start monitoring and copy trading"""
        print(f"\n{'='*60}")
        print(f"Copy Trading Monitor Starting")
        print(f"{'='*60}")
        print(f"Target Address: {self.address}")
        print(f"Mode: {'DRY RUN' if self.config.get('dry_run') else 'LIVE TRADING'}")
        print(f"Multiplier: {self.config.get('multiplier')}x")
        print(f"Poll Interval: {self.config.get('poll_interval')}s")
        print(f"{'='*60}\n")

        await self.monitor.start_monitoring()

    def stop(self):
        """Stop monitoring"""
        self.monitor.stop()
        print(f"\n[CopyTrading] Final Stats: {self.stats}")

    async def handle_changes(self, changes: dict):
        """Execute copy trades based on detected changes"""
        # New positions -> execute buys
        for position in changes.get('new', []):
            if position['id'] not in self.executed_positions:
                try:
                    result = await self.executor.execute_buy(position)
                    if result.get('success'):
                        self.executed_positions.add(position['id'])
                        self.target_positions[position['id']] = position
                        self.stats['success_count'] += 1
                        self.stats['total_trades'] += 1
                        self.stats['total_volume'] += float(result.get('value', 0))
                    else:
                        self.stats['fail_count'] += 1
                        print(f"[CopyTrading] Failed to buy: {result.get('error')}")
                except Exception as e:
                    self.stats['fail_count'] += 1
                    print(f"[CopyTrading] Error executing buy: {e}")

        # Closed positions -> execute sells (only if we bought)
        for position in changes.get('closed', []):
            if position['id'] in self.executed_positions:
                try:
                    result = await self.executor.execute_sell(position)
                    if result.get('success'):
                        self.executed_positions.remove(position['id'])
                        self.target_positions.pop(position['id'], None)
                        self.stats['success_count'] += 1
                        self.stats['total_trades'] += 1
                        self.stats['total_volume'] += float(result.get('value', 0))
                    else:
                        self.stats['fail_count'] += 1
                        print(f"[CopyTrading] Failed to sell: {result.get('error')}")
                except Exception as e:
                    self.stats['fail_count'] += 1
                    print(f"[CopyTrading] Error executing sell: {e}")

        # Log updated positions
        if changes.get('updated'):
            print(f"[CopyTrading] {len(changes['updated'])} position(s) updated")

    def get_stats(self) -> dict:
        """Get copy trading statistics"""
        return {
            **self.stats,
            'active_positions': len(self.executed_positions),
            'success_rate': (self.stats['success_count'] / self.stats['total_trades'] * 100)
                           if self.stats['total_trades'] > 0 else 0
        }
