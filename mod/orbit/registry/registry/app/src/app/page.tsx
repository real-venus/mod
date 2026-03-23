'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Registry, ModEntry, getDefaultNetwork } from '@/network/registry';
import NetworkSelector from '@/components/NetworkSelector';
import WalletButton from '@/components/WalletButton';
import RegisterForm from '@/components/RegisterForm';
import ModCard from '@/components/ModCard';

export default function Home() {
  const [network, setNetwork] = useState<string>(getDefaultNetwork());
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [userMods, setUserMods] = useState<number[]>([]);
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [tab, setTab] = useState<'all' | 'mine'>('all');

  const registry = new Registry(network);

  const loadMods = useCallback(async () => {
    setLoading(true);
    try {
      const allMods = await registry.listAll();
      setMods(allMods);

      if (wallet) {
        const ids = await registry.getUserMods(wallet);
        setUserMods(ids);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load modules';
      console.error('Failed to load mods:', message);
    } finally {
      setLoading(false);
    }
  }, [network, wallet]);

  useEffect(() => {
    loadMods();
  }, [loadMods]);

  // Check for existing wallet connection
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setWallet(accounts[0]);
          }
        })
        .catch(() => {});
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      toast.error('No wallet detected. Please install MetaMask.');
      return;
    }
    try {
      const accounts: string[] = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      if (accounts.length > 0) {
        setWallet(accounts[0]);
        toast.success('Wallet connected');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      toast.error(message);
    }
  };

  const onRegister = async (name: string, data: string) => {
    try {
      const modId = await registry.registerMod(name, data);
      toast.success(`Module registered with ID ${modId}`);
      setShowRegister(false);
      await loadMods();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      toast.error(message);
    }
  };

  const onRemove = async (modId: number) => {
    try {
      await registry.removeMod(modId);
      toast.success(`Module #${modId} removed`);
      await loadMods();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Remove failed';
      toast.error(message);
    }
  };

  const onUpdate = async (modId: number, data: string) => {
    try {
      await registry.updateMod(modId, data);
      toast.success(`Module #${modId} updated`);
      await loadMods();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      toast.error(message);
    }
  };

  const displayMods =
    tab === 'mine' ? mods.filter((m) => userMods.includes(m.id)) : mods;

  const myModCount = wallet
    ? mods.filter((m) => userMods.includes(m.id)).length
    : 0;

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
          Registry
        </h1>

        <div className="flex items-center gap-3 flex-wrap">
          <NetworkSelector
            value={network}
            onChange={(key) => {
              setNetwork(key);
              setTab('all');
            }}
          />

          {wallet && (
            <button
              onClick={() => setShowRegister(!showRegister)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: showRegister ? 'var(--bg-surface)' : 'var(--accent)',
                color: showRegister ? 'var(--text-primary)' : '#000000',
                border: showRegister ? '1px solid var(--border)' : 'none',
              }}
            >
              {showRegister ? 'Cancel' : '+ Register'}
            </button>
          )}

          <WalletButton wallet={wallet} onConnect={connectWallet} />
        </div>
      </div>

      {/* Register Form */}
      {showRegister && (
        <div className="mb-8">
          <RegisterForm onSubmit={onRegister} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6">
        <button
          onClick={() => setTab('all')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: tab === 'all' ? 'var(--bg-surface)' : 'transparent',
            color: tab === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: tab === 'all' ? '1px solid var(--border)' : '1px solid transparent',
          }}
        >
          All Modules ({mods.length})
        </button>

        {wallet && (
          <button
            onClick={() => setTab('mine')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === 'mine' ? 'var(--bg-surface)' : 'transparent',
              color: tab === 'mine' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: tab === 'mine' ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            My Modules ({myModCount})
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="spinner" />
        </div>
      )}

      {/* Empty state */}
      {!loading && displayMods.length === 0 && (
        <div className="text-center py-20">
          <p style={{ color: 'var(--text-secondary)' }}>
            {tab === 'mine' ? 'You have no registered modules.' : 'No modules registered yet.'}
          </p>
          {!wallet && (
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Connect your wallet to register a module.
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      {!loading && displayMods.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayMods.map((mod) => (
            <ModCard
              key={mod.id}
              mod={mod}
              isOwner={
                wallet !== null &&
                mod.owner.toLowerCase() === wallet.toLowerCase()
              }
              onRemove={onRemove}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </main>
  );
}
