'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Providers } from '@/app/providers'
import { Header } from './Header'
import { PriceBar } from './PriceBar'
import { ProtocolGrid } from './ProtocolGrid'
import { PositionsList } from './PositionsList'
import { StakeModal } from './StakeModal'
import { useRates } from '@/hooks/useRates'

function Dashboard() {
  const { isConnected } = useAccount()
  const { data: rates } = useRates()
  const [modal, setModal] = useState<{
    protocolId: string
    mode: 'stake' | 'unstake'
    token?: string
    amount?: string
  } | null>(null)

  return (
    <div className="min-h-screen bg-modfi-bg">
      <Header />
      <PriceBar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-modfi-purple to-modfi-violet bg-clip-text text-transparent mb-3">
              DeFi Aggregator on Base
            </h2>
            <p className="text-modfi-muted mb-6 max-w-md mx-auto">
              Stake across the best DeFi protocols on Base. Compare rates, manage risk, and invest through a unified interface.
            </p>
            <p className="text-sm text-modfi-muted">Connect your wallet to get started</p>
          </div>
        ) : (
          <>
            <PositionsList
              onUnstake={(protocolId, token, amount) =>
                setModal({ protocolId, mode: 'unstake', token, amount })
              }
            />
            <ProtocolGrid
              rates={rates || []}
              onStake={(protocolId) => setModal({ protocolId, mode: 'stake' })}
            />
          </>
        )}
      </main>

      {modal && (
        <StakeModal
          protocolId={modal.protocolId}
          mode={modal.mode}
          prefillToken={modal.token}
          prefillAmount={modal.amount}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <Providers>
      <Dashboard />
    </Providers>
  )
}
