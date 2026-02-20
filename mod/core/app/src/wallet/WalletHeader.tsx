"use client";

import { useState, useEffect } from 'react'
import { userContext } from '@/context/UserContext'
import { WalletIcon } from '@heroicons/react/24/outline'
import { AnimatePresence } from 'framer-motion'
import { WalletAuthButton } from './WalletAuthButton'
import { text2color } from '@/utils'

import { useTokenExpiry } from './hooks/useTokenExpiry'
import { useBalances } from './hooks/useBalances'
import { useTransactions } from './hooks/useTransactions'
import { useTransfers } from './hooks/useTransfers'
import { useWalletAccounts } from './hooks/useWalletAccounts'
import { useNetwork } from './hooks/useNetwork'
import { useSidebarResize } from './hooks/useSidebarResize'
import { WalletSidebar } from './sidebar/WalletSidebar'

export function WalletHeader() {
  const { user, signOut, switchWallet, client } = userContext()
  const [isOpen, setIsOpen] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>('txs')

  const address = user?.key || ''
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
  const walletMode = user?.wallet_mode || ''
  const userColor = user ? text2color(user.key || '') : '#10b981'

  // Hooks
  const tokenExpiry = useTokenExpiry(!!user)
  const balances = useBalances(user?.key, client)
  const transactions = useTransactions(user?.key, client)
  const transfers = useTransfers({
    userKey: user?.key,
    walletMode: user?.wallet_mode || '',
    client,
    marketCredit: balances.marketCredit,
    tokenBalances: balances.tokenBalances,
    fetchMarketCredit: balances.fetchMarketCredit,
    fetchCustomTokenBalances: balances.fetchCustomTokenBalances,
  })
  const accounts = useWalletAccounts(user?.key, address, switchWallet)
  useNetwork(user?.key, client, balances.fetchMarketCredit)
  const sidebar = useSidebarResize()

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  const handleSignOut = () => {
    signOut()
    setIsOpen(false)
  }

  const openTab = (tab: string) => {
    setActiveTab(activeTab === tab ? null : tab)
    transfers.setSendFromPortfolio(null)
    if (tab === 'txs' && activeTab !== 'txs') transactions.fetchUserTransactions()
    if (tab === 'wallets') accounts.refreshHistory()
  }

  // Fetch txs when txs tab opens
  useEffect(() => {
    if (activeTab === 'txs' && user?.key) transactions.fetchUserTransactions()
  }, [activeTab])

  if (!user) {
    return <WalletAuthButton />
  }

  return (
    <div className="flex items-center gap-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center bg-[#0d0d0d] border-2 border-neutral-800 hover:bg-white/[0.03] hover:border-neutral-600 transition-all relative gap-2 px-3"
        style={{ height: '48px', borderRadius: '0px', fontFamily: 'IBM Plex Mono, monospace' }}
      >
        <WalletIcon className="w-5 h-5 text-neutral-400 flex-shrink-0" />
        <span className="text-sm font-black font-mono tabular-nums text-green-400">
          ${balances.marketCredit.toFixed(2)}
        </span>
        <span className="text-[10px] font-bold font-mono tabular-nums text-neutral-500">
          -{transactions.totalCost24h.toFixed(2)}/d
        </span>
        <span className={`text-[10px] font-bold font-mono tabular-nums ${tokenExpiry.isTokenExpired ? 'text-red-400' : 'text-cyan-500'}`}>
          {tokenExpiry.tokenExpiry || tokenExpiry.getTokenExpiry()}
        </span>
        <div
          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-sm transition-colors ${
            tokenExpiry.isTokenExpired ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
          }`}
          title={tokenExpiry.isTokenExpired ? 'Token Expired - Click to Refresh' : 'Connected'}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <WalletSidebar
            // Header
            shortAddress={shortAddress}
            walletMode={walletMode}
            copiedAddress={copiedAddress}
            copyAddress={copyAddress}
            tokenExpiry={tokenExpiry.tokenExpiry}
            getTokenExpiry={tokenExpiry.getTokenExpiry}
            isTokenExpired={tokenExpiry.isTokenExpired}
            isRefreshingToken={tokenExpiry.isRefreshing}
            handleRefreshToken={tokenExpiry.handleRefreshToken}
            handleSignOut={handleSignOut}
            onClose={() => setIsOpen(false)}
            marketCredit={balances.marketCredit}
            userColor={userColor}
            // Resize
            sidebarWidth={sidebar.sidebarWidth}
            isResizing={sidebar.isResizing}
            setIsResizing={sidebar.setIsResizing}
            // Tabs
            activeTab={activeTab}
            openTab={openTab}
            // Portfolio
            tokenBalances={balances.tokenBalances}
            customTokens={balances.customTokens}
            customTokenBalances={balances.customTokenBalances}
            sendFromPortfolio={transfers.sendFromPortfolio}
            setSendFromPortfolio={transfers.setSendFromPortfolio}
            transferRecipient={transfers.transferRecipient}
            setTransferRecipient={transfers.setTransferRecipient}
            transferAmount={transfers.transferAmount}
            setTransferAmount={transfers.setTransferAmount}
            isTransferring={transfers.isTransferring}
            setTransferTokenType={transfers.setTransferTokenType}
            topUpError={transfers.topUpError}
            setTopUpError={transfers.setTopUpError}
            topUpSuccess={transfers.topUpSuccess}
            setTopUpSuccess={transfers.setTopUpSuccess}
            showAddToken={balances.showAddToken}
            setShowAddToken={balances.setShowAddToken}
            newTokenAddress={balances.newTokenAddress}
            setNewTokenAddress={balances.setNewTokenAddress}
            isAddingToken={balances.isAddingToken}
            isRefreshingBalances={balances.isRefreshing}
            onRefreshBalances={balances.refreshAll}
            onTransfer={transfers.handleTransfer}
            onSendETH={transfers.handleSendETH}
            onSendCustomToken={transfers.handleSendCustomToken}
            onRemoveCustomToken={balances.handleRemoveCustomToken}
            onAddCustomToken={balances.handleAddCustomToken}
            // Top-up
            selectedToken={transfers.selectedToken}
            setSelectedToken={transfers.setSelectedToken}
            topUpAmount={transfers.topUpAmount}
            setTopUpAmount={transfers.setTopUpAmount}
            isProcessing={transfers.isProcessing}
            onTopUp={transfers.handleTopUpTransaction}
            // Withdraw
            withdrawTokenType={transfers.withdrawTokenType}
            setWithdrawTokenType={transfers.setWithdrawTokenType}
            withdrawAmount={transfers.withdrawAmount}
            setWithdrawAmount={transfers.setWithdrawAmount}
            isWithdrawing={transfers.isWithdrawing}
            onWithdraw={transfers.handleWithdraw}
            // Accounts
            address={address}
            walletHistory={accounts.walletHistory}
            isSwitchingWallet={accounts.isSwitchingWallet}
            onSwitchWallet={accounts.handleSwitchWallet}
            onRemoveFromHistory={accounts.handleRemoveFromHistory}
            // Transactions
            userTransactions={transactions.userTransactions}
            isLoadingTxs={transactions.isLoadingTxs}
            txsStatusFilter={transactions.txsStatusFilter}
            setTxsStatusFilter={transactions.setTxsStatusFilter}
            expandedTxIdx={transactions.expandedTxIdx}
            setExpandedTxIdx={transactions.setExpandedTxIdx}
            totalCost24h={transactions.totalCost24h}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default WalletHeader
