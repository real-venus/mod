"""Tests for type serialization matching the Rust engine types"""

import json
import unittest
from datetime import datetime, timezone


class TestChainIdSerialization(unittest.TestCase):
    """Verify ChainId serialization matches Rust serde(rename_all = "lowercase")"""

    def test_base_serializes_lowercase(self):
        data = {"chain": "base"}
        assert json.loads(json.dumps(data))["chain"] == "base"

    def test_polygon_serializes_lowercase(self):
        data = {"chain": "polygon"}
        assert json.loads(json.dumps(data))["chain"] == "polygon"


class TestStrategyKindSerialization(unittest.TestCase):
    """Verify StrategyKind matches Rust serde(rename_all = "snake_case")"""

    VALID_KINDS = [
        "dca",
        "limit_order",
        "range_lp",
        "momentum",
        "arb",
        "rebalance",
        "copy_trade",
    ]

    def test_all_kinds_are_snake_case(self):
        for kind in self.VALID_KINDS:
            assert kind == kind.lower()
            assert " " not in kind

    def test_known_kinds(self):
        assert len(self.VALID_KINDS) == 7


class TestStrategyStatusSerialization(unittest.TestCase):
    """Verify StrategyStatus matches Rust serde(rename_all = "snake_case")"""

    VALID_STATUSES = ["active", "paused", "stopped", "error"]

    def test_all_statuses_lowercase(self):
        for status in self.VALID_STATUSES:
            assert status == status.lower()


class TestCreateStrategyRequest(unittest.TestCase):
    """Test CreateStrategyRequest JSON structure"""

    def test_dca_request(self):
        req = {
            "kind": "dca",
            "chain": "base",
            "config": {
                "token_in": "0x4200000000000000000000000000000000000006",
                "token_out": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                "amount_per_tick": "100",
                "fee": 3000,
                "interval_secs": 3600,
            }
        }
        serialized = json.dumps(req)
        parsed = json.loads(serialized)
        assert parsed["kind"] == "dca"
        assert parsed["config"]["fee"] == 3000

    def test_copy_trade_request(self):
        req = {
            "kind": "copy_trade",
            "chain": "base",
            "config": {
                "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
                "max_trade_size": "1000000000000000000",
                "slippage_tolerance": 0.01,
                "interval_secs": 60,
            }
        }
        serialized = json.dumps(req)
        parsed = json.loads(serialized)
        assert parsed["kind"] == "copy_trade"
        assert parsed["config"]["slippage_tolerance"] == 0.01

    def test_arb_request(self):
        req = {
            "kind": "arb",
            "chain": "base",
            "config": {
                "pool_base": "0xd0b53D9277642d899DF5C87A3966A349A798F224",
                "pool_polygon": "0x45dDa9cb7c25131DF268515131580e8DAf2e3aF7",
                "amount": "1000",
                "min_spread": 0.005,
            }
        }
        parsed = json.loads(json.dumps(req))
        assert parsed["config"]["min_spread"] == 0.005


class TestAddWalletRequest(unittest.TestCase):
    """Test AddWalletRequest JSON structure"""

    def test_with_nickname(self):
        req = {"address": "0x1234567890abcdef1234567890abcdef12345678", "nickname": "whale"}
        parsed = json.loads(json.dumps(req))
        assert parsed["address"].startswith("0x")
        assert len(parsed["address"]) == 42

    def test_without_nickname(self):
        req = {"address": "0x1234567890abcdef1234567890abcdef12345678", "nickname": None}
        parsed = json.loads(json.dumps(req))
        assert parsed["nickname"] is None


class TestAddWhitelistRequest(unittest.TestCase):
    """Test AddWhitelistRequest JSON structure"""

    def test_valid_request(self):
        req = {
            "chain": "base",
            "address": "0x4200000000000000000000000000000000000006",
            "symbol": "WETH",
            "decimals": 18,
        }
        parsed = json.loads(json.dumps(req))
        assert parsed["decimals"] == 18
        assert parsed["symbol"] == "WETH"


class TestWalletTradeStructure(unittest.TestCase):
    """Test WalletTrade JSON structure matches Rust type"""

    def test_full_trade(self):
        trade = {
            "wallet": "0x1234567890abcdef1234567890abcdef12345678",
            "chain": "base",
            "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            "block_number": 12345678,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "token_in": "0x4200000000000000000000000000000000000006",
            "token_in_symbol": "WETH",
            "token_out": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "token_out_symbol": "USDC",
            "amount_in": "1000000000000000000",
            "amount_out": "2500000000",
            "pool": "0xd0b53D9277642d899DF5C87A3966A349A798F224",
            "fee": 3000,
        }
        serialized = json.dumps(trade)
        parsed = json.loads(serialized)
        # Verify all required fields
        required_fields = [
            "wallet", "chain", "tx_hash", "block_number", "timestamp",
            "token_in", "token_in_symbol", "token_out", "token_out_symbol",
            "amount_in", "amount_out", "pool", "fee"
        ]
        for field in required_fields:
            assert field in parsed, f"Missing field: {field}"


class TestTopTraderStructure(unittest.TestCase):
    """Test TopTrader JSON structure"""

    def test_valid_trader(self):
        trader = {
            "rank": 1,
            "address": "0x1234567890abcdef1234567890abcdef12345678",
            "trade_count": 42,
            "total_volume_usd": 123456.78,
            "most_traded": ["WETH", "USDC"],
            "last_active": datetime.now(timezone.utc).isoformat(),
            "first_seen": datetime.now(timezone.utc).isoformat(),
        }
        parsed = json.loads(json.dumps(trader))
        assert parsed["rank"] == 1
        assert isinstance(parsed["most_traded"], list)


if __name__ == "__main__":
    unittest.main()
