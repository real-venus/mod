'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'
import { Send, Zap, CheckCircle, AlertCircle, ArrowUpDown } from 'lucide-react'
import { CopyButton } from '@/mod/ui/CopyButton'
import { text2color } from '@/mod/utils'

interface TransferHistory {
  to: string
  amount: number
  timestamp: string
  hash?: string
}

export const Transfer: React.FC = () => {
  const { network, user } = userContext()
  const [toAddress, setToAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState('')
  const [balance, setBalance] = useState<string>('0')
  const [history, setHistory] = useState<TransferHistory[]>([])
  const [sortAsc, setSortAsc] = useState(false)

  const userColor = text2color(user?.key || 'default')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const address = user?.key || ''
    const mode = localStorage.getItem('wallet_mode')
    if (mode === 'subwallet' && address) {
      setWalletAddress(address)
    }
    // Load transfer history from localStorage
    const savedHistory = localStorage.getItem(`transfer_history_${address}`)
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [user])

  const executeTransfer = async () => {
    if (!toAddress || !amount) return setError('Please fill in all fields')
    if (!walletAddress) return setError('No wallet connected')

    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      const result = await network.transfer(
        walletAddress,
        toAddress,
        parseFloat(amount)
      )

      const newTransfer: TransferHistory = {
        to: toAddress,
        amount: parseFloat(amount),
        timestamp: new Date().toISOString(),
        hash: result?.hash || result?.blockHash
      }

      const updatedHistory = [newTransfer, ...history]
      setHistory(updatedHistory)
      localStorage.setItem(`transfer_history_${walletAddress}`, JSON.stringify(updatedHistory))

      setResponse({
        ...result,
        amount: parseFloat(amount),
        to: toAddress,
        from: walletAddress,
      })
      setToAddress('')
      setAmount('')
    } catch (err: any) {
      let msg = err?.message || String(err)
      if (msg.includes('1010')) 
        msg = 'Insufficient balance for fees.'
      else if (msg.toLowerCase().includes('cancel'))
        msg = 'Transaction cancelled by user.'
      else if (msg.includes('timeout'))
        msg = 'Transaction timeout. Please try again.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const sortedHistory = [...history].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime()
    const timeB = new Date(b.timestamp).getTime()
    return sortAsc ? timeA - timeB : timeB - timeA
  })

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="space-y-5 p-6 rounded-xl bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 border-2 border-green-500/30 shadow-2xl">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-green-400 font-mono uppercase font-bold tracking-wide">
              Destination Address
            </label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              disabled={isLoading}
              placeholder="5GrwvaEF5zXb26..."
              className="w-full bg-black/60 border-2 border-green-500/40 rounded-lg px-4 py-3 text-green-300 font-mono text-base placeholder-green-600/50 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/30 disabled:opacity-50 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-green-400 font-mono uppercase font-bold tracking-wide">
              Amount (MOD)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isLoading}
              min="0"
              step="0.000000001"
              placeholder="0.0"
              className="w-full bg-black/60 border-2 border-green-500/40 rounded-lg px-4 py-3 text-green-300 font-mono text-base placeholder-green-600/50 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/30 disabled:opacity-50 transition-all"
            />
            <p className="text-xs text-green-500/50 mt-1 font-mono">
              Available: {balance} MOD
            </p>
          </div>

          <button
            onClick={executeTransfer}
            disabled={!toAddress || !amount || isLoading || !walletAddress}
            className="w-full py-4 border-2 border-green-500/60 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 hover:bg-green-500/30 hover:border-green-500 hover:scale-[1.02] transition-all duration-300 rounded-xl font-mono uppercase font-black text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 shadow-lg"
          >
            {isLoading ? (
              <>
                <Zap size={20} className="animate-spin" />
                <span>PROCESSING...</span>
              </>
            ) : (
              <>
                <Send size={20} />
                <span>SEND TRANSFER</span>
              </>
            )}
          </button>
        </div>
      </div>

      {(response || error) && (
        <div
          className={`space-y-4 p-6 rounded-xl border-2 shadow-2xl ${
            error
              ? 'from-red-500/10 border-red-500/40 bg-gradient-to-br'
              : 'from-emerald-500/10 border-emerald-500/40 bg-gradient-to-br'
          }`}
        >
          <div className="flex items-center gap-3 text-base font-mono uppercase font-bold">
            {error ? (
              <>
                <AlertCircle size={20} className="text-red-500" />
                <span className="text-red-500">ERROR</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} className="text-emerald-500" />
                <span className="text-emerald-500">SUCCESS</span>
              </>
            )}
          </div>

          {error ? (
            <div className="text-red-400 font-mono text-base bg-black/60 p-4 rounded-lg border-2 border-red-500/30 whitespace-pre-wrap font-bold">
              {error}
            </div>
          ) : (
            <pre className="text-emerald-400 font-mono text-sm overflow-x-auto bg-black/60 p-4 rounded-lg border-2 border-emerald-500/30">
{JSON.stringify(response, null, 2)}
            </pre>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border-2 font-mono" style={{ backgroundColor: `${userColor}15`, borderColor: userColor }}>
          <div className="flex items-center justify-between p-3 border-b-2" style={{ borderColor: userColor }}>
            <h3 className="text-xl font-black" style={{ color: userColor, letterSpacing: '0.02em' }}>Transfer History</h3>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="px-3 py-1.5 rounded-lg hover:opacity-80 transition-all flex items-center gap-2 text-xs font-semibold border"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: userColor, borderColor: `${userColor}40` }}
            >
              <ArrowUpDown className="w-4 h-4" />
              {sortAsc ? 'Oldest' : 'Newest'}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-2 p-3" style={{ scrollbarWidth: 'thin' }}>
            {sortedHistory.map((transfer, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border-2 hover:bg-opacity-90 transition-all"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: `${userColor}40` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-black/40 border rounded px-2 py-1" style={{ borderColor: `${userColor}40` }}>
                        <Send className="w-4 h-4 flex-shrink-0" style={{ color: userColor }} />
                        <span className="font-black text-sm" style={{ color: userColor }}>{transfer.amount} MOD</span>
                      </div>
                      <div className="flex items-center gap-1 bg-black/40 border border-blue-500/30 rounded px-2 py-1">
                        <span className="text-xs text-blue-400 font-mono">{new Date(transfer.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 border border-green-500/30 rounded px-2 py-1">
                      <code className="text-xs font-mono" style={{ color: '#10b981' }}>
                        To: {transfer.to.slice(0, 12)}...{transfer.to.slice(-8)}
                      </code>
                      <CopyButton text={transfer.to} size="sm" />
                    </div>
                    {transfer.hash && (
                      <div className="flex items-center gap-1 bg-black/40 border border-purple-500/30 rounded px-2 py-1">
                        <code className="text-xs font-mono text-purple-400">
                          Hash: {transfer.hash.slice(0, 12)}...{transfer.hash.slice(-8)}
                        </code>
                        <CopyButton text={transfer.hash} size="sm" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Transfer
