"use client";

import { ArrowPathIcon, ArrowsRightLeftIcon, PlusCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { CopyButton } from '@/ui/CopyButton'
import modConfig from '@config'

type TransferTokenType = 'MARKET' | 'USDC' | 'USDT'

interface CustomToken {
  address: string
  symbol: string
  decimals: number
}

interface PortfolioTabProps {
  show: boolean
  tokenBalances: Record<string, number>
  customTokens: CustomToken[]
  customTokenBalances: Record<string, number>
  marketCredit: number
  sendFromPortfolio: string | null
  setSendFromPortfolio: (v: string | null) => void
  transferRecipient: string
  setTransferRecipient: (v: string) => void
  transferAmount: string
  setTransferAmount: (v: string) => void
  isTransferring: boolean
  setTransferTokenType: (v: TransferTokenType) => void
  topUpError: string | null
  setTopUpError: (v: string | null) => void
  topUpSuccess: string | null
  setTopUpSuccess: (v: string | null) => void
  showAddToken: boolean
  setShowAddToken: (v: boolean) => void
  newTokenAddress: string
  setNewTokenAddress: (v: string) => void
  isAddingToken: boolean
  isRefreshing: boolean
  onRefreshBalances: () => void
  onTransfer: () => void
  onSendETH: () => void
  onSendCustomToken: (addr: string, symbol: string, decimals: number) => void
  onRemoveCustomToken: (addr: string) => void
  onAddCustomToken: () => void
}

export function PortfolioTab({
  show, tokenBalances, customTokens, customTokenBalances, marketCredit,
  sendFromPortfolio, setSendFromPortfolio,
  transferRecipient, setTransferRecipient,
  transferAmount, setTransferAmount,
  isTransferring, setTransferTokenType,
  topUpError, setTopUpError, topUpSuccess, setTopUpSuccess,
  showAddToken, setShowAddToken, newTokenAddress, setNewTokenAddress,
  isAddingToken, isRefreshing,
  onRefreshBalances, onTransfer, onSendETH, onSendCustomToken,
  onRemoveCustomToken, onAddCustomToken
}: PortfolioTabProps) {
  const tokenAddressMap: Record<string, string | undefined> = {
    USDC: (modConfig.chain as any)?.testnet?.contracts?.USDC?.address,
    USDT: (modConfig.chain as any)?.testnet?.contracts?.USDT?.address,
    MARKET: (modConfig.chain as any)?.testnet?.contracts?.Market?.address,
    NativeToken: (modConfig.chain as any)?.testnet?.contracts?.NativeToken?.address,
    BridgeToken: (modConfig.chain as any)?.testnet?.contracts?.BridgeToken?.address,
  }

  // Build unified token list: built-in + custom
  const allTokens: { key: string; symbol: string; balance: number; address?: string; decimals?: number; isCustom?: boolean; isETH?: boolean }[] = []

  for (const [token, balance] of Object.entries(tokenBalances)) {
    // Get token info for native token
    let decimals = 18 // default
    if (token === 'NativeToken' || token === 'BridgeToken') {
      decimals = 18 // NativeToken and BridgeToken use 18 decimals
    }

    allTokens.push({
      key: token,
      symbol: token,
      balance: Number(balance) || 0,
      address: tokenAddressMap[token],
      decimals: (token === 'NativeToken' || token === 'BridgeToken') ? decimals : undefined,
      isETH: token === 'ETH',
    })
  }

  for (const ct of customTokens) {
    if (!allTokens.some(t => t.address?.toLowerCase() === ct.address.toLowerCase())) {
      allTokens.push({
        key: `custom-${ct.address}`,
        symbol: ct.symbol,
        balance: customTokenBalances[ct.symbol] || 0,
        address: ct.address,
        decimals: ct.decimals,
        isCustom: true,
      })
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-3 pt-3 overflow-hidden"
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1 mb-3">
              <span className="text-sm uppercase tracking-widest font-bold" style={{
                fontFamily: 'var(--font-digital)',
                color: 'var(--text-primary)',
                textShadow: 'var(--effect-text-shadow, 0) 0px 10px var(--text-primary)',
                letterSpacing: '0.2em'
              }}>
                TOKEN BALANCES
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setShowAddToken(!showAddToken); setSendFromPortfolio(null) }}
                  className="p-1 transition-all rounded"
                  title="Add custom token"
                  style={{ borderRadius: 0 }}
                >
                  <PlusCircleIcon className={`w-3.5 h-3.5 ${showAddToken ? 'text-purple-400' : ''}`} style={!showAddToken ? { color: 'var(--text-tertiary)' } : {}} />
                </button>
                <button
                  onClick={onRefreshBalances}
                  disabled={isRefreshing}
                  className="p-1 transition-all disabled:opacity-50 rounded"
                  title="Refresh balances"
                  style={{ borderRadius: 0 }}
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            </div>

            {/* Add Custom Token Form */}
            <AnimatePresence>
              {showAddToken && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-1.5 mb-2">
                    <input
                      type="text"
                      value={newTokenAddress}
                      onChange={(e) => setNewTokenAddress(e.target.value)}
                      placeholder="Token address 0x..."
                      className="flex-1 px-3 py-2 text-xs font-mono placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                      style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                    />
                    <button
                      onClick={onAddCustomToken}
                      disabled={isAddingToken}
                      className="px-3 py-2 bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-bold hover:bg-purple-500/25 transition-all disabled:opacity-50"
                      style={{ borderRadius: '8px', fontFamily: 'IBM Plex Mono, monospace' }}
                    >
                      {isAddingToken ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : 'ADD'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {allTokens.length === 0 ? (
              <div className="text-center py-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {isRefreshing ? (
                  <div className="flex items-center justify-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    <span>Loading balances...</span>
                  </div>
                ) : (
                  'No token balances available'
                )}
              </div>
            ) : (
              allTokens.map((token) => {
                const isSelected = sendFromPortfolio === token.key
                const isBridge = token.symbol === 'BridgeToken'
                return (
                  <div key={token.key}>
                    <button
                      onClick={() => {
                        setSendFromPortfolio(isSelected ? null : token.key)
                        setTransferRecipient('')
                        setTransferAmount('')
                        setTopUpError(null)
                        setTopUpSuccess(null)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-3 text-sm transition-all border-2`}
                      style={{
                        borderRadius: '0px',
                        fontFamily: 'var(--font-digital)',
                        backgroundColor: isSelected ? 'var(--bg-input-hover)' : 'var(--bg-input)',
                        borderColor: isSelected ? 'var(--border-strong)' : 'var(--border-color)',
                        boxShadow: isSelected ? 'var(--card-shadow)' : 'none',
                      }}
                    >
                      <span className={`flex items-center gap-1.5 font-bold uppercase tracking-widest text-sm`} style={{
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-digital)'
                      }}>
                        {token.symbol === 'BridgeToken' ? 'BRIDGE' : token.symbol}
                        {token.address && (
                          <span onClick={(e) => e.stopPropagation()}>
                            <CopyButton text={token.address} size="sm" />
                          </span>
                        )}
                        {token.isCustom && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemoveCustomToken(token.address!) }}
                            className="text-red-500/40 hover:text-red-400 transition-colors"
                            title="Remove token"
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                      <span className={`font-mono font-bold tabular-nums text-sm`} style={{
                        color: token.balance > 0 ? 'var(--accent-success)' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-digital)',
                      }}>
                        {token.isETH
                          ? `${token.balance.toFixed(4)} ETH`
                          : token.symbol === 'BridgeToken'
                          ? `${token.balance.toFixed(4)} BT`
                          : token.isCustom || token.symbol === 'NativeToken'
                          ? `${token.balance.toFixed(4)} ${token.symbol}`
                          : `$${token.balance.toFixed(2)}`}
                      </span>
                    </button>

                    {/* Inline Send Form */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className={`overflow-hidden px-3 py-3 space-y-2 ${
                            isBridge
                              ? 'border-4 border-t-0 border-cyan-500/30'
                              : 'border border-t-0 border-blue-500/20'
                          }`}
                          style={{
                            borderRadius: isBridge ? '0' : '0 0 8px 8px',
                            fontFamily: isBridge ? 'var(--font-digital)' : 'IBM Plex Mono, monospace',
                            backgroundColor: 'var(--bg-input)',
                            ...(isBridge ? {
                              background: `repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 2px), var(--bg-input)`
                            } : {})
                          }}
                        >
                          <input
                            type="text"
                            value={transferRecipient}
                            onChange={(e) => setTransferRecipient(e.target.value)}
                            disabled={isTransferring}
                            placeholder="Recipient address..."
                            className="w-full px-3 py-2 text-xs font-mono focus:outline-none transition-colors"
                            style={{
                              borderRadius: '0px',
                              backgroundColor: 'var(--bg-primary)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-digital)',
                            }}
                          />
                          <input
                            type="number"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            disabled={isTransferring}
                            min="0"
                            step="0.01"
                            placeholder="Amount..."
                            className="w-full px-3 py-2 text-xs font-mono focus:outline-none transition-colors"
                            style={{
                              borderRadius: '0px',
                              backgroundColor: 'var(--bg-primary)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-digital)',
                            }}
                          />
                          <button
                            onClick={() => {
                              if (token.isETH) {
                                onSendETH()
                              } else if (token.symbol === 'BridgeToken' && token.address && token.decimals != null) {
                                onSendCustomToken(token.address, token.symbol, token.decimals)
                              } else if (token.isCustom && token.address && token.decimals != null) {
                                onSendCustomToken(token.address, token.symbol, token.decimals)
                              } else if (token.symbol === 'NativeToken' && token.address && token.decimals != null) {
                                onSendCustomToken(token.address, token.symbol, token.decimals)
                              } else if (token.symbol === 'MARKET') {
                                setTransferTokenType('MARKET')
                                onTransfer()
                              } else if (token.symbol === 'USDC') {
                                setTransferTokenType('USDC')
                                onTransfer()
                              } else if (token.symbol === 'USDT') {
                                setTransferTokenType('USDT')
                                onTransfer()
                              }
                            }}
                            disabled={!transferAmount || !transferRecipient || isTransferring}
                            className={`w-full py-2 text-xs font-bold uppercase transition-all disabled:opacity-40 flex items-center justify-center gap-2 border-2`}
                            style={{
                              borderRadius: '0px',
                              fontFamily: 'var(--font-digital)',
                              backgroundColor: 'var(--accent-primary)',
                              borderColor: 'var(--accent-primary)',
                              color: 'var(--bg-primary)',
                            }}
                          >
                            {isTransferring ? (
                              <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                                {isBridge ? '▸ ' : ''}SEND {token.symbol === 'BridgeToken' ? 'BT' : token.symbol}
                              </>
                            )}
                          </button>

                          {topUpError && (
                            <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1.5 font-mono" style={{ borderRadius: '6px' }}>
                              {topUpError}
                            </div>
                          )}
                          {topUpSuccess && (
                            <div className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1.5 font-mono" style={{ borderRadius: '6px' }}>
                              {topUpSuccess}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
