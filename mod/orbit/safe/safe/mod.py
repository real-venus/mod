"""Safe Module - Interface with Safe (Gnosis Safe) contracts on Base network."""

import requests
from typing import Dict, List, Optional, Any
from web3 import Web3
from eth_account import Account
import json


class SafeMod:
    """Interface with Safe contracts on Base network through mod.py architecture."""
    
    description = "Safe (Gnosis Safe) contract interface for Base network - multi-sig wallet operations"
    
    # Base network configuration
    BASE_RPC_URL = "https://mainnet.base.org"
    BASE_CHAIN_ID = 8453
    
    # Safe contract addresses on Base
    SAFE_PROXY_FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67"
    SAFE_SINGLETON = "0x41675C099F32341bf84BFc5382aF534df5C7461a"
    SAFE_FALLBACK_HANDLER = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99"
    SAFE_MULTI_SEND = "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526"
    SAFE_MULTI_SEND_CALL_ONLY = "0x9641d764fc13c8B624c04430C7356C1C7C8102e2"
    
    # Safe Transaction Service API
    SAFE_TRANSACTION_SERVICE = "https://safe-transaction-base.safe.global"
    
    def __init__(self, rpc_url: Optional[str] = None, private_key: Optional[str] = None):
        """Initialize Safe module with Web3 connection.
        
        Args:
            rpc_url: Custom RPC URL (defaults to Base mainnet)
            private_key: Private key for signing transactions
        """
        self.rpc_url = rpc_url or self.BASE_RPC_URL
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.chain_id = self.BASE_CHAIN_ID
        
        if private_key:
            self.account = Account.from_key(private_key)
        else:
            self.account = None
            
    def get_safe_info(self, safe_address: str) -> Dict[str, Any]:
        """Get Safe wallet information from Transaction Service.
        
        Args:
            safe_address: Address of the Safe wallet
            
        Returns:
            Dictionary containing Safe info (owners, threshold, nonce, etc.)
        """
        try:
            url = f"{self.SAFE_TRANSACTION_SERVICE}/api/v1/safes/{safe_address}/"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def get_safe_balance(self, safe_address: str) -> Dict[str, Any]:
        """Get ETH and token balances for a Safe wallet.
        
        Args:
            safe_address: Address of the Safe wallet
            
        Returns:
            Dictionary with balance information
        """
        try:
            # Get ETH balance
            eth_balance = self.w3.eth.get_balance(safe_address)
            eth_balance_ether = self.w3.from_wei(eth_balance, 'ether')
            
            # Get token balances from Safe service
            url = f"{self.SAFE_TRANSACTION_SERVICE}/api/v1/safes/{safe_address}/balances/"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            token_balances = response.json()
            
            return {
                "eth_balance": str(eth_balance_ether),
                "eth_balance_wei": str(eth_balance),
                "tokens": token_balances
            }
        except Exception as e:
            return {"error": str(e)}
    
    def get_pending_transactions(self, safe_address: str) -> List[Dict[str, Any]]:
        """Get pending transactions for a Safe wallet.
        
        Args:
            safe_address: Address of the Safe wallet
            
        Returns:
            List of pending transactions
        """
        try:
            url = f"{self.SAFE_TRANSACTION_SERVICE}/api/v1/safes/{safe_address}/multisig-transactions/"
            params = {"executed": "false"}
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json().get('results', [])
        except Exception as e:
            return [{"error": str(e)}]
    
    def get_transaction_history(self, safe_address: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get transaction history for a Safe wallet.
        
        Args:
            safe_address: Address of the Safe wallet
            limit: Number of transactions to retrieve
            
        Returns:
            List of historical transactions
        """
        try:
            url = f"{self.SAFE_TRANSACTION_SERVICE}/api/v1/safes/{safe_address}/all-transactions/"
            params = {"limit": limit}
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json().get('results', [])
        except Exception as e:
            return [{"error": str(e)}]
    
    def propose_transaction(self, safe_address: str, to: str, value: int, data: str = "0x", 
                          operation: int = 0, safe_tx_gas: int = 0, base_gas: int = 0,
                          gas_price: int = 0, gas_token: str = "0x0000000000000000000000000000000000000000",
                          refund_receiver: str = "0x0000000000000000000000000000000000000000") -> Dict[str, Any]:
        """Propose a new transaction to a Safe wallet.
        
        Args:
            safe_address: Address of the Safe wallet
            to: Destination address
            value: Amount in wei
            data: Transaction data (hex string)
            operation: 0 for CALL, 1 for DELEGATECALL
            safe_tx_gas: Gas for Safe transaction
            base_gas: Base gas costs
            gas_price: Gas price
            gas_token: Token address for gas payment
            refund_receiver: Address to receive gas refund
            
        Returns:
            Transaction proposal response
        """
        if not self.account:
            return {"error": "No private key configured for signing"}
        
        try:
            # Get Safe info for nonce
            safe_info = self.get_safe_info(safe_address)
            if "error" in safe_info:
                return safe_info
            
            nonce = safe_info.get('nonce', 0)
            
            # Build transaction hash
            tx_hash_data = self.w3.keccak(text=f"{safe_address}{to}{value}{data}{operation}{safe_tx_gas}{base_gas}{gas_price}{gas_token}{refund_receiver}{nonce}")
            
            # Sign transaction
            signature = self.account.sign_message(tx_hash_data)
            
            # Prepare API request
            url = f"{self.SAFE_TRANSACTION_SERVICE}/api/v1/safes/{safe_address}/multisig-transactions/"
            payload = {
                "to": to,
                "value": str(value),
                "data": data,
                "operation": operation,
                "safeTxGas": str(safe_tx_gas),
                "baseGas": str(base_gas),
                "gasPrice": str(gas_price),
                "gasToken": gas_token,
                "refundReceiver": refund_receiver,
                "nonce": nonce,
                "signature": signature.signature.hex()
            }
            
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def get_owners(self, safe_address: str) -> List[str]:
        """Get list of owners for a Safe wallet.
        
        Args:
            safe_address: Address of the Safe wallet
            
        Returns:
            List of owner addresses
        """
        safe_info = self.get_safe_info(safe_address)
        if "error" in safe_info:
            return []
        return safe_info.get('owners', [])
    
    def get_threshold(self, safe_address: str) -> int:
        """Get signature threshold for a Safe wallet.
        
        Args:
            safe_address: Address of the Safe wallet
            
        Returns:
            Number of required signatures
        """
        safe_info = self.get_safe_info(safe_address)
        if "error" in safe_info:
            return 0
        return safe_info.get('threshold', 0)
    
    def estimate_safe_creation_gas(self) -> Dict[str, Any]:
        """Estimate gas cost for creating a new Safe wallet.
        
        Returns:
            Gas estimation details
        """
        try:
            # Typical Safe creation costs ~300k gas
            estimated_gas = 300000
            gas_price = self.w3.eth.gas_price
            estimated_cost_wei = estimated_gas * gas_price
            estimated_cost_eth = self.w3.from_wei(estimated_cost_wei, 'ether')
            
            return {
                "estimated_gas": estimated_gas,
                "gas_price_wei": str(gas_price),
                "gas_price_gwei": str(self.w3.from_wei(gas_price, 'gwei')),
                "estimated_cost_wei": str(estimated_cost_wei),
                "estimated_cost_eth": str(estimated_cost_eth)
            }
        except Exception as e:
            return {"error": str(e)}
    
    def get_module_transactions(self, safe_address: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get module transactions for a Safe wallet.
        
        Args:
            safe_address: Address of the Safe wallet
            limit: Number of transactions to retrieve
            
        Returns:
            List of module transactions
        """
        try:
            url = f"{self.SAFE_TRANSACTION_SERVICE}/api/v1/safes/{safe_address}/module-transactions/"
            params = {"limit": limit}
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json().get('results', [])
        except Exception as e:
            return [{"error": str(e)}]
    
    def check_safe_exists(self, safe_address: str) -> bool:
        """Check if a Safe wallet exists at the given address.
        
        Args:
            safe_address: Address to check
            
        Returns:
            True if Safe exists, False otherwise
        """
        try:
            code = self.w3.eth.get_code(safe_address)
            return len(code) > 0
        except Exception:
            return False
