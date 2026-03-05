"""Trade execution with risk management"""

import mod as m
import time
from collections import deque
from typing import Tuple, Optional
from .api import PolymarketTrading


class RiskManager:
    """Enforces risk limits on copy trading"""

    def __init__(self, limits: dict):
        self.limits = limits
        self.daily_trades = deque(maxlen=1000)
        self.daily_volume = 0.0
        self.concurrent_positions = set()
        self.last_reset = time.time()

    def can_execute_trade(self, trade: dict) -> Tuple[bool, str]:
        """
        Check if trade passes risk checks
        Returns: (allowed: bool, reason: str)
        """
        # Reset daily counters if new day
        if time.time() - self.last_reset > 86400:
            self._reset_daily_counters()

        # Check daily trade limit
        if len(self.daily_trades) >= self.limits['max_daily_trades']:
            return False, "Daily trade limit reached"

        # Check daily volume
        if self.daily_volume >= self.limits['max_daily_volume']:
            return False, "Daily volume limit reached"

        # Check concurrent positions
        if len(self.concurrent_positions) >= self.limits['max_concurrent_positions']:
            return False, "Too many concurrent positions"

        # Check trade value
        trade_value = trade.get('value', 0)
        if self.daily_volume + trade_value > self.limits['max_daily_volume']:
            return False, "Trade would exceed daily volume limit"

        return True, "OK"

    def record_trade(self, trade: dict):
        """Record executed trade for limits"""
        trade['timestamp'] = time.time()
        self.daily_trades.append(trade)
        self.daily_volume += trade.get('value', 0)
        if 'position_id' in trade:
            self.concurrent_positions.add(trade['position_id'])

    def close_position(self, position_id: str):
        """Remove position from concurrent tracking"""
        self.concurrent_positions.discard(position_id)

    def _reset_daily_counters(self):
        """Reset daily limits"""
        self.daily_trades.clear()
        self.daily_volume = 0.0
        self.last_reset = time.time()


class TradeExecutor:
    """Executes trades on Polymarket with risk management"""

    def __init__(self, private_key: Optional[str], config: dict):
        self._client = None
        self._private_key = private_key
        self.config = config
        self.risk_manager = RiskManager(config['risk_limits'])

    @property
    def client(self):
        """Lazy-load trading client when first accessed"""
        if self._client is None and self._private_key:
            try:
                self._client = PolymarketTrading(private_key=self._private_key)
            except Exception as e:
                print(f"Warning: Trading requires polymarket module: {e}")
                return None
        return self._client

    async def execute_buy(self, position: dict) -> dict:
        """Mirror a position - buy to match target"""
        # Calculate adjusted size
        quantity = float(position['quantity']) * self.config['multiplier']
        quantity = min(quantity, self.config['max_trade_size'])

        # Validate minimum
        if quantity < self.config['min_trade_size']:
            return {'success': False, 'error': 'Below min trade size'}

        # Calculate trade value
        price = float(position['price'])
        trade_value = quantity * price

        # Risk checks
        allowed, reason = self.risk_manager.can_execute_trade({
            'value': trade_value,
            'position_id': position['id']
        })
        if not allowed:
            return {'success': False, 'error': reason}

        # Dry run simulation
        if self.config['dry_run']:
            result = self._simulate_trade('BUY', position, quantity, price)
            print(f"[DRY RUN] BUY {quantity} @ ${price} - {position['market']['question'][:50]}")
            return result

        # Execute via polymarket client
        if not self.client:
            return {'success': False, 'error': 'No trading client configured'}

        try:
            result = self.client.place_order(
                token_id=position['id'],
                side='BUY',
                size=quantity,
                price=price
            )

            if result.get('success', True):
                # Record trade
                self.risk_manager.record_trade({
                    'value': trade_value,
                    'position_id': position['id']
                })
                trade_data = {
                    **result,
                    'position': position,
                    'quantity': quantity,
                    'price': price,
                    'timestamp': int(time.time())
                }
                m.put(f"polycopy/trades/{int(time.time())}_{position['id']}", trade_data)
                print(f"[LIVE] BUY {quantity} @ ${price} - {position['market']['question'][:50]}")

            return result

        except Exception as e:
            return {'success': False, 'error': str(e)}

    async def execute_sell(self, position: dict) -> dict:
        """Close mirrored position"""
        quantity = float(position['quantity']) * self.config['multiplier']
        price = float(position['price'])

        # Dry run simulation
        if self.config['dry_run']:
            result = self._simulate_trade('SELL', position, quantity, price)
            print(f"[DRY RUN] SELL {quantity} @ ${price} - {position['market']['question'][:50]}")
            self.risk_manager.close_position(position['id'])
            return result

        # Execute via polymarket client
        if not self.client:
            return {'success': False, 'error': 'No trading client configured'}

        try:
            result = self.client.place_order(
                token_id=position['id'],
                side='SELL',
                size=quantity,
                price=price
            )

            if result.get('success', True):
                # Record trade
                trade_value = quantity * price
                self.risk_manager.record_trade({'value': trade_value})
                self.risk_manager.close_position(position['id'])
                trade_data = {
                    **result,
                    'position': position,
                    'quantity': quantity,
                    'price': price,
                    'timestamp': int(time.time())
                }
                m.put(f"polycopy/trades/{int(time.time())}_{position['id']}", trade_data)
                print(f"[LIVE] SELL {quantity} @ ${price} - {position['market']['question'][:50]}")

            return result

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _simulate_trade(self, side: str, position: dict, quantity: float, price: float) -> dict:
        """Simulate trade for dry-run mode"""
        return {
            'success': True,
            'simulated': True,
            'side': side,
            'token_id': position['id'],
            'quantity': str(quantity),
            'price': str(price),
            'value': quantity * price,
            'market': position['market']['question']
        }
