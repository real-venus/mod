"use client";

import { motion } from 'framer-motion'
import { WalletIcon, ArrowRightOnRectangleIcon, CreditCardIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'

import { SidebarHeader } from './SidebarHeader'
import { PortfolioTab } from './PortfolioTab'
import { TopUpTab } from './TopUpTab'
import { WithdrawTab } from './WithdrawTab'
import { TransactionsTab } from './TransactionsTab'
import { AccountsTab } from './AccountsTab'

function TabButton({ active, onClick, icon, label, colorActive, colorInactive }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  colorActive: string
  colorInactive: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-300 text-[11px] font-bold uppercase shadow-lg hover:scale-105 ${
        active
          ? `bg-gradient-to-br ${colorActive}`
          : `bg-gradient-to-br ${colorInactive}`
      }`}
      style={{ fontFamily: 'IBM Plex Mono, monospace', borderRadius: '12px', width: '72px', height: '72px' }}
    >
      {icon}
      <span>{label}</span>
    </button>
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
  // Portfolio
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
  // Top-up
  selectedToken: 'USDC' | 'USDT'
  setSelectedToken: (v: 'USDC' | 'USDT') => void
  topUpAmount: string
  setTopUpAmount: (v: string) => void
  isProcessing: boolean
  onTopUp: () => void
  // Withdraw
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

  const showTopUp = activeTab === 'topup'
  const showWithdraw = activeTab === 'withdraw'
  const showPortfolio = activeTab === 'portfolio'
  const showTxs = activeTab === 'txs'
  const showWallets = activeTab === 'wallets'

  return (
    <div>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
        onClick={onClose}
      />

      {/* Side Panel */}
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
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
        />

        {/* Action Tabs */}
        <div className="px-5 py-4">
          <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#404040 transparent' }}>
            <TabButton
              active={showTopUp}
              onClick={() => openTab('topup')}
              icon={<CreditCardIcon className="w-5 h-5" />}
              label="ADD"
              colorActive="from-green-500/30 to-emerald-500/30 border-green-400 text-green-300 shadow-green-500/50"
              colorInactive="from-green-950/40 to-emerald-950/40 border-green-900/60 text-green-600 hover:text-green-300 hover:border-green-400/60 hover:shadow-green-500/30"
            />
            <TabButton
              active={showWithdraw}
              onClick={() => openTab('withdraw')}
              icon={<ArrowRightOnRectangleIcon className="w-5 h-5" />}
              label="OUT"
              colorActive="from-rose-500/30 to-red-500/30 border-rose-400 text-rose-300 shadow-rose-500/50"
              colorInactive="from-rose-950/40 to-red-950/40 border-rose-900/60 text-rose-600 hover:text-rose-300 hover:border-rose-400/60 hover:shadow-rose-500/30"
            />
            <TabButton
              active={showPortfolio}
              onClick={() => openTab('portfolio')}
              icon={<WalletIcon className="w-5 h-5" />}
              label="PORT"
              colorActive="from-purple-500/30 to-purple-600/30 border-purple-400 text-purple-300 shadow-purple-500/50"
              colorInactive="from-purple-950/40 to-fuchsia-950/40 border-purple-900/60 text-purple-600 hover:text-purple-300 hover:border-purple-400/60 hover:shadow-purple-500/30"
            />
            <TabButton
              active={showTxs}
              onClick={() => openTab('txs')}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              label="TXS"
              colorActive="from-amber-500/30 to-orange-500/30 border-amber-400 text-amber-300 shadow-amber-500/50"
              colorInactive="from-amber-950/40 to-orange-950/40 border-amber-900/60 text-amber-600 hover:text-amber-300 hover:border-amber-400/60 hover:shadow-amber-500/30"
            />
            <TabButton
              active={showWallets}
              onClick={() => openTab('wallets')}
              icon={<ArrowsRightLeftIcon className="w-5 h-5" />}
              label="ACCTS"
              colorActive="from-cyan-500/30 to-blue-500/30 border-cyan-400 text-cyan-300 shadow-cyan-500/50"
              colorInactive="from-cyan-950/40 to-blue-950/40 border-cyan-900/60 text-cyan-600 hover:text-cyan-300 hover:border-cyan-400/60 hover:shadow-cyan-500/30"
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

          <TopUpTab
            show={showTopUp}
            selectedToken={props.selectedToken}
            setSelectedToken={props.setSelectedToken}
            topUpAmount={props.topUpAmount}
            setTopUpAmount={props.setTopUpAmount}
            isProcessing={props.isProcessing}
            topUpError={props.topUpError}
            topUpSuccess={props.topUpSuccess}
            onTopUp={props.onTopUp}
          />

          <WithdrawTab
            show={showWithdraw}
            withdrawTokenType={props.withdrawTokenType}
            setWithdrawTokenType={props.setWithdrawTokenType}
            withdrawAmount={props.withdrawAmount}
            setWithdrawAmount={props.setWithdrawAmount}
            isWithdrawing={props.isWithdrawing}
            marketCredit={marketCredit}
            topUpError={props.topUpError}
            topUpSuccess={props.topUpSuccess}
            onWithdraw={props.onWithdraw}
          />

          <AccountsTab
            show={showWallets}
            address={props.address}
            walletMode={walletMode}
            walletHistory={props.walletHistory}
            isSwitchingWallet={props.isSwitchingWallet}
            onSwitchWallet={props.onSwitchWallet}
            onRemoveFromHistory={props.onRemoveFromHistory}
            onSignOut={handleSignOut}
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

        </div>
      </motion.div>
    </div>
  )
}
