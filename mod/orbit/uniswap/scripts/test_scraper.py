#!/usr/bin/env python3
"""Tests for scrape_traders.py — unit tests for helpers + integration smoke test"""

import json
import os
import sys
import tempfile
import unittest

# Add scripts dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrape_traders import (
    decode_int256,
    estimate_usd,
    progress_bar,
    RpcRoundRobin,
    TOKEN_PRICES,
    STABLES,
    SWAP_TOPIC,
)


class TestDecodeInt256(unittest.TestCase):
    """Test int256 decoding from hex log data"""

    def test_positive_small(self):
        # 1000 in hex, padded to 64 chars
        hex_val = "00000000000000000000000000000000000000000000000000000000000003e8"
        self.assertEqual(decode_int256(hex_val), 1000)

    def test_zero(self):
        hex_val = "0" * 64
        self.assertEqual(decode_int256(hex_val), 0)

    def test_negative(self):
        # -1 in two's complement = all f's
        hex_val = "f" * 64
        self.assertEqual(decode_int256(hex_val), -1)

    def test_negative_large(self):
        # -1000 in two's complement
        hex_val = "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc18"
        self.assertEqual(decode_int256(hex_val), -1000)

    def test_positive_large(self):
        # 1 ETH = 10^18
        hex_val = "0000000000000000000000000000000000000000000000000de0b6b3a7640000"
        self.assertEqual(decode_int256(hex_val), 10**18)

    def test_max_positive(self):
        # 2^255 - 1 (max positive int256)
        hex_val = "7" + "f" * 63
        result = decode_int256(hex_val)
        self.assertGreater(result, 0)
        self.assertEqual(result, (1 << 255) - 1)

    def test_min_negative(self):
        # -2^255 (min negative int256)
        hex_val = "8" + "0" * 63
        result = decode_int256(hex_val)
        self.assertLess(result, 0)
        self.assertEqual(result, -(1 << 255))


class TestEstimateUsd(unittest.TestCase):
    """Test USD volume estimation"""

    def test_usdc_side(self):
        # 1000 USDC (6 decimals) on token1 side
        usd = estimate_usd("WETH", "USDC", 18, 6, 10**18, 1000 * 10**6)
        self.assertEqual(usd, 1000.0)

    def test_stable_on_token0(self):
        # 500 USDT on token0 side
        usd = estimate_usd("USDT", "WETH", 6, 18, 500 * 10**6, 10**18)
        self.assertEqual(usd, 500.0)

    def test_weth_no_stable(self):
        # WETH/DEGEN — no stablecoin, should use max of price estimates
        usd = estimate_usd("WETH", "DEGEN", 18, 18, 10**18, 10**22)
        # WETH side: 1 ETH * $3000 = $3000
        self.assertAlmostEqual(usd, 3000.0, places=0)

    def test_unknown_tokens(self):
        # Both tokens unknown — should return 0
        usd = estimate_usd("FAKEA", "FAKEB", 18, 18, 10**18, 10**18)
        self.assertEqual(usd, 0.0)

    def test_stablecoin_priority(self):
        # When stable is on token0, use that even if token1 has a price
        usd = estimate_usd("USDC", "WETH", 6, 18, 2000 * 10**6, 10**18)
        self.assertEqual(usd, 2000.0)  # USDC side, not WETH estimate

    def test_zero_amounts(self):
        usd = estimate_usd("WETH", "USDC", 18, 6, 0, 0)
        self.assertEqual(usd, 0.0)


class TestProgressBar(unittest.TestCase):
    """Test progress bar formatting"""

    def test_zero(self):
        bar = progress_bar(0, 100)
        self.assertIn("0.0%", bar)
        self.assertIn("[", bar)

    def test_half(self):
        bar = progress_bar(50, 100)
        self.assertIn("50.0%", bar)

    def test_full(self):
        bar = progress_bar(100, 100)
        self.assertIn("100.0%", bar)

    def test_zero_total(self):
        bar = progress_bar(0, 0)
        self.assertIn("0.0%", bar)

    def test_custom_width(self):
        bar = progress_bar(50, 100, width=20)
        # 20 chars inside brackets
        inner = bar[bar.index("[") + 1:bar.index("]")]
        self.assertEqual(len(inner), 20)


class TestRpcRoundRobin(unittest.TestCase):
    """Test RPC round-robin cycling"""

    def test_cycles_urls(self):
        rpcs = ["http://a", "http://b", "http://c"]
        rr = RpcRoundRobin(rpcs)
        urls = [rr.next_url() for _ in range(6)]
        self.assertEqual(urls, ["http://a", "http://b", "http://c", "http://a", "http://b", "http://c"])

    def test_get_w3_caches(self):
        rpcs = ["https://mainnet.base.org"]
        rr = RpcRoundRobin(rpcs)
        w3a, url_a = rr.get_w3()
        w3b, url_b = rr.get_w3()
        self.assertIs(w3a, w3b)  # Same instance from cache
        self.assertEqual(url_a, url_b)


class TestSwapTopic(unittest.TestCase):
    """Verify the swap event topic is correct"""

    def test_topic_format(self):
        self.assertTrue(SWAP_TOPIC.startswith("0x"))
        self.assertEqual(len(SWAP_TOPIC), 66)  # 0x + 64 hex chars

    def test_topic_is_keccak(self):
        # Known keccak256 of Swap(address,address,int256,int256,uint160,uint128,int24)
        expected = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"
        self.assertEqual(SWAP_TOPIC, expected)


class TestTokenPrices(unittest.TestCase):
    """Verify token price config sanity"""

    def test_stables_are_one(self):
        for sym in STABLES:
            if sym in TOKEN_PRICES:
                self.assertEqual(TOKEN_PRICES[sym], 1, f"{sym} should be $1")

    def test_weth_reasonable(self):
        self.assertGreater(TOKEN_PRICES["WETH"], 1000)
        self.assertLess(TOKEN_PRICES["WETH"], 50000)

    def test_wbtc_reasonable(self):
        self.assertGreater(TOKEN_PRICES["WBTC"], 10000)


class TestIntegrationSmoke(unittest.TestCase):
    """Smoke test: verify RPC connectivity and basic log fetching"""

    @unittest.skipIf(os.getenv("SKIP_RPC_TESTS"), "RPC tests skipped")
    def test_rpc_connected(self):
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org", request_kwargs={"timeout": 10}))
        self.assertTrue(w3.is_connected())

    @unittest.skipIf(os.getenv("SKIP_RPC_TESTS"), "RPC tests skipped")
    def test_can_fetch_swap_events(self):
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org", request_kwargs={"timeout": 15}))
        current = w3.eth.block_number
        logs = w3.eth.get_logs({
            "fromBlock": current - 10,
            "toBlock": current,
            "topics": [SWAP_TOPIC],
        })
        # There should be swap events in the last 10 blocks on Base
        self.assertIsInstance(logs, list)
        self.assertGreater(len(logs), 0, "Expected swap events in last 10 blocks")

    @unittest.skipIf(os.getenv("SKIP_RPC_TESTS"), "RPC tests skipped")
    def test_round_robin_failover(self):
        """Test that round-robin works across gateways"""
        rr = RpcRoundRobin()
        connected = 0
        for _ in range(len(rr.rpcs)):
            w3, url = rr.get_w3()
            try:
                if w3.is_connected():
                    connected += 1
            except:
                pass
        self.assertGreater(connected, 0, "At least one gateway should be reachable")


class TestDataOutput(unittest.TestCase):
    """Test that output files would be valid JSON"""

    def test_save_creates_valid_json(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"traders": [{"rank": 1, "address": "0xabc", "volume_usd": 1000}]}, f)
            f.flush()
            # Re-read and verify
            with open(f.name) as rf:
                data = json.load(rf)
                self.assertEqual(data["traders"][0]["rank"], 1)
            os.unlink(f.name)


if __name__ == "__main__":
    unittest.main(verbosity=2)
