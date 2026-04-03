"""Tests for UnBit — 1-bit quantized local LLM agents.

Runs without any LLM server (tests fallback/parsing logic).
"""

import json
import random
import unittest
from unittest.mock import patch, MagicMock

from .agent import UnBitAgent, UnBitCreatorAgent, UnBitInvestorAgent
from .models import MODELS, DEFAULT_MODEL, list_models, get_model_path, MODELS_DIR


class TestModels(unittest.TestCase):
    """Test model registry."""

    def test_models_registry_has_entries(self):
        self.assertGreater(len(MODELS), 0)

    def test_default_model_exists(self):
        self.assertIn(DEFAULT_MODEL, MODELS)

    def test_list_models(self):
        result = list_models()
        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        for m in result:
            self.assertIn("key", m)
            self.assertIn("filename", m)
            self.assertIn("size_mb", m)
            self.assertIn("downloaded", m)

    def test_get_model_path(self):
        path = get_model_path(DEFAULT_MODEL)
        self.assertTrue(str(path).endswith(".gguf"))

    def test_get_model_path_unknown(self):
        with self.assertRaises(ValueError):
            get_model_path("nonexistent-model-xyz")

    def test_all_models_have_required_fields(self):
        for key, cfg in MODELS.items():
            self.assertIn("url", cfg, f"Model {key} missing url")
            self.assertIn("filename", cfg, f"Model {key} missing filename")
            self.assertIn("ctx", cfg, f"Model {key} missing ctx")
            self.assertTrue(cfg["filename"].endswith(".gguf"), f"Model {key} not a .gguf")


class TestUnBitAgent(unittest.TestCase):
    """Test UnBitAgent without a live LLM server."""

    def setUp(self):
        self.agent = UnBitAgent(base_url="http://localhost:99999")

    def test_init_defaults(self):
        agent = UnBitAgent()
        self.assertEqual(agent.backend, "llama_cpp")
        self.assertEqual(agent.model_key, DEFAULT_MODEL)
        self.assertEqual(agent.temperature, 0.9)

    def test_init_ollama_backend(self):
        agent = UnBitAgent(backend="ollama")
        self.assertIn("11434", agent.base_url)

    def test_init_custom_url(self):
        agent = UnBitAgent(base_url="http://myserver:5000")
        self.assertEqual(agent.base_url, "http://myserver:5000")

    # --- Token parsing ---

    def test_parse_token_valid_json(self):
        response = '{"name":"TestCoin","symbol":"TST","curve_type":1,"curve_param":"500000000000000","buy_fee":200,"sell_fee":100}'
        result = self.agent._parse_token(response)
        self.assertEqual(result["name"], "TestCoin")
        self.assertEqual(result["symbol"], "TST")
        self.assertEqual(result["curve_type"], 1)
        self.assertEqual(result["curve_param"], "500000000000000")
        self.assertEqual(result["buy_fee"], 200)
        self.assertEqual(result["sell_fee"], 100)

    def test_parse_token_json_in_text(self):
        response = 'Here is my proposal: {"name":"Alpha","symbol":"ALP","curve_type":0,"curve_param":"1000000000000000","buy_fee":50,"sell_fee":75} hope you like it'
        result = self.agent._parse_token(response)
        self.assertEqual(result["name"], "Alpha")
        self.assertEqual(result["symbol"], "ALP")

    def test_parse_token_clamps_fees(self):
        response = '{"name":"X","symbol":"X","curve_type":0,"curve_param":"1","buy_fee":9999,"sell_fee":-50}'
        result = self.agent._parse_token(response)
        self.assertEqual(result["buy_fee"], 1000)
        self.assertEqual(result["sell_fee"], 0)

    def test_parse_token_wraps_curve_type(self):
        response = '{"name":"X","symbol":"X","curve_type":7,"curve_param":"1","buy_fee":0,"sell_fee":0}'
        result = self.agent._parse_token(response)
        self.assertEqual(result["curve_type"], 3)  # 7 % 4

    def test_parse_token_garbage_returns_random(self):
        result = self.agent._parse_token("not json at all lmao")
        self.assertIn("name", result)
        self.assertIn("symbol", result)
        self.assertIn("curve_type", result)
        self.assertIn(result["curve_type"], [0, 1, 2, 3])

    def test_parse_token_empty_returns_random(self):
        result = self.agent._parse_token("{}")
        self.assertEqual(result["name"], "UnBitToken")
        self.assertEqual(result["symbol"], "UBT")

    def test_parse_token_partial_fills_defaults(self):
        response = '{"name":"Partial"}'
        result = self.agent._parse_token(response)
        self.assertEqual(result["name"], "Partial")
        self.assertEqual(result["symbol"], "UBT")
        self.assertEqual(result["buy_fee"], 100)

    # --- Allocation parsing ---

    def test_parse_allocations_valid(self):
        proposals = [
            {"symbol": "AAA", "curve_type": 0, "buy_fee": 100, "sell_fee": 100},
            {"symbol": "BBB", "curve_type": 1, "buy_fee": 200, "sell_fee": 200},
        ]
        response = '{"AAA": 7000, "BBB": 3000}'
        result = self.agent._parse_allocations(response, proposals, 10000)
        self.assertEqual(result["AAA"], 7000)
        self.assertEqual(result["BBB"], 3000)

    def test_parse_allocations_normalizes_to_budget(self):
        proposals = [{"symbol": "X"}, {"symbol": "Y"}]
        response = '{"X": 100, "Y": 100}'
        result = self.agent._parse_allocations(response, proposals, 10000)
        self.assertEqual(result["X"] + result["Y"], 10000)

    def test_parse_allocations_garbage_returns_random(self):
        proposals = [{"symbol": "A"}, {"symbol": "B"}]
        result = self.agent._parse_allocations("not json", proposals, 10000)
        self.assertIn("A", result)
        self.assertIn("B", result)
        total = sum(result.values())
        self.assertGreater(total, 0)

    def test_parse_allocations_in_text(self):
        proposals = [{"symbol": "FOO"}, {"symbol": "BAR"}]
        response = 'I would allocate: {"FOO": 6000, "BAR": 4000}'
        result = self.agent._parse_allocations(response, proposals, 10000)
        self.assertEqual(result["FOO"], 6000)

    # --- Random fallbacks ---

    def test_random_token_valid(self):
        result = self.agent._random_token()
        self.assertIn("name", result)
        self.assertIn("symbol", result)
        self.assertIn(result["curve_type"], [0, 1, 2, 3])
        self.assertGreaterEqual(result["buy_fee"], 0)
        self.assertLessEqual(result["buy_fee"], 500)
        self.assertGreaterEqual(result["sell_fee"], 0)
        self.assertLessEqual(result["sell_fee"], 500)

    def test_random_allocations(self):
        proposals = [{"symbol": "A"}, {"symbol": "B"}, {"symbol": "C"}]
        result = self.agent._random_allocations(proposals, 10000)
        self.assertEqual(len(result), 3)
        self.assertEqual(sum(result.values()), 10000)

    def test_random_allocations_single(self):
        proposals = [{"symbol": "ONLY"}]
        result = self.agent._random_allocations(proposals, 5000)
        self.assertEqual(result["ONLY"], 5000)

    # --- LLM call fallback ---

    def test_call_fails_gracefully(self):
        # No server running on port 99999
        result = self.agent._call("test prompt")
        self.assertEqual(result, "{}")

    def test_propose_token_without_server(self):
        result = self.agent.propose_token(survivors=[], generation=1)
        self.assertIn("name", result)
        self.assertIn("curve_type", result)

    def test_evaluate_tokens_without_server(self):
        proposals = [
            {"symbol": "AA", "curve_type": 0, "buy_fee": 100, "sell_fee": 100},
            {"symbol": "BB", "curve_type": 1, "buy_fee": 50, "sell_fee": 50},
        ]
        result = self.agent.evaluate_tokens(proposals, 10000)
        self.assertIn("AA", result)
        self.assertIn("BB", result)

    # --- Validate token ---

    def test_validate_token_clamps_burn_bps(self):
        raw = {"name": "X", "symbol": "X", "burn_bps": 99999}
        result = self.agent._validate_token(raw)
        self.assertEqual(result["burn_bps"], 10000)

    def test_validate_token_negative_burn_bps(self):
        raw = {"name": "X", "symbol": "X", "burn_bps": -100}
        result = self.agent._validate_token(raw)
        self.assertEqual(result["burn_bps"], 0)


class TestUnBitCreatorAgent(unittest.TestCase):
    """Test creator agent."""

    def setUp(self):
        self.agent = UnBitCreatorAgent(base_url="http://localhost:99999")

    def test_forward_returns_list(self):
        result = self.agent.forward(count=3)
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 3)

    def test_forward_each_has_required_fields(self):
        result = self.agent.forward(count=2)
        for p in result:
            self.assertIn("name", p)
            self.assertIn("symbol", p)
            self.assertIn("curve_type", p)
            self.assertIn("curve_param", p)
            self.assertIn("buy_fee", p)
            self.assertIn("sell_fee", p)

    def test_forward_with_survivors(self):
        survivors = [{"symbol": "WIN", "curve_type": 0, "buy_fee": 50}]
        result = self.agent.forward(survivors=survivors, generation=2, count=2)
        self.assertEqual(len(result), 2)


class TestUnBitInvestorAgent(unittest.TestCase):
    """Test investor agent."""

    def setUp(self):
        self.agent = UnBitInvestorAgent(base_url="http://localhost:99999")

    def test_forward_no_proposals(self):
        result = self.agent.forward(proposals=None)
        self.assertIn("error", result)

    def test_forward_returns_allocations(self):
        proposals = [
            {"symbol": "X", "curve_type": 0, "buy_fee": 100, "sell_fee": 100},
            {"symbol": "Y", "curve_type": 1, "buy_fee": 50, "sell_fee": 50},
        ]
        result = self.agent.forward(proposals=proposals, budget=5000)
        self.assertIsInstance(result, dict)
        self.assertIn("X", result)
        self.assertIn("Y", result)

    def test_forward_budget_respected(self):
        proposals = [{"symbol": "A"}, {"symbol": "B"}]
        result = self.agent.forward(proposals=proposals, budget=8000)
        total = sum(result.values())
        self.assertGreater(total, 0)
        self.assertLessEqual(total, 8000)


class TestMockedLLMCalls(unittest.TestCase):
    """Test with mocked LLM responses to verify end-to-end flow."""

    def setUp(self):
        self.agent = UnBitAgent(base_url="http://localhost:99999")

    @patch.object(UnBitAgent, '_call')
    def test_propose_token_with_mock_llm(self, mock_call):
        mock_call.return_value = '{"name":"MockCoin","symbol":"MCK","curve_type":2,"curve_param":"2000000000000000","buy_fee":75,"sell_fee":125}'
        result = self.agent.propose_token(generation=1)
        self.assertEqual(result["name"], "MockCoin")
        self.assertEqual(result["symbol"], "MCK")
        self.assertEqual(result["curve_type"], 2)
        self.assertEqual(result["buy_fee"], 75)
        mock_call.assert_called_once()

    @patch.object(UnBitAgent, '_call')
    def test_evaluate_with_mock_llm(self, mock_call):
        mock_call.return_value = '{"ALPHA": 6000, "BETA": 4000}'
        proposals = [
            {"symbol": "ALPHA", "curve_type": 0, "buy_fee": 100, "sell_fee": 100},
            {"symbol": "BETA", "curve_type": 1, "buy_fee": 50, "sell_fee": 50},
        ]
        result = self.agent.evaluate_tokens(proposals, 10000)
        self.assertEqual(result["ALPHA"], 6000)
        self.assertEqual(result["BETA"], 4000)

    @patch.object(UnBitAgent, '_call')
    def test_propose_with_survivors_context(self, mock_call):
        mock_call.return_value = '{"name":"Evolved","symbol":"EVO2","curve_type":0,"curve_param":"1500000000000000","buy_fee":30,"sell_fee":60}'
        survivors = [
            {"symbol": "WIN", "curve_type": 0, "buy_fee": 50},
            {"symbol": "TOP", "curve_type": 3, "buy_fee": 0},
        ]
        result = self.agent.propose_token(survivors=survivors, generation=3)
        self.assertEqual(result["name"], "Evolved")
        # Verify the prompt included survivor info
        call_args = mock_call.call_args[0][0]
        self.assertIn("WIN", call_args)
        self.assertIn("TOP", call_args)


if __name__ == "__main__":
    unittest.main()
