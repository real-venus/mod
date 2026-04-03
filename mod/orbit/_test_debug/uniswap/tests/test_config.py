"""Tests for configuration files and consistency"""

import json
import os
import unittest

CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "config.json"
)


class TestConfigStructure(unittest.TestCase):
    """Validate config.json structure and values"""

    @classmethod
    def setUpClass(cls):
        with open(CONFIG_PATH) as f:
            cls.config = json.load(f)

    def test_engine_section(self):
        assert "engine" in self.config
        assert self.config["engine"]["port"] == 8080
        assert "data_path" in self.config["engine"]

    def test_app_section(self):
        assert "app" in self.config
        assert self.config["app"]["port"] == 3000

    def test_chains_exist(self):
        assert "chains" in self.config
        assert "base" in self.config["chains"]
        assert "polygon" in self.config["chains"]


class TestBaseChainConfig(unittest.TestCase):
    """Validate Base chain configuration"""

    @classmethod
    def setUpClass(cls):
        with open(CONFIG_PATH) as f:
            config = json.load(f)
        cls.base = config["chains"]["base"]

    def test_chain_id(self):
        assert self.base["chain_id"] == 8453

    def test_contracts(self):
        contracts = self.base["contracts"]
        assert contracts["router"].startswith("0x")
        assert contracts["quoter"].startswith("0x")
        assert contracts["position_manager"].startswith("0x")
        # All should be 42 chars (0x + 40 hex)
        for name, addr in contracts.items():
            assert len(addr) == 42, f"{name} address should be 42 chars"

    def test_tokens(self):
        tokens = self.base["tokens"]
        assert "WETH" in tokens
        assert "USDC" in tokens
        assert tokens["WETH"]["decimals"] == 18
        assert tokens["USDC"]["decimals"] == 6

    def test_token_addresses_valid(self):
        for sym, info in self.base["tokens"].items():
            assert info["address"].startswith("0x"), f"{sym} address should start with 0x"
            assert len(info["address"]) == 42, f"{sym} address should be 42 chars"

    def test_pools(self):
        pools = self.base["pools"]
        assert len(pools) >= 2
        for pool in pools:
            assert "name" in pool
            assert "address" in pool
            assert "token0" in pool
            assert "token1" in pool
            assert "fee" in pool
            assert pool["fee"] > 0

    def test_pool_tokens_exist(self):
        """Pool token references should exist in tokens config"""
        tokens = self.base["tokens"]
        for pool in self.base["pools"]:
            assert pool["token0"] in tokens, f"Pool {pool['name']} token0 '{pool['token0']}' not in tokens"
            assert pool["token1"] in tokens, f"Pool {pool['name']} token1 '{pool['token1']}' not in tokens"

    def test_wrapped_native(self):
        wn = self.base["wrapped_native"]
        assert wn["symbol"] == "WETH"
        assert wn["native_symbol"] == "ETH"


class TestPolygonChainConfig(unittest.TestCase):
    """Validate Polygon chain configuration"""

    @classmethod
    def setUpClass(cls):
        with open(CONFIG_PATH) as f:
            config = json.load(f)
        cls.polygon = config["chains"]["polygon"]

    def test_chain_id(self):
        assert self.polygon["chain_id"] == 137

    def test_contracts(self):
        contracts = self.polygon["contracts"]
        for name, addr in contracts.items():
            assert len(addr) == 42, f"Polygon {name} address should be 42 chars"

    def test_tokens(self):
        tokens = self.polygon["tokens"]
        assert "WMATIC" in tokens
        assert "WETH" in tokens
        assert "USDC" in tokens
        assert tokens["WMATIC"]["decimals"] == 18

    def test_pools(self):
        pools = self.polygon["pools"]
        assert len(pools) >= 3

    def test_pool_tokens_exist(self):
        tokens = self.polygon["tokens"]
        for pool in self.polygon["pools"]:
            assert pool["token0"] in tokens, f"Pool {pool['name']} token0 not in tokens"
            assert pool["token1"] in tokens, f"Pool {pool['name']} token1 not in tokens"

    def test_wrapped_native(self):
        wn = self.polygon["wrapped_native"]
        assert wn["symbol"] == "WMATIC"
        assert wn["native_symbol"] == "MATIC"


class TestCrossChainConsistency(unittest.TestCase):
    """Verify consistency between chain configs"""

    @classmethod
    def setUpClass(cls):
        with open(CONFIG_PATH) as f:
            config = json.load(f)
        cls.base = config["chains"]["base"]
        cls.polygon = config["chains"]["polygon"]

    def test_both_have_usdc(self):
        assert "USDC" in self.base["tokens"]
        assert "USDC" in self.polygon["tokens"]
        assert self.base["tokens"]["USDC"]["decimals"] == 6
        assert self.polygon["tokens"]["USDC"]["decimals"] == 6

    def test_both_have_weth(self):
        assert "WETH" in self.base["tokens"]
        assert "WETH" in self.polygon["tokens"]

    def test_different_chain_ids(self):
        assert self.base["chain_id"] != self.polygon["chain_id"]

    def test_different_contract_addresses(self):
        """Each chain should have unique contract addresses"""
        assert self.base["contracts"]["router"] != self.polygon["contracts"]["router"]

    def test_both_have_weth_usdc_pool(self):
        base_pools = {p["name"] for p in self.base["pools"]}
        poly_pools = {p["name"] for p in self.polygon["pools"]}
        assert "WETH/USDC" in base_pools
        assert "WETH/USDC" in poly_pools


if __name__ == "__main__":
    unittest.main()
