'use client'

import { useState, useEffect } from 'react'
import { getProtocol } from '@/config/protocols'
import { RiskBadge } from './RiskBadge'
import { AmountInput } from './AmountInput'
import { useStake, StakeStatus } from '@/hooks/useStake'
import { useAccount, useBalance } from 'wagmi'
import { TOKENS } from '@/config/tokens'
import { formatBalance } from '@/lib/format'
import { base } from 'wagmi/chains'

interface Props {
  protocolId: string | null
  mode: 'stake' | 'unstake'
  prefillToken?: string
  prefillAmount?: string
  onClose: () => void
}

const STATUS_TEXT: Record<StakeStatus, string> = {
  idle: '',
  approving: 'Approving token...',
  staking: 'Submitting stake...',
  unstaking: 'Submitting withdrawal...',
  success: 'Transaction confirmed!',
  error: 'Transaction failed',
}

export function StakeModal({ protocolId, mode, prefillToken, prefillAmount, onClose }: Props) {
  const protocol = protocolId ? getProtocol(protocolId) : null
  const [selectedToken, setSelectedToken] = useState(prefillToken || protocol?.supportedTokens[0] || 'USDC')
  const [amount, setAmount] = useState(prefillAmount || '')
  const { stake, unstake, status, txHash, reset } = useStake()
  const { address } = useAccount()

  const tokenConfig = TOKENS[selectedToken]
  const { data: balanceData } = useBalance({
    address,
    token: selectedToken === 'ETH' ? undefined : tokenConfig?.address as `0x${string}`,
    chainId: base.id,
  })

  useEffect(() => {
    if (prefillToken) setSelectedToken(prefillToken)
    if (prefillAmount) setAmount(prefillAmount)
  }, [prefillToken, prefillAmount])

  if (!protocol || !protocolId) return null

  const isLoading = status === 'approving' || status === 'staking' || status === 'unstaking'
  const balance = balanceData ? formatBalance(balanceData.formatted) : undefined

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) return
    if (mode === 'stake') {
      stake(protocolId, selectedToken, amount)
    } else {
      unstake(protocolId, selectedToken, amount)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-modfi-card border border-modfi-border rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">
              {mode === 'stake' ? 'Stake' : 'Unstake'} - {protocol.name}
            </h3>
            <RiskBadge level={protocol.riskLevel} />
          </div>
          <button onClick={handleClose} className="text-modfi-muted hover:text-white text-xl">&times;</button>
        </div>

        {/* Token select */}
        <div className="mb-4">
          <label className="text-xs text-modfi-muted mb-2 block">Token</label>
          <div className="flex gap-2">
            {protocol.supportedTokens.map(t => (
              <button
                key={t}
                onClick={() => setSelectedToken(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedToken === t
                    ? 'bg-modfi-purple/20 text-modfi-purple border border-modfi-purple/30'
                    : 'bg-modfi-bg text-modfi-muted border border-modfi-border hover:border-modfi-purple/20'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="mb-5">
          <AmountInput
            value={amount}
            onChange={setAmount}
            balance={balance}
            token={selectedToken}
            onMax={() => balance && setAmount(balanceData?.formatted || '')}
          />
        </div>

        {/* Risk warning for HIGH risk */}
        {protocol.riskLevel === 'HIGH' && mode === 'stake' && (
          <div className="mb-4 p-3 rounded-lg bg-red-400/5 border border-red-400/20 text-xs text-red-400">
            This protocol carries higher risk including leverage exposure and liquidation risk. Only stake what you can afford to lose.
          </div>
        )}

        {/* Status */}
        {status !== 'idle' && (
          <div className={`mb-4 text-sm text-center ${
            status === 'success' ? 'text-modfi-green' :
            status === 'error' ? 'text-modfi-red' :
            'text-modfi-muted'
          }`}>
            {isLoading && <span className="inline-block animate-spin mr-2">&#9696;</span>}
            {STATUS_TEXT[status]}
            {txHash && (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="block mt-1 text-modfi-purple hover:underline text-xs"
              >
                View on BaseScan
              </a>
            )}
          </div>
        )}

        {/* Submit */}
        {status === 'success' ? (
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl bg-modfi-green/10 text-modfi-green font-medium border border-modfi-green/20"
          >
            Done
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-modfi-purple to-modfi-violet text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {isLoading ? 'Confirming...' : mode === 'stake' ? 'Stake' : 'Unstake'}
          </button>
        )}
      </div>
    </div>
  )
}
