"""Pytest tests for Bridge module."""

import pytest
import os
import json
from unittest.mock import Mock, MagicMock, patch, PropertyMock
from web3 import Web3
from eth_account import Account
import sys

# Add bridge module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bridge'))


@pytest.fixture
def mock_mod():
    """Mock the mod framework."""
    with patch('bridge.mod.m') as mock_m:
        # Mock common mod functions
        mock_m.print = Mock()
        mock_m.dp = Mock(return_value='/mock/bridge/path')
        mock_m.get_json = Mock(return_value={})
        mock_m.put_json = Mock()
        mock_m.save_json = Mock()
        mock_m.key = Mock(return_value=Mock(private_key='0x' + '1' * 64))

        # Mock mod() function for loading modules
        mock_store = Mock()
        mock_store.get = Mock(return_value={})
        mock_store.put = Mock(return_value=True)

        mock_auth = Mock()
        mock_auth.verify = Mock(return_value={'key': 'test_sr25519_address'})
        mock_auth.token = Mock(return_value='mock_token')

        def mod_loader(name):
            if name == 'store':
                return lambda path: mock_store
            elif name == 'auth':
                return lambda crypto_type: mock_auth
            elif name == 'ipfs':
                return lambda: Mock(
                    get=Mock(return_value={'abi': []}),
                    put=Mock(return_value='QmTest123')
                )
            return Mock()

        mock_m.mod = mod_loader
        mock_m.files = Mock(return_value=[])

        yield mock_m


@pytest.fixture
def mock_web3():
    """Mock Web3 instance."""
    mock_w3 = Mock()
    mock_w3.eth.chain_id = 84532
    mock_w3.eth.get_transaction_count = Mock(return_value=0)
    mock_w3.eth.wait_for_transaction_receipt = Mock(return_value={'status': 1})
    mock_w3.eth.send_raw_transaction = Mock(return_value=b'0x' + b'1' * 32)
    mock_w3.eth.gas_price = 1000000000  # 1 gwei
    mock_w3.eth.estimate_gas = Mock(return_value=100000)

    # Mock account
    mock_account = Mock()
    mock_account.address = '0x' + '1' * 40
    mock_account.key = '0x' + '2' * 64
    mock_w3.eth.account.from_key = Mock(return_value=mock_account)
    mock_w3.eth.account.sign_transaction = Mock()

    # Mock contract
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

            # Patch the config loading
            mock_config = {
                'testnet': {
                    'contracts': {
                        'bridge': {
                            'address': '0x' + '3' * 40,
                            'abi': 'QmBridgeABI'
                        },
                        'token': {
                            'address': '0x' + '4' * 40,
                            'abi': 'QmTokenABI'
                        }
                    }
                }
            }

            with patch.object(Bridge, 'set_config', return_value=mock_config):
                with patch.object(Bridge, 'load_contracts', return_value={}):
                    bridge = Bridge(network='testnet', key='test', auth='auth')
                    bridge.w3 = mock_web3

                    # Setup mock contracts
                    bridge.contracts = {
                        'bridge': Mock(),
                        'token': Mock()
                    }

                    # Setup mock balances
                    bridge.total_balances = {'test_address': 1000}
                    bridge.claims = {}

                    yield bridge


class TestBridgeInitialization:
    """Test Bridge initialization."""

    def test_init_with_testnet(self, mock_mod, mock_web3):
        """Test initialization with testnet."""
        with patch('bridge.mod.Web3') as MockWeb3Class:
            MockWeb3Class.return_value = mock_web3
            MockWeb3Class.HTTPProvider = Mock()

            with patch('bridge.mod.ABI') as MockABI:
                MockABI.return_value = Mock()

                from bridge.mod import Bridge

                with patch.object(Bridge, 'set_config'):
                    with patch.object(Bridge, 'load_contracts'):
                        bridge = Bridge(network='testnet')

                        assert bridge.network == 'testnet'
                        assert bridge.rpc_url == 'https://sepolia.base.org'
                        assert bridge.chain_id == 84532

    def test_init_with_custom_rpc(self, mock_mod, mock_web3):
        """Test initialization with custom RPC URL."""
        with patch('bridge.mod.Web3') as MockWeb3Class:
            MockWeb3Class.return_value = mock_web3
            MockWeb3Class.HTTPProvider = Mock()

            with patch('bridge.mod.ABI') as MockABI:
                MockABI.return_value = Mock()

                from bridge.mod import Bridge

                with patch.object(Bridge, 'set_config'):
                    with patch.object(Bridge, 'load_contracts'):
                        bridge = Bridge(network='http://localhost:8545')

                        assert bridge.rpc_url == 'http://localhost:8545'


class TestAddressHandling:
    """Test address handling functions."""

    def test_checksum_address(self, bridge_instance):
        """Test checksum address conversion."""
        address = '0xabcdef1234567890abcdef1234567890abcdef12'
        checksum = bridge_instance.checksum(address)

        assert checksum.startswith('0x')
        assert len(checksum) == 42

    def test_connect_wallet(self, bridge_instance, mock_web3):
        """Test wallet connection."""
        private_key = '0x' + '5' * 64
        address = bridge_instance.connect(private_key)

        assert address == mock_web3.eth.account.from_key(private_key).address


class TestBalanceManagement:
    """Test balance management functions."""

    def test_get_total_balances_empty(self, bridge_instance, mock_mod):
        """Test getting total balances when file doesn't exist."""
        mock_mod.get_json.return_value = {}

        with patch('os.path.exists', return_value=False):
            balances = bridge_instance.get_total_balances()

            assert isinstance(balances, dict)
            assert len(balances) == 0

    def test_get_total_balances_with_data(self, bridge_instance, mock_mod):
        """Test getting total balances with existing data."""
        expected = {'addr1': 100, 'addr2': 200}
        mock_mod.get_json.return_value = expected

        balances = bridge_instance.get_total_balances()

        assert balances == expected

    def test_save_total_balances(self, bridge_instance, mock_mod):
        """Test saving total balances."""
        bridge_instance.total_balances = {'addr1': 100}

        # Reset call count from initialization
        mock_mod.save_json.reset_mock()

        bridge_instance.save_total_balances()

        mock_mod.save_json.assert_called_once()


class TestClaimsManagement:
    """Test claims management functions."""

    def test_has_claimed_true(self, bridge_instance):
        """Test has_claimed when address has claimed."""
        bridge_instance.claims = {'test_addr': {'amount': 100}}

        assert bridge_instance.has_claimed('test_addr') is True

    def test_has_claimed_false(self, bridge_instance):
        """Test has_claimed when address hasn't claimed."""
        bridge_instance.claims = {}

        assert bridge_instance.has_claimed('test_addr') is False

    def test_unclaimed_full_balance(self, bridge_instance):
        """Test unclaimed when no claims made."""
        bridge_instance.total_balances = {'addr1': 1000}
        bridge_instance.claims = {}

        unclaimed = bridge_instance.unclaimed('addr1')

        assert unclaimed == 1000

    def test_unclaimed_partial_claim(self, bridge_instance):
        """Test unclaimed when partial claim made."""
        bridge_instance.total_balances = {'addr1': 1000}
        bridge_instance.claims = {'addr1': {'amount': 300}}

        unclaimed = bridge_instance.unclaimed('addr1')

        assert unclaimed == 700

    def test_reset_claims(self, bridge_instance):
        """Test resetting all claims."""
        bridge_instance.claims = {'addr1': {'amount': 100}}

        result = bridge_instance.reset_claims()

        assert bridge_instance.claims == {}

    def test_reset_single_claim(self, bridge_instance):
        """Test resetting a single claim."""
        bridge_instance.claims = {
            'addr1': {'amount': 100},
            'addr2': {'amount': 200}
        }

        bridge_instance.reset_claim('addr1')

        assert 'addr1' not in bridge_instance.claims
        assert 'addr2' in bridge_instance.claims

    def test_delete_claim_success(self, bridge_instance):
        """Test deleting an existing claim."""
        bridge_instance.claims = {'addr1': {'amount': 100}}

        result = bridge_instance.delete_claim('addr1')

        assert result['success'] is True
        assert 'addr1' not in bridge_instance.claims

    def test_delete_claim_not_found(self, bridge_instance):
        """Test deleting a non-existent claim."""
        bridge_instance.claims = {}

        result = bridge_instance.delete_claim('addr1')

        assert result['success'] is False


class TestTokenFunctions:
    """Test token-related functions."""

    def test_balance_default_address(self, bridge_instance):
        """Test getting balance for default address."""
        mock_token = bridge_instance.contracts['token']
        mock_token.functions.balanceOf.return_value.call.return_value = 1000000000000000000
        mock_token.functions.decimals.return_value.call.return_value = 18

        balance = bridge_instance.balance()

        assert balance == 1.0

    def test_balance_specific_address(self, bridge_instance):
        """Test getting balance for specific address."""
        mock_token = bridge_instance.contracts['token']
        mock_token.functions.balanceOf.return_value.call.return_value = 5000000000000000000
        mock_token.functions.decimals.return_value.call.return_value = 18

        balance = bridge_instance.balance('0x' + '5' * 40)

        assert balance == 5.0

    def test_decimals(self, bridge_instance):
        """Test getting token decimals."""
        mock_token = bridge_instance.contracts['token']
        mock_token.functions.decimals.return_value.call.return_value = 18

        decimals = bridge_instance.decimals()

        assert decimals == 18

    def test_decimals_no_contract(self, bridge_instance):
        """Test getting decimals when token contract not loaded."""
        bridge_instance.contracts = {}

        decimals = bridge_instance.decimals()

        assert decimals == 18

    def test_format_balance(self, bridge_instance):
        """Test formatting balance from wei."""
        mock_token = bridge_instance.contracts['token']
        mock_token.functions.decimals.return_value.call.return_value = 18

        formatted = bridge_instance.format_balance(1000000000000000000)

        assert formatted == 1.0


class TestBridgeFunctions:
    """Test bridge contract functions."""

    def test_process_claim_with_hash(self, bridge_instance, mock_web3):
        """Test processing claim with bytes32 hash."""
        mock_bridge = bridge_instance.contracts['bridge']

        def build_tx(params):
            return {
                'to': '0x' + '3' * 40,
                'data': '0x123',
                'from': bridge_instance.account.address,
                **params
            }

        mock_bridge.functions.processClaim.return_value.build_transaction = build_tx
        mock_web3.eth.estimate_gas.return_value = 100000

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        receipt = bridge_instance.process_claim(
            '0x' + '6' * 64,
            '0x' + '7' * 40,
            1000
        )

        assert receipt['status'] == 1

    def test_process_claim_with_address(self, bridge_instance, mock_web3):
        """Test processing claim with sr25519 address."""
        mock_bridge = bridge_instance.contracts['bridge']

        def build_tx(params):
            return {
                'to': '0x' + '3' * 40,
                'data': '0x123',
                'from': bridge_instance.account.address,
                **params
            }

        mock_bridge.functions.processClaim.return_value.build_transaction = build_tx
        mock_web3.eth.estimate_gas.return_value = 100000

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        receipt = bridge_instance.process_claim(
            'sr25519_address_string',
            '0x' + '7' * 40,
            1000
        )

        assert receipt['status'] == 1

    def test_batch_process_claims(self, bridge_instance, mock_web3):
        """Test batch processing claims."""
        mock_bridge = bridge_instance.contracts['bridge']

        def build_tx(params):
            return {
                'to': '0x' + '3' * 40,
                'data': '0x123',
                'from': bridge_instance.account.address,
                **params
            }

        mock_bridge.functions.batchProcessClaims.return_value.build_transaction = build_tx
        mock_web3.eth.estimate_gas.return_value = 200000

        claims = [
            {'address': 'addr1', 'recipient': '0x' + '8' * 40, 'amount': 100},
            {'address': 'addr2', 'recipient': '0x' + '9' * 40, 'amount': 200}
        ]

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        receipt = bridge_instance.batch_process_claims(claims)

        assert receipt['status'] == 1

    def test_claim_recipient(self, bridge_instance):
        """Test getting claim recipient."""
        mock_bridge = bridge_instance.contracts['bridge']
        mock_bridge.functions.claimRecipient.return_value.call.return_value = '0x' + 'a' * 40

        recipient = bridge_instance.claim_recipient('sr25519_address')

        assert recipient == '0x' + 'a' * 40

    def test_total_claims(self, bridge_instance):
        """Test getting total claims amount."""
        mock_bridge = bridge_instance.contracts['bridge']
        mock_bridge.functions.totalclaims.return_value.call.return_value = 5000

        total = bridge_instance.total_claims()

        assert total == 5000


class TestMintBurnTransfer:
    """Test mint, burn, and transfer functions."""

    def test_mint(self, bridge_instance, mock_web3):
        """Test minting tokens."""
        mock_token = bridge_instance.contracts['token']

        def build_tx(params):
            return {
                'to': '0x' + '4' * 40,
                'data': '0x123',
                'from': bridge_instance.account.address,
                **params
            }

        mock_token.functions.mint.return_value.build_transaction = build_tx
        mock_token.functions.decimals.return_value.call.return_value = 18
        mock_web3.eth.estimate_gas.return_value = 80000

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        receipt = bridge_instance.mint('0x' + 'b' * 40, 100)

        assert receipt['status'] == 1

    def test_burn(self, bridge_instance, mock_web3):
        """Test burning tokens."""
        mock_token = bridge_instance.contracts['token']

        def build_tx(params):
            return {
                'to': '0x' + '4' * 40,
                'data': '0x123',
                'from': bridge_instance.account.address,
                **params
            }

        mock_token.functions.burnFrom.return_value.build_transaction = build_tx
        mock_token.functions.decimals.return_value.call.return_value = 18
        mock_web3.eth.estimate_gas.return_value = 70000

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        receipt = bridge_instance.burn('0x' + 'c' * 40, 50)

        assert receipt['status'] == 1

    def test_transfer(self, bridge_instance, mock_web3):
        """Test transferring tokens."""
        mock_token = bridge_instance.contracts['token']

        def build_tx(params):
            return {
                'to': '0x' + '4' * 40,
                'data': '0x123',
                'from': bridge_instance.account.address,
                **params
            }

        mock_token.functions.transfer.return_value.build_transaction = build_tx
        mock_web3.eth.estimate_gas.return_value = 65000

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        receipt = bridge_instance.transfer('0x' + 'd' * 40, 1000)

        assert receipt['status'] == 1


class TestAuthVerification:
    """Test authentication and verification."""

    def test_claim_with_valid_token(self, bridge_instance, mock_web3):
        """Test claiming with valid auth token."""
        bridge_instance.total_balances = {'test_sr25519_address': 1000}
        bridge_instance.auth.verify.return_value = {'key': 'test_sr25519_address'}

        mock_token = bridge_instance.contracts['token']

        def build_tx(params):
            return {
                'to': '0x' + '4' * 40,
                'data': '0x123',
                'from': bridge_instance.account.address,
                **params
            }

        mock_token.functions.mint.return_value.build_transaction = build_tx
        mock_token.functions.decimals.return_value.call.return_value = 18
        mock_token.functions.balanceOf.return_value.call.return_value = 1000000000000000000000
        mock_web3.eth.estimate_gas.return_value = 100000

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        result = bridge_instance.claim('auth_token', '0x' + 'e' * 40)

        assert result['amount'] == 1000
        assert 'test_sr25519_address' in bridge_instance.claims

    def test_claim_with_zero_balance(self, bridge_instance):
        """Test claiming with zero balance."""
        bridge_instance.total_balances = {}
        bridge_instance.auth.verify.return_value = {'key': 'test_sr25519_address'}

        result = bridge_instance.claim('auth_token', '0x' + 'e' * 40)

        assert 'No tokens to claim' in result

    def test_clear_claims(self, bridge_instance):
        """Test clearing all claims."""
        bridge_instance.claims = {'addr1': {'amount': 100}}

        result = bridge_instance.clear_claims()

        assert result['success'] is True
        assert len(bridge_instance.claims) == 0


class TestUtilityFunctions:
    """Test utility functions."""

    def test_send_tx(self, bridge_instance, mock_web3):
        """Test sending generic transaction."""
        mock_contract = bridge_instance.contracts['token']
        mock_function = Mock()

        def build_tx(params):
            return {
                'to': '0x' + '4' * 40,
                'data': '0x123',
                'from': bridge_instance.account.address,
                **params
            }

        mock_function.return_value.build_transaction = build_tx
        mock_contract.functions.someFunction = mock_function
        mock_web3.eth.estimate_gas.return_value = 90000

        mock_signed = Mock()
        mock_signed.raw_transaction = b'0xsigned'
        mock_web3.eth.account.sign_transaction.return_value = mock_signed

        receipt = bridge_instance.send_tx('token', 'someFunction', [])

        assert receipt['status'] == 1

    def test_compile(self, bridge_instance):
        """Test compiling contracts."""
        with patch('os.system') as mock_system:
            mock_system.return_value = 0

            result = bridge_instance.compile()

            assert result == 0
            mock_system.assert_called_once()


class TestContractLoading:
    """Test contract loading functions."""

    def test_load_contracts_success(self, bridge_instance, mock_web3):
        """Test successful contract loading."""
        bridge_instance.config = {
            'testnet': {
                'contracts': {
                    'bridge': {
                        'address': '0x' + '3' * 40,
                        'abi': 'QmBridgeABI'
                    },
                    'token': {
                        'address': '0x' + '4' * 40,
                        'abi': 'QmTokenABI'
                    }
                }
            }
        }

        mock_ipfs = Mock()
        mock_ipfs.get.return_value = {'abi': []}
        bridge_instance._ipfs = mock_ipfs

        contracts = bridge_instance.load_contracts()

        assert isinstance(contracts, dict)

    def test_load_contracts_error(self, bridge_instance, mock_mod):
        """Test contract loading with error."""
        bridge_instance.config = {}

        # Create a mock IPFS object that raises an exception
        mock_ipfs = Mock()
        mock_ipfs.get.side_effect = Exception('IPFS error')
        bridge_instance._ipfs = mock_ipfs

        contracts = bridge_instance.load_contracts()

        # Should handle error gracefully
        assert isinstance(contracts, dict)


class TestIPFSIntegration:
    """Test IPFS integration."""

    def test_ipfs_property(self, bridge_instance, mock_mod):
        """Test IPFS property lazy loading."""
        ipfs = bridge_instance.ipfs

        assert ipfs is not None
        # Second call should return cached instance
        ipfs2 = bridge_instance.ipfs
        assert ipfs is ipfs2

    def test_abi_map(self, bridge_instance, mock_mod):
        """Test ABI mapping."""
        with patch('os.path.join', return_value='/mock/path'):
            with patch.object(mock_mod, 'files', return_value=['Contract.json']):
                with patch('builtins.open', create=True) as mock_open:
                    mock_open.return_value.__enter__.return_value.read.return_value = '{"abi": []}'

                    with patch('json.load', return_value={'abi': []}):
                        abi_map = bridge_instance.abi_map()

                        assert isinstance(abi_map, dict)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
