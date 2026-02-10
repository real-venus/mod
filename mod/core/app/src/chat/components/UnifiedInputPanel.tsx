"use client";

import { useState, useEffect } from 'react'
import { SchemaParamsPanel } from './SchemaParamsPanel'
import type { UnifiedInputPanelProps } from '../types'
import { TransactionsPanel } from '../transactions/TransactionsPanel'
import { TransactionCard } from '../transactions/TransactionCard'
import { userContext } from '@/context/UserContext'

export function UnifiedInputPanel({
  input, setInput, selectedInputParam, setSelectedInputParam,
  wait, setWait, isLoading, selectedModule, selectedFunction,
  inputParamOptions, handleSubmit, onCancel,
  params, handleParamChange, handleResetParams, schema,
  functionHasCode = false,
  activeTab = 'chat',
  setActiveTab = () => {},
  transactionsPanelRef
}: UnifiedInputPanelProps) {
  const [showParamDropdown, setShowParamDropdown] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [showNotification, setShowNotification] = useState(false)
  const [currentTransaction, setCurrentTransaction] = useState<any>(null)
  const { client } = userContext()

  // Fetch pending transaction count and current transaction
  useEffect(() => {
    if (!client) return

    const fetchTransactions = async () => {
      try {
        const result = await client.call('txs', { df: 0, n: 50, page: 0 })
        const txs = Array.isArray(result) ? result : []

        // Count only pending transactions for the badge
        const pending = txs.filter((tx: any) => tx.status === 'pending').length

        // Find any running or pending transaction
        const runningTx = txs.find((tx: any) =>
          tx.status === 'running' || tx.status === 'pending'
        )

        // Update current transaction
        if (runningTx) {
          // Always show running/pending transactions
          setCurrentTransaction(runningTx)
        } else if (currentTransaction) {
          // Check if the current transaction finished
          const finishedTx = txs.find((tx: any) =>
            (tx.cid && tx.cid === currentTransaction.cid) ||
            (tx.hash && tx.hash === currentTransaction.hash)
          )
          if (finishedTx && (finishedTx.status === 'success' || finishedTx.status === 'finished' || finishedTx.status === 'complete' || finishedTx.status === 'error' || finishedTx.status === 'failed')) {
            // Show finished transaction for 5 seconds then clear
            setCurrentTransaction(finishedTx)
            setTimeout(() => setCurrentTransaction(null), 5000)
          }
        }

        // Show notification if pending count increased
        if (pending > pendingCount && pendingCount > 0) {
          setShowNotification(true)
          setTimeout(() => setShowNotification(false), 3000)
        }

        setPendingCount(pending)
      } catch (err) {
        console.error('Failed to fetch pending transactions:', err)
      }
    }

    fetchTransactions()
    const interval = setInterval(fetchTransactions, 1000) // Update every second for real-time
    return () => clearInterval(interval)
  }, [client, pendingCount, currentTransaction])

  // Clear current transaction when starting a new one
  useEffect(() => {
    if (isLoading) {
      setCurrentTransaction({
        fn: `${selectedModule}/${selectedFunction}`,
        params: params,
        status: 'pending',
        time: String(Math.floor(Date.now() / 1000)),
        key: '',
        signature: '',
        module: selectedModule,
      })
    }
  }, [isLoading, selectedModule, selectedFunction, params])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const handleParamChangeWithSync = (key: string, value: string) => {
    handleParamChange(key, value)
    if (key === selectedInputParam) setInput(value)
  }

  const handleInputChangeWithSync = (value: string) => {
    setInput(value)
    if (selectedInputParam) handleParamChange(selectedInputParam, value)
  }

  const functionCode = schema?.[selectedFunction]?.content || ''

  return (
    <div className="h-full flex flex-col relative">
      {/* Notification Toast */}
      {showNotification && (
        <div className="absolute top-4 right-4 z-50 animate-slideIn">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-3 rounded-2xl shadow-2xl border-2 border-amber-400/50 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-pulse">⚡</span>
              <div>
                <div className="font-bold text-sm">New Transaction</div>
                <div className="text-xs opacity-90">{pendingCount} pending</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar - Wallet style */}
      <div className="flex-shrink-0 flex gap-2 items-center justify-between pb-3 mb-3">
        <div className="flex gap-2 p-1 rounded-xl bg-black/60 border border-neutral-800">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all uppercase tracking-wide ${
              activeTab === 'chat'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
            }`}
          >
            💬 Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all uppercase tracking-wide ${
              activeTab === 'params'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
            }`}
          >
            ⚙️ Params
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('txs')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all uppercase tracking-wide ${
              activeTab === 'txs'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2">
              📊 TXS
              {pendingCount > 0 && (
                <span className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-black text-xs font-black rounded-full min-w-[24px] h-6 px-2 flex items-center justify-center border-2 border-white shadow-lg">
                  {pendingCount}
                </span>
              )}
            </span>
          </button>
          {functionHasCode && (
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all uppercase tracking-wide ${
                activeTab === 'code'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
              }`}
            >
              💻 Code
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-8 py-4 text-lg font-black rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all border-2 border-red-400/50 shadow-lg shadow-red-500/30 flex items-center gap-3 uppercase tracking-wide transform hover:scale-105 active:scale-95"
            >
              <span className="animate-pulse text-2xl">⏹</span>
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => handleSubmit(e as any)}
              className="px-8 py-4 text-lg font-black rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 transition-all border-2 border-cyan-400/50 shadow-lg shadow-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3 uppercase tracking-wide transform hover:scale-105 active:scale-95"
              disabled={!selectedModule || !selectedFunction}
            >
              <span className="text-2xl">⚡</span>
              <span>Send</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'chat' ? (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Param selector row - wallet style */}
          {inputParamOptions.length > 0 && (
            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 border border-neutral-800">
              <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Input:</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowParamDropdown(!showParamDropdown)}
                  className="px-3 py-1 text-xs font-mono font-bold rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 transition-all flex items-center gap-2 uppercase"
                  disabled={isLoading}
                >
                  <span>{selectedInputParam || inputParamOptions[0] || 'param'}</span>
                  <span className="text-xs">▼</span>
                </button>
                {showParamDropdown && (
                  <div className="absolute top-full mt-1 left-0 min-w-[160px] bg-black/95 border border-cyan-500/50 rounded-lg shadow-xl overflow-hidden z-50">
                    {inputParamOptions.map(param => (
                      <button
                        key={param}
                        type="button"
                        onClick={() => {
                          setSelectedInputParam(param)
                          setShowParamDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm font-mono font-bold hover:bg-cyan-500/20 text-cyan-400 border-b border-neutral-800 last:border-b-0 transition-all uppercase"
                      >
                        {param}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Textarea - wallet style */}
          <div className="flex-shrink-0" style={{ height: '200px' }}>
            <textarea
              value={input}
              onChange={(e) => handleInputChangeWithSync(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="enter message..."
              className="w-full h-full bg-black/60 border border-neutral-800 text-neutral-200 px-4 py-3 rounded-xl text-sm font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 placeholder-neutral-600 resize-none transition-all"
              disabled={isLoading}
            />
          </div>

          {/* Current Results Section */}
          {currentTransaction && (
            <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center gap-2 px-2 py-1">
                <span className="text-xl">📊</span>
                <h3 className="text-white text-sm font-black uppercase tracking-widest">Current Results</h3>
              </div>
              <div className="flex-shrink-0 animate-slideIn">
                <TransactionCard
                  tx={currentTransaction}
                  idx={0}
                  isExpanded={false}
                />
              </div>
            </div>
          )}
        </form>
      ) : activeTab === 'params' ? (
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-1">
            {selectedFunction && schema?.[selectedFunction] && (
              <SchemaParamsPanel
                selectedFunction={selectedFunction}
                schema={schema}
                params={params}
                handleParamChange={handleParamChangeWithSync}
                handleResetParams={handleResetParams}
                numColumns={2}
              />
            )}
          </div>

          {/* Current Results Section */}
          {currentTransaction && (
            <div className="flex-shrink-0 flex flex-col gap-3 border-t border-neutral-800 pt-3">
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="text-xl">📊</span>
                <h3 className="text-white text-sm font-black uppercase tracking-widest">Current Results</h3>
              </div>
              <div className="animate-slideIn">
                <TransactionCard
                  tx={currentTransaction}
                  idx={0}
                  isExpanded={false}
                />
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'txs' ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <TransactionsPanel ref={transactionsPanelRef} hideTitle={true} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="bg-black/60 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-emerald-400 text-sm">💻</span>
              <h3 className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider">Function Code</h3>
            </div>
            <pre className="bg-black border border-neutral-800 rounded-lg p-3 overflow-x-auto text-xs text-neutral-300 font-mono leading-relaxed">
              <code>{functionCode || 'No code available'}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
