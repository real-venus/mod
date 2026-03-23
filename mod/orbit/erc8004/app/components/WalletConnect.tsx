'use client';

import { useState, useEffect } from 'react';
import { connectWallet, getEthereumProvider } from '@/lib/ethereum';
import { Wallet, LogOut } from 'lucide-react';

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnection();

    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());
    }

    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const checkConnection = async () => {
    const provider = getEthereumProvider();
    if (provider) {
      try {
        const accounts = await provider.send('eth_accounts', []);
        if (accounts.length > 0) {
          setAddress(accounts[0]);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length > 0) {
      setAddress(accounts[0]);
    } else {
      setAddress(null);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const addr = await connectWallet();
      setAddress(addr);
    } catch (error: any) {
      console.error('Connection error:', error);
      alert(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <div className="px-4 py-2 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-medium text-primary-900 dark:text-primary-100">
            {formatAddress(address)}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="Disconnect"
        >
          <LogOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      <Wallet className="w-4 h-4" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
