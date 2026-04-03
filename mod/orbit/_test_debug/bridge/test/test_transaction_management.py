"""Pytest tests for transaction management (nonce, gas, retries)."""

import pytest
import time
from unittest.mock import Mock, MagicMock, patch, call
from web3 import Web3
import sys
import os

# Add bridge module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bridge'))


@pytest.fixture
def mock_mod():
    """Mock the mod framework."""
    with patch('bridge.mod.m') as mock_m:
        mock_m.print = Mock()
        mock_m.dp = Mock(return_value='/mock/bridge/path')
        mock_m.get_json = Mock(return_value={})
        mock_m.put_json = Mock()
        mock_m.save_json = Mock()
        mock_m.key = Mock(return_value=Mock(private_key='0x' + '1' * 64))

        mock_store = Mock()
        mock_store.get = Mock(return_value={})
        mock_store.put = Mock(return_value=True)

        mock_auth = Mock()
        mock_auth.verify = Mock(return_value={'key': 'test_address'})

        def mod_loader(name):
            if name == 'store':
                return lambda path: mock_store
            elif name == 'auth':
                return lambda crypto_type: mock_auth
            elif name == 'ipfs':
                return lambda: Mock(get=Mock(return_value={'abi': []}))
            return Mock()

        mock_m.mod = mod_loader
        mock_m.files = Mock(return_value=[])

        yield mock_m


@pytest.fixture
def mock_web3():
    """Mock Web3 instance."""
    mock_w3 = Mock()
    mock_w3.eth.chain_id = 84532
    mock_w3.eth.get_transaction_count = Mock(return_value=5)
    mock_w3.eth.gas_price = 1000000000  # 1 gwei
    mock_w3.eth.wait_for_transaction_receipt = Mock(return_value={'status': 1})
    mock_w3.eth.send_raw_transaction = Mock(return_value=b'0x' + b'1' * 32)
    mock_w3.eth.estimate_gas = Mock(return_value=100000)

    mock_account = Mock()
    mock_account.address = '0x' + '1' * 40
    mock_account.key = '0x' + '2' * 64
    mock_w3.eth.account.from_key = Mock(return_value=mock_account)
    mock_w3.eth.account.sign_transaction = Mock()

    mock_contract = Mock()
    mock_w3.eth.contract = Mock(return_value=mock_contract)

    return mock_w3


@pytest.fixture
def bridge_instance(mock_mod, mock_web3):
    """Create a Bridge instance with mocked dependencies."""
    with patch('bridge.mod.Web3') as MockWeb3Class:
        # Mock Web3 class methods
        MockWeb3Class.to_checksum_address = Web3.to_checksum_address
        MockWeb3Class.solidity_keccak = Web3.solidity_keccak
        MockWeb3Class.HTTPProvider = Mock()

        # Make Web3() constructor return our mock instance
        MockWeb3Class.return_value = mock_web3

        # Mock ABI class
        with patch('bridge.mod.ABI') as MockABI:
            mock_abi_instance = Mock()
            MockABI.return_value = mock_abi_instance

            from bridge.mod import Bridge

            mock_config = {
                'testnet': {
                    'contracts': {
                        'bridge': {'address': '0x' + '3' * 40, 'abi': 'QmBridgeABI'},
                        'token': {'address': '0x' + '4' * 40, 'abi': 'QmTokenABI'}
                    }
                }
            }

            with patch.object(Bridge, 'set_config', return_value=mock_config):
                with patch.object(Bridge, 'load_contracts', return_value={}):
                    bridge = Bridge(network='testnet', key='test', auth='auth')
                    bridge.w3 = mock_web3
                    bridge.contracts = {'bridge': Mock(), 'token': Mock()}
                    bridge.total_balances = {}
                    bridge.claims = {}

                    yield bridge


class TestNonceManagement:
    """Test nonce handling."""

    def test_get_nonce_fresh(self, bridge_instance, mock_web3):
        """Test getting nonce for first transaction."""
        mock_web3.eth.get_transaction_count.return_value = 5

        nonce = bridge_instance.get_nonce()

        assert nonce == 5
        mock_web3.eth.get_transaction_count.assert_called_once()

    def test_get_nonce_cached(self, bridge_instance, mock_web3):
        """Test nonce increments from cache."""
        mock_web3.eth.get_transaction_count.return_value = 5

        nonce1 = bridge_instance.get_nonce()
        nonce2 = bridge_instance.get_nonce()

        assert nonce1 == 5
        assert nonce2 == 6

    def test_get_nonce_with_pending(self, bridge_instance, mock_web3):
        """Test getting nonce includes pending transactions."""
        nonce = bridge_instance.get_nonce(use_pending=True)

        mock_web3.eth.get_transaction_count.assert_called_with(
            bridge_instance.account.address,
            'pending'
        )

    def test_get_nonce_without_pending(self, bridge_instance, mock_web3):
        """Test getting nonce without pending transactions."""
        nonce = bridge_instance.get_nonce(use_pending=False)

        mock_web3.eth.get_transaction_count.assert_called_with(
            bridge_instance.account.address,
            'latest'
        )

    def test_reset_nonce(self, bridge_instance, mock_web3):
        """Test resetting nonce cache."""
        mock_web3.eth.get_transaction_count.return_value = 5

        # Get nonce twice to populate cache
        nonce1 = bridge_instance.get_nonce()
        nonce2 = bridge_instance.get_nonce()
        assert nonce2 == 6

        # Reset cache
        bridge_instance.reset_nonce()

        # Should fetch from chain again
        nonce3 = bridge_instance.get_nonce()
        assert nonce3 == 5

    def test_nonce_cache_per_address(self, bridge_instance, mock_web3):
        """Test nonce cache is maintained per address."""
        addr1 = '0x' + 'a' * 40
        addr2 = '0x' + 'b' * 40

        mock_web3.eth.get_transaction_count.return_value = 10

        nonce1_a = bridge_instance.get_nonce(addr1)
        nonce1_b = bridge_instance.get_nonce(addr1)

        nonce2_a = bridge_instance.get_nonce(addr2)
        nonce2_b = bridge_instance.get_nonce(addr2)

        assert nonce1_a == 10
        assert nonce1_b == 11
        assert nonce2_a == 10
        assert nonce2_b == 11


class TestGasManagement:
    """Test gas price and limit handling."""

    def test_get_gas_price_default(self, bridge_instance, mock_web3):
        """Test getting gas price with default multiplier."""
        mock_web3.eth.gas_price = 1000000000  # 1 gwei

        gas_price = bridge_instance.get_gas_price()

        expected = int(1000000000 * bridge_instance.GAS_PRICE_MULTIPLIER)
        assert gas_price == expected

    def test_get_gas_price_custom_multiplier(self, bridge_instance, mock_web3):
        """Test getting gas price with custom multiplier."""
        mock_web3.eth.gas_price = 1000000000

        gas_price = bridge_instance.get_gas_price(multiplier=1.5)

        assert gas_price == 1500000000

    def test_estimate_gas_success(self, bridge_instance, mock_web3):
        """Test gas estimation with buffer."""
        mock_web3.eth.estimate_gas.return_value = 100000

        tx_params = {'from': '0x123', 'to': '0x456', 'data': '0xabc'}
        gas_limit = bridge_instance.estimate_gas(tx_params)

        expected = int(100000 * bridge_instance.GAS_LIMIT_BUFFER)
        assert gas_limit == expected

    def test_estimate_gas_custom_buffer(self, bridge_instance, mock_web3):
        """Test gas estimation with custom buffer."""
        mock_web3.eth.estimate_gas.return_value = 100000

        tx_params = {'from': '0x123', 'to': '0x456', 'data': '0xabc'}
        gas_limit = bridge_instance.estimate_gas(tx_params, buffer=2.0)

        assert gas_limit == 200000

    def test_estimate_gas_failure_fallback(self, bridge_instance, mock_web3):
        """Test gas estimation falls back on error."""
        mock_web3.eth.estimate_gas.side_effect = Exception('Estimation failed')

        tx_params = {'from': '0x123', 'to': '0x456', 'data': '0xabc'}
        gas_limit = bridge_instance.estimate_gas(tx_params)

        assert gas_limit == 500000  # Default fallback


class TestTransactionBuilding:
    """Test transaction building."""

    def test_build_transaction_basic(self, bridge_instance, mock_web3):
        """Test building transaction with all parameters."""
        mock_function = Mock()

        # Mock build_transaction to return a copy and merge with params
        def build_tx(params):
            return {
                'to': '0x456',
                'data': '0xabc',
                'from': bridge_instance.account.address,
                **params  # Merge in the params passed by build_transaction
            }

        mock_function.build_transaction = build_tx

        mock_web3.eth.get_transaction_count.return_value = 10
        mock_web3.eth.gas_price = 2000000000
        mock_web3.eth.estimate_gas.return_value = 150000

        tx = bridge_instance.build_transaction(mock_function)

        assert tx['nonce'] == 10
        assert 'gasPrice' in tx
        assert 'gas' in tx

    def test_build_transaction_custom_gas_limit(self, bridge_instance, mock_web3):
        """Test building transaction with custom gas limit."""
        mock_function = Mock()
        mock_function.build_transaction.return_value = {
            'to': '0x456',
            'data': '0xabc',
            'from': bridge_instance.account.address
        }

        mock_web3.eth.get_transaction_count.return_value = 10

        tx = bridge_instance.build_transaction(mock_function, gas_limit=250000)

        assert tx['gas'] == 250000


class TestTransactionSending:
    """Test transaction sending with retry logic."""

    def test_send_transaction_success(self, bridge_instance, mock_web3):
        """Test successful transaction send."""
        tx = {
            'from': bridge_instance.account.address,
            'to': '0x456',
            'nonce': 5,
            'gasPrice': 1000000000,
            'gas': 100000
        }

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        receipt = bridge_instance.send_transaction(tx)

        assert receipt['status'] == 1
        mock_web3.eth.send_raw_transaction.assert_called_once_with(b'0xsigned')

    def test_send_transaction_retry_on_nonce_error(self, bridge_instance, mock_web3):
        """Test transaction retry on nonce error."""
        tx = {
            'from': bridge_instance.account.address,
            'to': '0x456',
            'nonce': 5,
            'gasPrice': 1000000000,
            'gas': 100000
        }

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        # First attempt fails with nonce error, second succeeds
        mock_web3.eth.send_raw_transaction.side_effect = [
            Exception('nonce too low'),
            b'0x' + b'1' * 32
        ]

        with patch('time.sleep'):  # Speed up test
            receipt = bridge_instance.send_transaction(tx)

        assert receipt['status'] == 1
        assert mock_web3.eth.send_raw_transaction.call_count == 2

    def test_send_transaction_retry_on_underpriced_error(self, bridge_instance, mock_web3):
        """Test transaction retry on underpriced error."""
        tx = {
            'from': bridge_instance.account.address,
            'to': '0x456',
            'nonce': 5,
            'gasPrice': 1000000000,
            'gas': 100000
        }

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        # First attempt fails with underpriced error
        mock_web3.eth.send_raw_transaction.side_effect = [
            Exception('replacement transaction underpriced'),
            b'0x' + b'1' * 32
        ]

        mock_web3.eth.get_transaction_count.return_value = 6

        with patch('time.sleep'):
            receipt = bridge_instance.send_transaction(tx)

        # Should have increased gas price
        assert tx['gasPrice'] > 1000000000
        assert receipt['status'] == 1

    def test_send_transaction_max_retries_exhausted(self, bridge_instance, mock_web3):
        """Test transaction fails after max retries."""
        tx = {
            'from': bridge_instance.account.address,
            'to': '0x456',
            'nonce': 5,
            'gasPrice': 1000000000,
            'gas': 100000
        }

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        # Always fail with nonce error
        mock_web3.eth.send_raw_transaction.side_effect = Exception('nonce too low')

        with patch('time.sleep'):
            with pytest.raises(Exception) as exc_info:
                bridge_instance.send_transaction(tx, max_retries=3)

        assert 'after 3 attempts' in str(exc_info.value)

    def test_send_transaction_non_recoverable_error(self, bridge_instance, mock_web3):
        """Test transaction fails immediately on non-recoverable error."""
        tx = {
            'from': bridge_instance.account.address,
            'to': '0x456',
            'nonce': 5,
            'gasPrice': 1000000000,
            'gas': 100000
        }

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        # Fail with non-recoverable error
        mock_web3.eth.send_raw_transaction.side_effect = Exception('insufficient funds')

        with pytest.raises(Exception) as exc_info:
            bridge_instance.send_transaction(tx)

        assert 'insufficient funds' in str(exc_info.value)
        # Should not retry
        assert mock_web3.eth.send_raw_transaction.call_count == 1

    def test_send_transaction_failed_receipt(self, bridge_instance, mock_web3):
        """Test transaction sent but receipt shows failure."""
        tx = {
            'from': bridge_instance.account.address,
            'to': '0x456',
            'nonce': 5,
            'gasPrice': 1000000000,
            'gas': 100000
        }

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        # Transaction sent but failed
        mock_web3.eth.wait_for_transaction_receipt.return_value = {'status': 0}

        with pytest.raises(Exception) as exc_info:
            bridge_instance.send_transaction(tx)

        assert 'Transaction failed' in str(exc_info.value)


class TestIntegrationWithContractMethods:
    """Test integration of transaction management with contract methods."""

    def test_process_claim_with_retry(self, bridge_instance, mock_web3):
        """Test process_claim uses retry logic."""
        mock_bridge = bridge_instance.contracts['bridge']

        # Setup mock function
        mock_function = Mock()
        mock_function.build_transaction.return_value = {
            'to': '0x456',
            'data': '0xabc',
            'from': bridge_instance.account.address
        }
        mock_bridge.functions.processClaim.return_value = mock_function

        # Setup mocks
        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed
        mock_web3.eth.get_transaction_count.return_value = 10
        mock_web3.eth.estimate_gas.return_value = 100000

        receipt = bridge_instance.process_claim('addr1', '0x' + '5' * 40, 1000)

        assert receipt['status'] == 1

    def test_mint_with_nonce_management(self, bridge_instance, mock_web3):
        """Test mint uses proper nonce management."""
        mock_token = bridge_instance.contracts['token']
        mock_token.functions.decimals.return_value.call.return_value = 18

        mock_function = Mock()
        mock_function.build_transaction.return_value = {
            'to': '0x456',
            'data': '0xabc',
            'from': bridge_instance.account.address
        }
        mock_token.functions.mint.return_value = mock_function

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed
        mock_web3.eth.get_transaction_count.return_value = 15
        mock_web3.eth.estimate_gas.return_value = 80000

        receipt = bridge_instance.mint('0x' + '6' * 40, 100)

        assert receipt['status'] == 1

    def test_multiple_transactions_sequential_nonces(self, bridge_instance, mock_web3):
        """Test multiple transactions get sequential nonces."""
        mock_token = bridge_instance.contracts['token']
        mock_token.functions.decimals.return_value.call.return_value = 18

        mock_function = Mock()
        mock_function.build_transaction.return_value = {
            'to': '0x456',
            'data': '0xabc',
            'from': bridge_instance.account.address
        }
        mock_token.functions.mint.return_value = mock_function

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed
        mock_web3.eth.get_transaction_count.return_value = 20
        mock_web3.eth.estimate_gas.return_value = 80000

        # Send 3 transactions
        bridge_instance.mint('0x' + '7' * 40, 10)
        bridge_instance.mint('0x' + '8' * 40, 20)
        bridge_instance.mint('0x' + '9' * 40, 30)

        # Check that nonces increased
        assert bridge_instance._last_nonce[bridge_instance.account.address] == 22


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
