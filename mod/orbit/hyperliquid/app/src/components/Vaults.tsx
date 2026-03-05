'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Briefcase, TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react';
import { toast } from 'react-toastify';

interface VaultData {
  address: string;
  name: string;
  apy?: number;
  tvl?: number;
  pnl?: number;
  followers?: number;
  [key: string]: any;
}

export default function Vaults() {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [selectedVault, setSelectedVault] = useState<VaultData | null>(null);
  const [vaultDetails, setVaultDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'pnl' | 'apy' | 'tvl'>('pnl');

  useEffect(() => {
    fetchVaults();
  }, [sortBy]);

  const fetchVaults = async () => {
    setLoading(true);
    try {
      const data = await api.getTopVaults(sortBy, 20);
      setVaults(data || []);
    } catch (error) {
      console.error('Error fetching vaults:', error);
      toast.error('Failed to load vaults');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVault = async (vault: VaultData) => {
    setSelectedVault(vault);
    try {
      const details = await api.analyzeVault(vault.address);
      setVaultDetails(details);
    } catch (error) {
      console.error('Error fetching vault details:', error);
      toast.error('Failed to load vault details');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-2xl font-bold text-white mb-6">Vaults</h2>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Vaults List */}
      <div className="lg:col-span-2">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Briefcase className="w-6 h-6 text-blue-500" />
              <span>Top Vaults</span>
            </h2>

            <div className="flex space-x-2">
              {[
                { value: 'pnl' as const, label: 'PnL' },
                { value: 'apy' as const, label: 'APY' },
                { value: 'tvl' as const, label: 'TVL' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    sortBy === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {vaults.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No vaults found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vaults.map((vault, idx) => (
                <div
                  key={vault.address || idx}
                  onClick={() => handleSelectVault(vault)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedVault?.address === vault.address
                      ? 'bg-blue-900/20 border-blue-600'
                      : 'bg-gray-800 border-gray-700 hover:border-blue-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-white font-semibold">
                        {vault.name || vault.address?.slice(0, 8) + '...' + vault.address?.slice(-6)}
                      </h3>
                      <p className="text-xs text-gray-400">{vault.address}</p>
                    </div>
                    <div className="text-right">
                      {vault.pnl !== undefined && (
                        <div className={`flex items-center justify-end space-x-1 ${
                          vault.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {vault.pnl >= 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span className="font-semibold">
                            ${Math.abs(vault.pnl).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-3">
                    {vault.apy !== undefined && (
                      <div>
                        <div className="text-xs text-gray-500">APY</div>
                        <div className="text-white font-medium">{vault.apy.toFixed(2)}%</div>
                      </div>
                    )}
                    {vault.tvl !== undefined && (
                      <div>
                        <div className="text-xs text-gray-500">TVL</div>
                        <div className="text-white font-medium">${vault.tvl.toLocaleString()}</div>
                      </div>
                    )}
                    {vault.followers !== undefined && (
                      <div>
                        <div className="text-xs text-gray-500">Followers</div>
                        <div className="text-white font-medium">{vault.followers}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vault Details */}
      <div>
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 sticky top-6">
          {selectedVault ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {selectedVault.name || 'Vault Details'}
                </h3>
                <p className="text-xs text-gray-400 break-all">{selectedVault.address}</p>
              </div>

              {vaultDetails ? (
                <div className="space-y-4">
                  {/* Stats */}
                  {vaultDetails.details && (
                    <div className="space-y-3">
                      {vaultDetails.details.apy !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">APY</span>
                          <span className="text-white font-semibold">
                            {vaultDetails.details.apy.toFixed(2)}%
                          </span>
                        </div>
                      )}
                      {vaultDetails.details.tvl !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Total Value Locked</span>
                          <span className="text-white font-semibold">
                            ${vaultDetails.details.tvl.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {vaultDetails.details.pnl !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Total PnL</span>
                          <span className={`font-semibold ${
                            vaultDetails.details.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            ${vaultDetails.details.pnl.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={() => toast.info('Deposit feature coming soon')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all"
                  >
                    Deposit to Vault
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Select a vault to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
