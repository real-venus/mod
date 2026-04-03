"""Tests for the Python trader discovery scraper (scripts/scrape_traders.py)"""

import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))

# Import helpers from scraper
from scrape_traders import (
    decode_int256,
    estimate_usd,
    progress_bar,
    RpcRoundRobin,
    TOKEN_PRICES,
    STABLES,
    FREE_RPCS,
)


class TestDecodeInt256(unittest.TestCase):
    """Test two's complement int256 decoding from hex strings"""

    def test_zero(self):
        assert decode_int256("0" * 64) == 0

    def test_positive_one(self):
        assert decode_int256("0" * 63 + "1") == 1

    def test_positive_large(self):
        # 1 ETH = 10^18 = 0xDE0B6B3A7640000
        hex_val = "0" * (64 - 16) + "0DE0B6B3A7640000"
        assert decode_int256(hex_val.lower()) == 1_000_000_000_000_000_000

    def test_negative_one(self):
        assert decode_int256("f" * 64) == -1

    def test_negative_small(self):
        # -500000000 (500 USDC with 6 decimals)
        val = (1 << 256) - 500_000_000
        hex_val = format(val, "064x")
        assert decode_int256(hex_val) == -500_000_000

    def test_max_int256(self):
        hex_val = "7" + "f" * 63
        result = decode_int256(hex_val)
        assert result > 0

    def test_min_int256(self):
        hex_val = "8" + "0" * 63
        result = decode_int256(hex_val)
        assert result < 0

    def test_1000_usdc(self):
        # 1000 USDC (6 decimals) = 1_000_000_000
        hex_val = format(1_000_000_000, "064x")
        assert decode_int256(hex_val) == 1_000_000_000


class TestEstimateUsd(unittest.TestCase):
    """Test USD volume estimation from swap amounts"""

    def test_stable_token0(self):
        # token0 is USDC, 1000 USDC
        usd = estimate_usd("USDC", "WETH", 6, 18, 1_000_000_000, 400_000_000_000_000_000)
        assert abs(usd - 1000.0) < 0.01

    def test_stable_token1(self):
        # token1 is USDT
        usd = estimate_usd("WETH", "USDT", 18, 6, 1_000_000_000_000_000_000, 2500_000_000)
        assert abs(usd - 2500.0) < 0.01

    def test_dai_18_decimals(self):
        # DAI has 18 decimals
        usd = estimate_usd("WETH", "DAI", 18, 18, 1_000_000_000_000_000_000, 2500_000_000_000_000_000_000)
        assert abs(usd - 2500.0) < 0.01

    def test_no_stable(self):
        # WETH/WBTC — uses max of price estimates
        usd = estimate_usd("WETH", "WBTC", 18, 8, 1_000_000_000_000_000_000, 3_500_000)
        # Should use WETH price ($3000) or WBTC price ($85000)
        assert usd > 0

    def test_unknown_tokens(self):
        # Both tokens unknown
        usd = estimate_usd("UNKNOWN1", "UNKNOWN2", 18, 18, 100, 200)
        assert usd == 0

    def test_stable_preferred_over_other(self):
        # When token0 is stable, use it directly even if token1 has a price
        usd = estimate_usd("USDC", "WETH", 6, 18, 5000_000_000, 2_000_000_000_000_000_000)
        assert abs(usd - 5000.0) < 0.01

    def test_zero_amounts(self):
        usd = estimate_usd("USDC", "WETH", 6, 18, 0, 0)
        assert usd == 0.0


class TestProgressBar(unittest.TestCase):
    """Test progress bar rendering"""

    def test_zero_progress(self):
        bar = progress_bar(0, 100)
        assert "0.0%" in bar

    def test_full_progress(self):
        bar = progress_bar(100, 100)
        assert "100.0%" in bar

    def test_half_progress(self):
        bar = progress_bar(50, 100)
        assert "50.0%" in bar

    def test_zero_total(self):
        bar = progress_bar(0, 0)
        assert "0.0%" in bar

    def test_contains_brackets(self):
        bar = progress_bar(50, 100)
        assert bar.startswith("[")
        assert "]" in bar


class TestRpcRoundRobin(unittest.TestCase):
    """Test RPC gateway round-robin"""

    def test_default_rpcs(self):
        rr = RpcRoundRobin()
        assert len(rr.rpcs) == len(FREE_RPCS)

    def test_custom_rpcs(self):
        rr = RpcRoundRobin(["http://a", "http://b"])
        assert len(rr.rpcs) == 2

    def test_round_robin_cycles(self):
        rr = RpcRoundRobin(["http://a", "http://b", "http://c"])
        urls = [rr.next_url() for _ in range(6)]
        assert urls == ["http://a", "http://b", "http://c", "http://a", "http://b", "http://c"]

    def test_get_w3_caches(self):
        rr = RpcRoundRobin(["https://mainnet.base.org"])
        # First call creates, second returns cached
        w3_1, url_1 = rr.get_w3()
        # Reset index to get same URL
        rr.index = 0
        w3_2, url_2 = rr.get_w3()
        assert url_1 == url_2

    def test_index_starts_at_zero(self):
        rr = RpcRoundRobin(["http://first", "http://second"])
        assert rr.next_url() == "http://first"


class TestConstants(unittest.TestCase):
    """Test configuration constants"""

    def test_stables_are_known(self):
        for stable in STABLES:
            assert stable in TOKEN_PRICES, f"{stable} should have price 1"
            assert TOKEN_PRICES[stable] == 1

    def test_free_rpcs_not_empty(self):
        assert len(FREE_RPCS) >= 3

    def test_all_rpcs_are_https(self):
        for url in FREE_RPCS:
            assert url.startswith("https://"), f"RPC {url} should use HTTPS"


if __name__ == "__main__":
    unittest.main()
