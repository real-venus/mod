'use client'

import { useState } from 'react'
import { UserType } from '@/bloc/types'
import { useUserContext } from '@/bloc/context'
import { Users, X, Plus, Trash2 } from 'lucide-react'

interface AdminTabProps {
  userData: UserType
}

export function AdminTab({ userData }: AdminTabProps) {
  const { client, user } = useUserContext()
  const [whitelistedAccounts, setWhitelistedAccounts] = useState<string[]>(userData.whitelisted_accounts || [])
  const [newAccount, setNewAccount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleAddAccount = () => {
    if (newAccount.trim() && !whitelistedAccounts.includes(newAccount.trim())) {
      setWhitelistedAccounts([...whitelistedAccounts, newAccount.trim()])
      setNewAccount('')
    }
  }

  const handleRemoveAccount = (account: string) => {
    setWhitelistedAccounts(whitelistedAccounts.filter(a => a !== account))
  }

  const handleSaveWhitelist = async () => {
    if (!client) return
    
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await client.call('set_users', {
        users: whitelistedAccounts
      })
      setSuccess('Whitelist updated successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err?.message || 'Failed to update whitelist')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-purple-400" />
        <h2 className="text-3xl font-black text-purple-300 uppercase tracking-wider">
          Admin Panel
        </h2>
      </div>

      <div className="bg-black/60 border-2 border-purple-500/40 rounded-xl p-6 space-y-6">
        <div>
          <h3 className="text-xl font-bold text-purple-300 mb-4 uppercase tracking-wide">
            Whitelisted Accounts
          </h3>
          <p className="text-purple-400/80 text-sm mb-4">
            Add or remove accounts that are allowed to access restricted features.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newAccount}
            onChange={(e) => setNewAccount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
            placeholder="Enter account address..."
            disabled={loading}
            className="flex-1 bg-black/60 border-2 border-purple-500/40 rounded-lg px-4 py-3 text-purple-300 font-mono text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50 transition-all placeholder-purple-500/40"
          />
          <button
            onClick={handleAddAccount}
            disabled={!newAccount.trim() || loading}
            className="px-6 py-3 bg-purple-500/20 border-2 border-purple-500/50 rounded-lg text-purple-300 font-bold hover:bg-purple-500/30 disabled:opacity-50 transition-all flex items-center gap-2 uppercase"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {whitelistedAccounts.map((account, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-4 py-3 bg-black/60 border-2 border-purple-500/30 rounded-lg hover:border-purple-500/50 transition-all"
            >
              <code className="text-sm text-purple-300 font-mono break-all">{account}</code>
              <button
                onClick={() => handleRemoveAccount(account)}
                disabled={loading}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors ml-4 flex-shrink-0"
              >
                <Trash2 className="w-5 h-5 text-red-400" />
              </button>
            </div>
          ))}
          {whitelistedAccounts.length === 0 && (
            <div className="text-center py-8 text-purple-400/60">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-mono">No whitelisted accounts yet</p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border-2 border-red-500/40 rounded-lg">
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-500/10 border-2 border-green-500/40 rounded-lg">
            <p className="text-green-400 font-mono text-sm">{success}</p>
          </div>
        )}

        <button
          onClick={handleSaveWhitelist}
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/60 rounded-lg text-purple-300 font-bold uppercase tracking-wider hover:bg-purple-500/30 hover:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-lg"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>Save Whitelist</span>
          )}
        </button>
      </div>
    </div>
  )
}
