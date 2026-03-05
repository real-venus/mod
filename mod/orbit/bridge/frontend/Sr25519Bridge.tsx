"use client";

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp';
import { stringToHex } from '@polkadot/util';

/**
 * Sr25519 to ERC20 Bridge Component
 *
 * Connects Subwallet (sr25519) and MetaMask (EVM) to bridge tokens
 *
 * Flow:
 * 1. User connects Subwallet (Substrate)
 * 2. User connects MetaMask (Base/EVM)
 * 3. User signs timestamp with sr25519 key
 * 4. Frontend submits claim to backend
 * 5. Backend verifies and queues for processing
 * 6. Operator processes claims on-chain
 */

interface BridgeStats {
  pendingClaims: number;
  totalClaimed: string;
  accountsInSnapshot: number;
}

interface ClaimableBalance {
  address: string;
  balance: string;
  claimed: boolean;
  claimable: string;
}

export default function Sr25519Bridge() {
  // Substrate wallet state
  const [substrateAccounts, setSubstrateAccounts] = useState<any[]>([]);
  const [selectedSubstrate, setSelectedSubstrate] = useState<string>('');

  // EVM wallet state
  const [evmAddress, setEvmAddress] = useState<string>('');
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  // Balance and claim state
  const [balance, setBalance] = useState<ClaimableBalance | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [stats, setStats] = useState<BridgeStats | null>(null);

  // Status messages
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const API_URL = process.env.NEXT_PUBLIC_BRIDGE_API || 'http://localhost:8000';

  /**
   * Connect to Subwallet
   */
  const connectSubstrate = async () => {
    try {
      setError('');

      // Enable Polkadot extension
      const extensions = await web3Enable('Sr25519 Bridge');

      if (extensions.length === 0) {
        setError('Please install Subwallet or Polkadot.js extension');
        return;
      }

      // Get accounts
      const accounts = await web3Accounts();

      if (accounts.length === 0) {
        setError('No accounts found in Subwallet');
        return;
      }

      setSubstrateAccounts(accounts);
      setSelectedSubstrate(accounts[0].address);
      setStatus('Subwallet connected');

      // Fetch balance for first account
      await fetchBalance(accounts[0].address);

    } catch (err: any) {
      setError(`Failed to connect Subwallet: ${err.message}`);
    }
  };

  /**
   * Connect to MetaMask
   */
  const connectMetaMask = async () => {
    try {
      setError('');

      if (!window.ethereum) {
        setError('Please install MetaMask');
        return;
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);

      setProvider(browserProvider);
      setEvmAddress(accounts[0]);
      setStatus('MetaMask connected');

      // Check we're on Base
      const network = await browserProvider.getNetwork();
      if (network.chainId !== BigInt(8453) && network.chainId !== BigInt(84532)) {
        setError('Please switch to Base network in MetaMask');
      }

    } catch (err: any) {
      setError(`Failed to connect MetaMask: ${err.message}`);
    }
  };

  /**
   * Fetch claimable balance for sr25519 address
   */
  const fetchBalance = async (address: string) => {
    try {
      const response = await fetch(`${API_URL}/balance/${address}`);
      const data = await response.json();
      setBalance(data);
    } catch (err: any) {
      console.error('Failed to fetch balance:', err);
    }
  };

  /**
   * Fetch bridge statistics
   */
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/stats`);
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    }
  };

  /**
   * Submit claim
   *
   * 1. Sign timestamp with sr25519 key
   * 2. Submit signature + addresses to backend
   * 3. Backend verifies and queues for processing
   */
  const submitClaim = async () => {
    if (!selectedSubstrate || !evmAddress) {
      setError('Please connect both wallets');
      return;
    }

    if (!balance || balance.claimed) {
      setError('No claimable balance or already claimed');
      return;
    }

    try {
      setClaiming(true);
      setError('');
      setStatus('Preparing claim...');

      // Get current timestamp
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `bridge_claim:${timestamp}`;

      setStatus('Please sign message in Subwallet...');

      // Get injector for signing
      const injector = await web3FromAddress(selectedSubstrate);

      // Sign message with sr25519 key
      const signRaw = injector?.signer?.signRaw;

      if (!signRaw) {
        throw new Error('Signer not available');
      }

      const { signature } = await signRaw({
        address: selectedSubstrate,
        data: stringToHex(message),
        type: 'bytes'
      });

      setStatus('Submitting claim...');

      // Submit to backend
      const response = await fetch(`${API_URL}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sr25519_address: selectedSubstrate,
          evm_address: evmAddress,
          timestamp,
          signature,
          amount: 0  // Backend will use snapshot balance
        })
      });

      const result = await response.json();

      if (response.ok) {
        setStatus(`✓ Claim submitted! Amount: ${result.amount}. Pending operator processing.`);

        // Refresh balance
        await fetchBalance(selectedSubstrate);
      } else {
        setError(result.detail || 'Claim submission failed');
      }

    } catch (err: any) {
      setError(`Claim failed: ${err.message}`);
      setStatus('');
    } finally {
      setClaiming(false);
    }
  };

  /**
   * Handle substrate account change
   */
  const handleSubstrateChange = async (address: string) => {
    setSelectedSubstrate(address);
    await fetchBalance(address);
  };

  /**
   * Format balance with decimals
   */
  const formatBalance = (balance: string, decimals: number = 9): string => {
    const num = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const whole = num / divisor;
    const fraction = num % divisor;

    return `${whole}.${fraction.toString().padStart(decimals, '0').slice(0, 4)}`;
  };

  // Load stats on mount
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Sr25519 to ERC20 Bridge</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Claim your tokens from Substrate to Base
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Bridge Statistics</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">Pending Claims</div>
              <div className="text-lg font-bold">{stats.pendingClaims}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Total Claimed</div>
              <div className="text-lg font-bold">{formatBalance(stats.totalClaimed)}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Accounts</div>
              <div className="text-lg font-bold">{stats.accountsInSnapshot}</div>
            </div>
          </div>
        </div>
      )}

      {/* Substrate Wallet */}
      <div className="border dark:border-gray-700 rounded-lg p-4">
        <h3 className="font-semibold mb-3">1. Connect Substrate Wallet (Subwallet)</h3>

        {substrateAccounts.length === 0 ? (
          <button
            onClick={connectSubstrate}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
          >
            Connect Subwallet
          </button>
        ) : (
          <div className="space-y-2">
            <select
              value={selectedSubstrate}
              onChange={(e) => handleSubstrateChange(e.target.value)}
              className="w-full p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              {substrateAccounts.map((account) => (
                <option key={account.address} value={account.address}>
                  {account.meta.name || 'Account'} - {account.address.slice(0, 8)}...{account.address.slice(-8)}
                </option>
              ))}
            </select>

            {balance && (
              <div className="text-sm space-y-1">
                <div>Balance: {formatBalance(balance.balance)} tokens</div>
                <div>Status: {balance.claimed ? '✓ Already claimed' : '○ Available to claim'}</div>
                {!balance.claimed && (
                  <div className="font-semibold text-green-600 dark:text-green-400">
                    Claimable: {formatBalance(balance.claimable)} tokens
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EVM Wallet */}
      <div className="border dark:border-gray-700 rounded-lg p-4">
        <h3 className="font-semibold mb-3">2. Connect EVM Wallet (MetaMask)</h3>

        {!evmAddress ? (
          <button
            onClick={connectMetaMask}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded"
          >
            Connect MetaMask
          </button>
        ) : (
          <div className="text-sm">
            <div>Connected: {evmAddress}</div>
          </div>
        )}
      </div>

      {/* Claim Button */}
      <div className="border dark:border-gray-700 rounded-lg p-4">
        <h3 className="font-semibold mb-3">3. Submit Claim</h3>

        <button
          onClick={submitClaim}
          disabled={!selectedSubstrate || !evmAddress || claiming || (balance?.claimed ?? true)}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded font-semibold"
        >
          {claiming ? 'Processing...' : 'Claim Tokens'}
        </button>

        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          You will sign a message with your sr25519 key to prove ownership.
          Tokens will be distributed by the bridge operator.
        </p>
      </div>

      {/* Status Messages */}
      {status && (
        <div className="bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded p-3 text-sm">
          {status}
        </div>
      )}

      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded p-3 text-sm">
          {error}
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p>• Ensure Subwallet/Polkadot.js extension is installed</p>
        <p>• Ensure MetaMask is connected to Base network</p>
        <p>• Each sr25519 address can claim only once</p>
        <p>• Claims are processed in batches by the bridge operator</p>
      </div>
    </div>
  );
}
