"use client";

import { motion } from 'framer-motion'
import { CreditCardIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'

import { SidebarHeader } from './SidebarHeader'
import { CreditTab } from './CreditTab'
import { TransactionsTab } from './TransactionsTab'
import { AccountsTab } from './AccountsTab'
import { PortfolioTab } from './PortfolioTab'
import { ContractsTab } from './ContractsTab'
import { ModsTab } from './ModsTab'

function TabButton({ active, onClick, icon, label, color }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  color: string
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-all duration-200 rounded-lg relative"
      style={{
        fontFamily: 'var(--font-digital), monospace',
        fontSize: '10px',
        letterSpacing: '0.1em',
        background: active ? `${color}18` : 'transparent',
        color: active ? color : 'var(--text-tertiary)',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
      }}
    >
      <div style={{ opacity: active ? 1 : 0.5 }}>{icon}</div>
      <span className="font-bold">{label}</span>
      {active && (
        <motion.div
          layoutId="tab-glow"
          className="absolute inset-0 rounded-lg"
          style={{ background: `${color}08`, pointerEvents: 'none' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </motion.button>
  )
}

interface WalletSidebarProps {
  // Header
  shortAddress: string
  walletMode: string
  copiedAddress: boolean
  copyAddress: () => void
  tokenExpiry: string | null
  getTokenExpiry: () => string
  isTokenExpired: boolean
  isRefreshingToken: boolean
  handleRefreshToken: () => void
  handleSignOut: () => void
  onClose: () => void
  marketCredit: number
  userColor: string
  // Resize
  sidebarWidth: number
  isResizing: boolean
  setIsResizing: (v: boolean) => void
  // Tab state
  activeTab: string | null
  openTab: (tab: string) => void
  // Portfolio (now in header)
  tokenBalances: Record<string, number>
  customTokens: { address: string; symbol: string; decimals: number }[]
  customTokenBalances: Record<string, number>
  sendFromPortfolio: string | null
  setSendFromPortfolio: (v: string | null) => void
  transferRecipient: string
  setTransferRecipient: (v: string) => void
  transferAmount: string
  setTransferAmount: (v: string) => void
  isTransferring: boolean
  setTransferTokenType: (v: 'MARKET' | 'USDC' | 'USDT') => void
  topUpError: string | null
  setTopUpError: (v: string | null) => void
  topUpSuccess: string | null
  setTopUpSuccess: (v: string | null) => void
  showAddToken: boolean
  setShowAddToken: (v: boolean) => void
  newTokenAddress: string
  setNewTokenAddress: (v: string) => void
  isAddingToken: boolean
  isRefreshingBalances: boolean
  onRefreshBalances: () => void
  onTransfer: () => void
  onSendETH: () => void
  onSendCustomToken: (addr: string, symbol: string, decimals: number) => void
  onRemoveCustomToken: (addr: string) => void
  onAddCustomToken: () => void
  // Credit (merged top-up + withdraw)
  selectedToken: 'USDC' | 'USDT'
  setSelectedToken: (v: 'USDC' | 'USDT') => void
  topUpAmount: string
  setTopUpAmount: (v: string) => void
  isProcessing: boolean
  onTopUp: () => void
  withdrawTokenType: 'USDC' | 'USDT'
  setWithdrawTokenType: (v: 'USDC' | 'USDT') => void
  withdrawAmount: string
  setWithdrawAmount: (v: string) => void
  isWithdrawing: boolean
  onWithdraw: () => void
  // Accounts
  address: string
  walletHistory: { address: string; mode: string; type: string; lastUsed: number }[]
  isSwitchingWallet: boolean
  onSwitchWallet: (wallet: { address: string; mode: string; type: string }) => void
  onRemoveFromHistory: (addr: string) => void
  // Transactions
  userTransactions: any[]
  isLoadingTxs: boolean
  txsStatusFilter: 'all' | 'pending' | 'complete'
  setTxsStatusFilter: (v: 'all' | 'pending' | 'complete') => void
  expandedTxIdx: number | null
  setExpandedTxIdx: (v: number | null) => void
  totalCost24h: number
  // ETH Price
  ethPrice?: number
}

const TAB_COLORS: Record<string, string> = {
  portfolio: '#a855f7',
  credit: '#22c55e',
  txs: '#f59e0b',
  contracts: '#06b6d4',
  mods: '#14b8a6',
}

export function WalletSidebar(props: WalletSidebarProps) {
  const {
    shortAddress, walletMode, copiedAddress, copyAddress,
    tokenExpiry, getTokenExpiry, isTokenExpired, isRefreshingToken,
    handleRefreshToken, handleSignOut, onClose,
    marketCredit, userColor,
    sidebarWidth, isResizing, setIsResizing,
    activeTab, openTab,
  } = props

  const showPortfolio = activeTab === 'portfolio'
  const showCredit = activeTab === 'credit'
  const showTxs = activeTab === 'txs'
  const showWallets = activeTab === 'wallets'
  const showContracts = activeTab === 'contracts'
  const showMods = activeTab === 'mods'

  return (
    <div>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
        onClick={onClose}
      />

      {/* Side Panel */}
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
        className={`fixed top-0 right-0 h-screen shadow-2xl z-[90] overflow-y-auto custom-scrollbar font-mono ${isResizing ? 'select-none' : ''}`}
        style={{
          width: `${sidebarWidth}px`,
          borderLeft: `1px solid ${userColor}30`,
          boxShadow: `-40px 0 80px rgba(0, 0, 0, 0.5), 0 0 120px ${userColor}15`,
          cursor: isResizing ? 'ew-resize' : 'default',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/5 transition-colors z-[100] group"
          onMouseDown={() => setIsResizing(true)}
        >
          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-16 transition-colors rounded-full" style={{ backgroundColor: 'var(--border-input)' }} />
        </div>
        {isResizing && (
          <style>{`body { cursor: ew-resize !important; user-select: none; }`}</style>
        )}

        <SidebarHeader
          shortAddress={shortAddress}
          walletMode={walletMode}
          copiedAddress={copiedAddress}
          copyAddress={copyAddress}
          tokenExpiry={tokenExpiry}
          getTokenExpiry={getTokenExpiry}
          isTokenExpired={isTokenExpired}
          isRefreshing={isRefreshingToken}
          handleRefreshToken={handleRefreshToken}
          handleSignOut={handleSignOut}
          onClose={onClose}
          marketCredit={marketCredit}
          address={props.address}
          walletHistory={props.walletHistory}
          isSwitchingWallet={props.isSwitchingWallet}
          onSwitchWallet={props.onSwitchWallet}
          onRemoveFromHistory={props.onRemoveFromHistory}
        />

        {/* Action Tabs */}
        <motion.div
          className="px-5 py-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="flex rounded-xl overflow-hidden" style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            padding: '3px',
            gap: '2px',
          }}>
            <TabButton
              active={showPortfolio}
              onClick={() => openTab('portfolio')}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              label="SEND"
              color={TAB_COLORS.portfolio}
            />
            <TabButton
              active={showCredit}
              onClick={() => openTab('credit')}
              icon={<CreditCardIcon className="w-4 h-4" />}
              label="CREDIT"
              color={TAB_COLORS.credit}
            />
            <TabButton
              active={showTxs}
              onClick={() => openTab('txs')}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              label="TXS"
              color={TAB_COLORS.txs}
            />
            <TabButton
              active={showContracts}
              onClick={() => openTab('contracts')}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              }
              label="CHAIN"
              color={TAB_COLORS.contracts}
            />
            <TabButton
              active={showMods}
              onClick={() => openTab('mods')}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              }
              label="MODS"
              color={TAB_COLORS.mods}
            />
          </div>

          <PortfolioTab
            show={showPortfolio}
            tokenBalances={props.tokenBalances}
            customTokens={props.customTokens}
            customTokenBalances={props.customTokenBalances}
            marketCredit={marketCredit}
            sendFromPortfolio={props.sendFromPortfolio}
            setSendFromPortfolio={props.setSendFromPortfolio}
            transferRecipient={props.transferRecipient}
            setTransferRecipient={props.setTransferRecipient}
            transferAmount={props.transferAmount}
            setTransferAmount={props.setTransferAmount}
            isTransferring={props.isTransferring}
            setTransferTokenType={props.setTransferTokenType}
            topUpError={props.topUpError}
            setTopUpError={props.setTopUpError}
            topUpSuccess={props.topUpSuccess}
            setTopUpSuccess={props.setTopUpSuccess}
            showAddToken={props.showAddToken}
            setShowAddToken={props.setShowAddToken}
            newTokenAddress={props.newTokenAddress}
            setNewTokenAddress={props.setNewTokenAddress}
            isAddingToken={props.isAddingToken}
            isRefreshing={props.isRefreshingBalances}
            onRefreshBalances={props.onRefreshBalances}
            onTransfer={props.onTransfer}
            onSendETH={props.onSendETH}
            onSendCustomToken={props.onSendCustomToken}
            onRemoveCustomToken={props.onRemoveCustomToken}
            onAddCustomToken={props.onAddCustomToken}
          />

          <CreditTab
            show={showCredit}
            selectedToken={props.selectedToken}
            setSelectedToken={props.setSelectedToken}
            topUpAmount={props.topUpAmount}
            setTopUpAmount={props.setTopUpAmount}
            isProcessing={props.isProcessing}
            onTopUp={props.onTopUp}
            withdrawTokenType={props.withdrawTokenType}
            setWithdrawTokenType={props.setWithdrawTokenType}
            withdrawAmount={props.withdrawAmount}
            setWithdrawAmount={props.setWithdrawAmount}
            isWithdrawing={props.isWithdrawing}
            marketCredit={marketCredit}
            onWithdraw={props.onWithdraw}
            topUpError={props.topUpError}
            topUpSuccess={props.topUpSuccess}
          />

          <TransactionsTab
            show={showTxs}
            userTransactions={props.userTransactions}
            isLoadingTxs={props.isLoadingTxs}
            txsStatusFilter={props.txsStatusFilter}
            setTxsStatusFilter={props.setTxsStatusFilter}
            expandedTxIdx={props.expandedTxIdx}
            setExpandedTxIdx={props.setExpandedTxIdx}
            totalCost24h={props.totalCost24h}
          />

          <ContractsTab show={showContracts} />

          <ModsTab show={showMods} />

        </motion.div>
      </motion.div>
    </div>
  )
}
