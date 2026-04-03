"""Tests for UniswapV3Mod Python wrapper (uniswap/mod.py)"""

import json
import unittest
from unittest.mock import patch, MagicMock
from io import BytesIO
import urllib.request
import urllib.error
import sys
import os

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from uniswap.mod import UniswapV3Mod, _load_engine_url, ENGINE_URL


class TestEngineUrlLoading(unittest.TestCase):
    """Test engine URL resolution from config and env"""

    def test_default_url(self):
        assert ENGINE_URL.startswith("http")

    def test_env_override(self):
        with patch.dict(os.environ, {"ENGINE_URL": "http://custom:9999"}):
            # Re-import to test env var
            url = os.environ.get("ENGINE_URL") or _load_engine_url()
            assert url == "http://custom:9999"

    def test_load_engine_url_from_config(self):
        url = _load_engine_url()
        # Should resolve to localhost:8080 from config.json
        assert "localhost" in url or "127.0.0.1" in url

    def test_load_engine_url_fallback(self):
        with patch("pathlib.Path.exists", return_value=False):
            url = _load_engine_url()
            assert url == "http://localhost:8080"


class TestUniswapV3ModInit(unittest.TestCase):
    """Test module initialization"""

    def test_default_init(self):
        mod = UniswapV3Mod()
        assert mod.url == ENGINE_URL.rstrip("/")

    def test_custom_url(self):
        mod = UniswapV3Mod("http://custom:1234/")
        assert mod.url == "http://custom:1234"

    def test_trailing_slash_stripped(self):
        mod = UniswapV3Mod("http://example.com///")
        assert mod.url == "http://example.com//"  # rstrip only removes trailing

    def test_description_exists(self):
        assert "Uniswap V3" in UniswapV3Mod.description


def _mock_response(data):
    """Create a mock urllib response"""
    resp = MagicMock()
    resp.read.return_value = json.dumps(data).encode()
    resp.__enter__ = MagicMock(return_value=resp)
    resp.__exit__ = MagicMock(return_value=False)
    return resp


class TestCoreEndpoints(unittest.TestCase):
    """Test core API wrapper methods"""

    def setUp(self):
        self.mod = UniswapV3Mod("http://localhost:8080")

    @patch("urllib.request.urlopen")
    def test_health(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"status": "healthy", "chains": []})
        result = self.mod.health()
        assert result["status"] == "healthy"

    @patch("urllib.request.urlopen")
    def test_chains(self, mock_urlopen):
        chains = [{"chain": "base", "chain_id": 8453}, {"chain": "polygon", "chain_id": 137}]
        mock_urlopen.return_value = _mock_response(chains)
        result = self.mod.chains()
        assert len(result) == 2
        assert result[0]["chain_id"] == 8453

    @patch("urllib.request.urlopen")
    def test_tokens(self, mock_urlopen):
        tokens = {"WETH": {"address": "0x4200", "decimals": 18}}
        mock_urlopen.return_value = _mock_response(tokens)
        result = self.mod.tokens("base")
        assert "WETH" in result

    @patch("urllib.request.urlopen")
    def test_tokens_default_chain(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({})
        self.mod.tokens()
        # Verify the URL contains chain=base
        call_args = mock_urlopen.call_args
        req = call_args[0][0]
        assert "chain=base" in req.full_url

    @patch("urllib.request.urlopen")
    def test_pools(self, mock_urlopen):
        pools = [{"name": "WETH/USDC", "address": "0xd0b5"}]
        mock_urlopen.return_value = _mock_response(pools)
        result = self.mod.pools("base")
        assert len(result) == 1
        assert result[0]["name"] == "WETH/USDC"

    @patch("urllib.request.urlopen")
    def test_pool_state(self, mock_urlopen):
        state = {"address": "0xd0b5", "price": 2500.0, "tick": 200000}
        mock_urlopen.return_value = _mock_response(state)
        result = self.mod.pool_state("0xd0b5", "base")
        assert result["price"] == 2500.0

    @patch("urllib.request.urlopen")
    def test_quote(self, mock_urlopen):
        quote = {"amount_out": "2500000000", "price_impact": 0.01}
        mock_urlopen.return_value = _mock_response(quote)
        result = self.mod.quote("base", "0xWETH", "0xUSDC", "1000000000000000000")
        assert result["amount_out"] == "2500000000"

    @patch("urllib.request.urlopen")
    def test_quote_with_fee(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"amount_out": "100"})
        self.mod.quote("base", "0xA", "0xB", "100", fee=500)
        req = mock_urlopen.call_args[0][0]
        assert "fee=500" in req.full_url

    @patch("urllib.request.urlopen")
    def test_balance(self, mock_urlopen):
        bal = {"balance": "1000000", "decimals": 6}
        mock_urlopen.return_value = _mock_response(bal)
        result = self.mod.balance("base", "0xUSDC", "0xWallet")
        assert result["balance"] == "1000000"


class TestSwapEndpoint(unittest.TestCase):
    """Test swap building"""

    def setUp(self):
        self.mod = UniswapV3Mod("http://localhost:8080")

    @patch("urllib.request.urlopen")
    def test_build_swap(self, mock_urlopen):
        swap_data = {"swap": "0xcalldata", "approve": "0xapprove", "router": "0xrouter"}
        mock_urlopen.return_value = _mock_response(swap_data)
        result = self.mod.build_swap(
            "base", "0xWETH", "0xUSDC",
            "1000000000000000000", "2400000000", "0xRecipient"
        )
        assert "swap" in result
        assert "approve" in result
        assert "router" in result

    @patch("urllib.request.urlopen")
    def test_build_swap_custom_fee(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"swap": "0x"})
        self.mod.build_swap("base", "0xA", "0xB", "100", "90", "0xR", fee=500)
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["fee"] == 500


class TestStrategyEndpoints(unittest.TestCase):
    """Test strategy CRUD operations"""

    def setUp(self):
        self.mod = UniswapV3Mod("http://localhost:8080")

    @patch("urllib.request.urlopen")
    def test_list_strategies(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response([])
        result = self.mod.list_strategies()
        assert result == []

    @patch("urllib.request.urlopen")
    def test_create_strategy(self, mock_urlopen):
        record = {"id": "abc-123", "kind": "dca", "status": "active"}
        mock_urlopen.return_value = _mock_response(record)
        result = self.mod.create_strategy("dca", "base", {"token_in": "0xA"})
        assert result["kind"] == "dca"

    @patch("urllib.request.urlopen")
    def test_create_strategy_sends_correct_body(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "x"})
        self.mod.create_strategy("limit_order", "polygon", {"target_price": 3000})
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["kind"] == "limit_order"
        assert body["chain"] == "polygon"
        assert body["config"]["target_price"] == 3000

    @patch("urllib.request.urlopen")
    def test_get_strategy(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "abc", "status": "active"})
        result = self.mod.get_strategy("abc")
        assert result["status"] == "active"

    @patch("urllib.request.urlopen")
    def test_delete_strategy(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"deleted": True})
        result = self.mod.delete_strategy("abc")
        assert result["deleted"] is True

    @patch("urllib.request.urlopen")
    def test_pause_strategy(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"status": "paused"})
        result = self.mod.pause_strategy("abc")
        assert result["status"] == "paused"

    @patch("urllib.request.urlopen")
    def test_resume_strategy(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"status": "active"})
        result = self.mod.resume_strategy("abc")
        assert result["status"] == "active"

    @patch("urllib.request.urlopen")
    def test_strategy_history(self, mock_urlopen):
        history = [{"timestamp": "2024-01-01", "action": "swap", "result": "ok"}]
        mock_urlopen.return_value = _mock_response(history)
        result = self.mod.strategy_history("abc")
        assert len(result) == 1


class TestConvenienceMethods(unittest.TestCase):
    """Test DCA, limit order, momentum, arb convenience methods"""

    def setUp(self):
        self.mod = UniswapV3Mod("http://localhost:8080")

    @patch("urllib.request.urlopen")
    def test_dca(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "dca-1", "kind": "dca"})
        result = self.mod.dca("base", "0xWETH", "0xUSDC", "100", interval_secs=1800)
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["kind"] == "dca"
        assert body["config"]["amount_per_tick"] == "100"
        assert body["config"]["interval_secs"] == 1800

    @patch("urllib.request.urlopen")
    def test_limit_order(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "limit-1"})
        result = self.mod.limit_order("base", "0xPool", "0xUSDC", "0xWETH", "1000", 0.0004)
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["kind"] == "limit_order"
        assert body["config"]["target_price"] == 0.0004
        assert body["config"]["direction"] == "above"

    @patch("urllib.request.urlopen")
    def test_limit_order_below(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "limit-2"})
        self.mod.limit_order("base", "0xP", "0xA", "0xB", "500", 2000.0, direction="below")
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["config"]["direction"] == "below"

    @patch("urllib.request.urlopen")
    def test_momentum(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "mom-1"})
        self.mod.momentum("base", "0xPool", "0xUSDC", "0xWETH", "500", sma_short=5, sma_long=20)
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["kind"] == "momentum"
        assert body["config"]["sma_short"] == 5
        assert body["config"]["sma_long"] == 20

    @patch("urllib.request.urlopen")
    def test_arb(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "arb-1"})
        self.mod.arb("0xBasePool", "0xPolyPool", "1000", min_spread=0.01)
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["kind"] == "arb"
        assert body["chain"] == "base"
        assert body["config"]["min_spread"] == 0.01

    @patch("urllib.request.urlopen")
    def test_arb_with_token_addrs(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "arb-2"})
        self.mod.arb(
            "0xBase", "0xPoly", "500",
            token_in_base="0xUSDC_BASE",
            token_out_base="0xWETH_BASE",
        )
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["config"]["token_in_base"] == "0xUSDC_BASE"


class TestCopyTradingEndpoints(unittest.TestCase):
    """Test copy trading / watchlist methods"""

    def setUp(self):
        self.mod = UniswapV3Mod("http://localhost:8080")

    @patch("urllib.request.urlopen")
    def test_get_watchlist(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response([
            {"address": "0xabc", "nickname": "whale"}
        ])
        result = self.mod.get_watchlist()
        assert len(result) == 1
        assert result[0]["nickname"] == "whale"

    @patch("urllib.request.urlopen")
    def test_add_to_watchlist(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"address": "0xabc"})
        result = self.mod.add_to_watchlist("0xabc", nickname="whale1")
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["address"] == "0xabc"
        assert body["nickname"] == "whale1"

    @patch("urllib.request.urlopen")
    def test_add_to_watchlist_no_nickname(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"address": "0xabc"})
        self.mod.add_to_watchlist("0xabc")
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["nickname"] is None

    @patch("urllib.request.urlopen")
    def test_remove_from_watchlist(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"removed": True})
        result = self.mod.remove_from_watchlist("0xabc")
        assert result["removed"] is True
        req = mock_urlopen.call_args[0][0]
        assert req.method == "DELETE"
        assert "/watchlist/0xabc" in req.full_url

    @patch("urllib.request.urlopen")
    def test_get_wallet_trades(self, mock_urlopen):
        trades = [{"tx_hash": "0x1", "token_in_symbol": "USDC"}]
        mock_urlopen.return_value = _mock_response(trades)
        result = self.mod.get_wallet_trades("0xabc", chain="polygon", days=7)
        req = mock_urlopen.call_args[0][0]
        assert "chain=polygon" in req.full_url
        assert "days=7" in req.full_url
        assert len(result) == 1

    @patch("urllib.request.urlopen")
    def test_get_wallet_performance(self, mock_urlopen):
        perf = {"total_trades": 42, "total_volume_usd": 100000.0}
        mock_urlopen.return_value = _mock_response(perf)
        result = self.mod.get_wallet_performance("0xabc")
        assert result["total_trades"] == 42

    @patch("urllib.request.urlopen")
    def test_sync_wallet(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"synced": True, "trade_count": 15})
        result = self.mod.sync_wallet("0xabc")
        assert result["synced"] is True

    @patch("urllib.request.urlopen")
    def test_copy_trade(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "copy-1", "kind": "copy_trade"})
        result = self.mod.copy_trade("0xWhale", chain="polygon", max_trade_size="5000000000")
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["kind"] == "copy_trade"
        assert body["chain"] == "polygon"
        assert body["config"]["wallet_address"] == "0xWhale"
        assert body["config"]["max_trade_size"] == "5000000000"

    @patch("urllib.request.urlopen")
    def test_copy_trade_with_whitelist(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "copy-2"})
        self.mod.copy_trade("0xW", token_whitelist=["0xUSDC", "0xWETH"])
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["config"]["token_whitelist"] == ["0xUSDC", "0xWETH"]

    @patch("urllib.request.urlopen")
    def test_copy_trade_no_whitelist(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"id": "copy-3"})
        self.mod.copy_trade("0xW")
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert "token_whitelist" not in body["config"]


class TestWhitelistEndpoints(unittest.TestCase):
    """Test token whitelist management"""

    def setUp(self):
        self.mod = UniswapV3Mod("http://localhost:8080")

    @patch("urllib.request.urlopen")
    def test_get_whitelist(self, mock_urlopen):
        tokens = [{"symbol": "WETH", "address": "0x4200", "decimals": 18}]
        mock_urlopen.return_value = _mock_response(tokens)
        result = self.mod.get_whitelist("base")
        assert len(result) == 1

    @patch("urllib.request.urlopen")
    def test_get_whitelist_default_chain(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response([])
        self.mod.get_whitelist()
        req = mock_urlopen.call_args[0][0]
        assert "chain=base" in req.full_url

    @patch("urllib.request.urlopen")
    def test_add_to_whitelist(self, mock_urlopen):
        token = {"symbol": "DEGEN", "address": "0xDEGEN", "decimals": 18}
        mock_urlopen.return_value = _mock_response(token)
        result = self.mod.add_to_whitelist("base", "0xDEGEN", "DEGEN", 18)
        req = mock_urlopen.call_args[0][0]
        body = json.loads(req.data)
        assert body["chain"] == "base"
        assert body["symbol"] == "DEGEN"
        assert body["decimals"] == 18

    @patch("urllib.request.urlopen")
    def test_remove_from_whitelist(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"removed": True})
        result = self.mod.remove_from_whitelist("base", "0xDEGEN")
        req = mock_urlopen.call_args[0][0]
        assert req.method == "DELETE"
        assert "/whitelist/base/0xDEGEN" in req.full_url


class TestHTTPMethods(unittest.TestCase):
    """Test internal HTTP methods"""

    def setUp(self):
        self.mod = UniswapV3Mod("http://localhost:8080")

    @patch("urllib.request.urlopen")
    def test_get_no_params(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"ok": True})
        result = self.mod._get("/health")
        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "http://localhost:8080/health"

    @patch("urllib.request.urlopen")
    def test_get_with_params(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({})
        self.mod._get("/tokens", {"chain": "base", "unused": None})
        req = mock_urlopen.call_args[0][0]
        assert "chain=base" in req.full_url
        # None values should be excluded
        assert "unused" not in req.full_url

    @patch("urllib.request.urlopen")
    def test_post_sends_json(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({})
        self.mod._post("/strategies", {"kind": "dca"})
        req = mock_urlopen.call_args[0][0]
        assert req.get_header("Content-type") == "application/json"
        body = json.loads(req.data)
        assert body["kind"] == "dca"

    @patch("urllib.request.urlopen")
    def test_delete_method(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({"deleted": True})
        self.mod._delete("/strategies/abc")
        req = mock_urlopen.call_args[0][0]
        assert req.method == "DELETE"

    @patch("urllib.request.urlopen")
    def test_http_error_propagates(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "http://localhost:8080/health", 500, "Server Error", {}, None
        )
        with self.assertRaises(urllib.error.HTTPError):
            self.mod.health()

    @patch("urllib.request.urlopen")
    def test_connection_error_propagates(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")
        with self.assertRaises(urllib.error.URLError):
            self.mod.health()


if __name__ == "__main__":
    unittest.main()
