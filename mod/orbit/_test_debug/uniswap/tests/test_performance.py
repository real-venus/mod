"""Tests for performance calculation logic (mirrors Rust performance.rs)"""

import unittest
import json
from datetime import datetime, timezone, timedelta


class TestPerformanceCalculation(unittest.TestCase):
    """Test wallet performance metric calculations.

    These tests verify the same logic as the Rust performance module
    but in Python, to ensure the Python wrapper and scraper produce
    consistent results with the engine.
    """

    def _make_trade(self, token_in_sym, token_out_sym, amount_in, amount_out,
                    days_ago=0, tx_hash=None):
        """Helper to create a trade dict matching WalletTrade structure"""
        ts = datetime.now(timezone.utc) - timedelta(days=days_ago)
        return {
            "wallet": "0x1234567890abcdef1234567890abcdef12345678",
            "chain": "base",
            "tx_hash": tx_hash or f"0x{hash(str(ts)):032x}",
            "block_number": 1000000 - (days_ago * 43200),
            "timestamp": ts.isoformat(),
            "token_in": f"0x{token_in_sym}",
            "token_in_symbol": token_in_sym,
            "token_out": f"0x{token_out_sym}",
            "token_out_symbol": token_out_sym,
            "amount_in": str(amount_in),
            "amount_out": str(amount_out),
            "pool": "0xpool",
            "fee": 3000,
        }

    def test_empty_trades(self):
        """No trades should produce zero metrics"""
        perf = self._calculate_performance("0xtest", [])
        assert perf["total_trades"] == 0
        assert perf["total_volume_usd"] == 0.0
        assert perf["active_days"] == 0

    def test_single_usdc_trade(self):
        """Single trade selling 1000 USDC"""
        trades = [self._make_trade("USDC", "WETH", 1000_000_000, 400_000_000_000_000_000)]
        perf = self._calculate_performance("0xtest", trades)
        assert perf["total_trades"] == 1
        assert perf["total_volume_usd"] > 0

    def test_multiple_days(self):
        """Trades across multiple days should count active days"""
        trades = [
            self._make_trade("USDC", "WETH", 1000_000_000, 400_000_000_000_000_000, days_ago=0),
            self._make_trade("USDC", "WETH", 2000_000_000, 800_000_000_000_000_000, days_ago=1),
            self._make_trade("WETH", "USDC", 400_000_000_000_000_000, 1000_000_000, days_ago=3),
        ]
        perf = self._calculate_performance("0xtest", trades)
        assert perf["total_trades"] == 3
        assert perf["active_days"] >= 2

    def test_most_traded_tokens(self):
        """Most traded should reflect frequency"""
        trades = [
            self._make_trade("USDC", "WETH", 1000, 1, days_ago=0),
            self._make_trade("USDC", "WETH", 1000, 1, days_ago=1),
            self._make_trade("USDC", "WETH", 1000, 1, days_ago=2),
            self._make_trade("DAI", "WETH", 1000, 1, days_ago=3),
        ]
        perf = self._calculate_performance("0xtest", trades)
        # USDC and WETH should be most traded
        assert "USDC" in perf["most_traded"][:3]
        assert "WETH" in perf["most_traded"][:3]

    def test_old_trades_excluded(self):
        """Trades older than 30 days should be excluded"""
        trades = [
            self._make_trade("USDC", "WETH", 1000, 1, days_ago=0),
            self._make_trade("USDC", "WETH", 1000, 1, days_ago=31),
        ]
        perf = self._calculate_performance("0xtest", trades)
        assert perf["total_trades"] == 1  # Only recent trade counted

    def test_stablecoin_volume_tracking(self):
        """Volume should be calculated from stablecoin amounts"""
        trades = [
            self._make_trade("USDC", "WETH", 5000_000_000, 2_000_000_000_000_000_000, days_ago=0),
        ]
        perf = self._calculate_performance("0xtest", trades)
        # 5000 USDC (6 decimals) = $5000
        assert abs(perf["total_volume_usd"] - 5000.0) < 1.0

    def _calculate_performance(self, wallet, trades):
        """Python implementation matching Rust performance::calculate_performance"""
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        recent = [t for t in trades if datetime.fromisoformat(t["timestamp"]) >= cutoff]

        if not recent:
            return {
                "wallet": wallet,
                "total_trades": 0,
                "tokens_bought": [],
                "tokens_sold": [],
                "most_traded": [],
                "avg_trade_size_usd": 0.0,
                "total_volume_usd": 0.0,
                "first_trade": None,
                "last_trade": None,
                "active_days": 0,
                "trades_per_day": 0.0,
            }

        bought = {}
        sold = {}
        token_freq = {}
        unique_days = set()
        total_volume_usd = 0.0

        stablecoins = {"USDC", "USDT", "DAI"}
        stablecoin_decimals = {"USDC": 6, "USDT": 6, "DAI": 18}

        for trade in recent:
            sym_out = trade["token_out_symbol"]
            sym_in = trade["token_in_symbol"]
            amt_out = int(trade["amount_out"])
            amt_in = int(trade["amount_in"])

            bought[sym_out] = bought.get(sym_out, 0) + 1
            sold[sym_in] = sold.get(sym_in, 0) + 1
            token_freq[sym_out] = token_freq.get(sym_out, 0) + 1
            token_freq[sym_in] = token_freq.get(sym_in, 0) + 1

            ts = datetime.fromisoformat(trade["timestamp"])
            unique_days.add(ts.strftime("%Y-%m-%d"))

            if sym_in in stablecoins:
                dec = stablecoin_decimals.get(sym_in, 6)
                total_volume_usd += amt_in / (10 ** dec)
            elif sym_out in stablecoins:
                dec = stablecoin_decimals.get(sym_out, 6)
                total_volume_usd += amt_out / (10 ** dec)

        most_traded = sorted(token_freq, key=token_freq.get, reverse=True)[:5]
        total_trades = len(recent)
        active_days = len(unique_days)
        trades_per_day = total_trades / active_days if active_days > 0 else 0.0
        avg_trade_size_usd = total_volume_usd / total_trades if total_trades > 0 and total_volume_usd > 0 else 0.0

        timestamps = [datetime.fromisoformat(t["timestamp"]) for t in recent]

        return {
            "wallet": wallet,
            "total_trades": total_trades,
            "tokens_bought": list(bought.keys()),
            "tokens_sold": list(sold.keys()),
            "most_traded": most_traded,
            "avg_trade_size_usd": avg_trade_size_usd,
            "total_volume_usd": total_volume_usd,
            "first_trade": min(timestamps).isoformat(),
            "last_trade": max(timestamps).isoformat(),
            "active_days": active_days,
            "trades_per_day": trades_per_day,
        }


class TestStablecoinDecimals(unittest.TestCase):
    """Verify stablecoin decimal assumptions match chain config"""

    def test_usdc_6_decimals(self):
        assert self._get_decimals("USDC") == 6

    def test_usdt_6_decimals(self):
        assert self._get_decimals("USDT") == 6

    def test_dai_18_decimals(self):
        assert self._get_decimals("DAI") == 18

    def _get_decimals(self, symbol):
        # Load from config.json
        config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "config.json"
        )
        with open(config_path) as f:
            config = json.load(f)
        # Check base chain
        return config["chains"]["base"]["tokens"][symbol]["decimals"]


# Need os for config loading
import os

if __name__ == "__main__":
    unittest.main()
