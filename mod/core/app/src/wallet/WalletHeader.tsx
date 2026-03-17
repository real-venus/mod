"use client";

import { useState, useEffect, useRef } from 'react'
import { userContext } from '@/context/UserContext'
import { ArrowRightStartOnRectangleIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { AnimatePresence, motion } from 'framer-motion'
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
import { NetworkSelector } from '@/network/NetworkSelector'

const WalletModeLogo = ({ mode, size = 16 }: { mode: string; size?: number }) => {
  const m = mode.toLowerCase()
  if (m.includes('metamask')) return (
    <svg width={size} height={size} viewBox="0 0 318.6 318.6" fill="none">
      <path d="M274.1 35.5l-99.5 73.9 18.4-43.6z" fill="#E17726" stroke="#E17726" strokeWidth="1.5"/>
      <path d="M44.4 35.5l98.7 74.6-17.5-44.3zm193.9 171.3l-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9L50.1 263l56.7-15.6-26.5-40.6z" fill="#E27625" stroke="#E27625" strokeWidth="1.5"/>
      <path d="M103.6 138.2l-15.8 23.9 56.3 2.5-2-60.5zm111.3 0l-39-34.8-1.3 61.2 56.2-2.5z" fill="#E27625" stroke="#E27625" strokeWidth="1.5"/>
      <path d="M267.2 153.5l-52.3-15.3 15.8 23.9-23.7 46 31.2-.4h46.5zm-163.6-15.3l-52.3 15.3-17.4 54.2h46.4l31.1.4-23.6-46zm71 26.4l3.3-57.7 15.2-41.1h-67.5l15 41.1 3.5 57.7 1.2 18.2.1 44.8h27.7l.2-44.8z" fill="#F5841F" stroke="#F5841F" strokeWidth="1.5"/>
    </svg>
  )
  if (m.includes('phantom')) return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="24" fill="url(#pg)"/>
      <path d="M96 64c0 17.673-14.327 32-32 32s-32-14.327-32-32V32h64v32z" fill="white"/>
      <circle cx="52" cy="58" r="6" fill="#AB9FF2"/><circle cx="76" cy="58" r="6" fill="#AB9FF2"/>
      <defs><linearGradient id="pg" x1="0" y1="0" x2="128" y2="128"><stop stopColor="#AB9FF2"/><stop offset="1" stopColor="#7C66DC"/></linearGradient></defs>
    </svg>
  )
  if (m.includes('subwallet')) return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="100" fill="url(#sg)"/>
      <path d="M100 40L60 80L100 120L140 80L100 40Z" fill="white"/>
      <path d="M100 120L60 160L100 200L140 160L100 120Z" fill="white" opacity="0.6"/>
      <defs><linearGradient id="sg" x1="0" y1="0" x2="200" y2="200"><stop stopColor="#00E5CC"/><stop offset="1" stopColor="#00B8D4"/></linearGradient></defs>
    </svg>
  )
  // local/default - key icon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="7" cy="7" r="4" fill="none"/><path d="M7 11V22M11 15H7M11 19H7"/>
    </svg>
  )
}

export function WalletHeader() {
  const { user, signOut, switchWallet, client } = userContext()
  const [isOpen, setIsOpen] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>('portfolio')
  const [showAccountsDropdown, setShowAccountsDropdown] = useState(false)
  const [showAuthSidebar, setShowAuthSidebar] = useState(false)
  const walletRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Close wallet sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletRef.current && !walletRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountsDropdown(false)
      }
    }

    if (isOpen || showAccountsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, showAccountsDropdown])

  const getWalletModeColor = (mode: string) => {
    const m = mode.toLowerCase()
    if (m.includes('metamask')) return '#f6851b'
    if (m.includes('phantom')) return '#ab9ff2'
    if (m.includes('subwallet')) return '#004bff'
    if (m.includes('coinbase')) return '#0052ff'
    return '#10b981'
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <NetworkSelector />
        <WalletAuthButton
          showAuthSidebar={showAuthSidebar}
          setShowAuthSidebar={setShowAuthSidebar}
        />
      </div>
    )
  }

  return (
    <div ref={walletRef} className="flex items-center gap-1.5">
      {/* Compact wallet bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-0 relative"
        style={{
          height: '42px',
          fontFamily: 'var(--font-digital), monospace',
          backgroundColor: 'var(--bg-input)',
          border: '2px solid var(--border-strong)',
          borderRadius: '0px',
        }}
      >
        {/* Address section */}
        <div
          onClick={(e) => { e.stopPropagation(); copyAddress() }}
          className="flex items-center gap-2 px-3 h-full transition-all hover:bg-[var(--hover-bg)] cursor-pointer"
          title="Copy address"
          role="button"
        >
          <div className="flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
            <WalletModeLogo mode={walletMode || 'local'} size={22} />
          </div>
          <span className="tabular-nums font-bold uppercase" style={{ fontSize: '16px', fontFamily: 'var(--font-digital)', color: copiedAddress ? '#22c55e' : 'var(--text-tertiary)' }}>
            {copiedAddress ? 'COPIED' : shortAddress}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-6" style={{ backgroundColor: 'var(--border-strong)' }} />

        {/* Credit section */}
        <div className="flex items-center gap-2 px-3 h-full hover:bg-[var(--hover-bg)] transition-all">
          <span className="tabular-nums font-bold" style={{ fontSize: '16px', fontFamily: 'var(--font-digital)', color: 'var(--text-primary)' }}>
            ${balances.marketCredit.toFixed(2)}
          </span>
          <span className="tabular-nums" style={{ fontSize: '14px', fontFamily: 'var(--font-digital)', color: 'var(--text-tertiary)' }}>
            -{transactions.totalCost24h.toFixed(2)}/D
          </span>
        </div>

        {/* Status dot */}
        <div
          className="absolute top-1 right-1 w-2 h-2"
          style={{
            backgroundColor: tokenExpiry.isTokenExpired ? '#ef4444' : '#22c55e',
          }}
          title={tokenExpiry.isTokenExpired ? 'Token Expired' : 'Connected'}
        />
      </button>

      {/* Token expiry - click to refresh */}
      {(tokenExpiry.tokenExpiry || tokenExpiry.getTokenExpiry()) && (() => {
        const dotColor = tokenExpiry.isTokenExpired ? '#ef4444' : '#22c55e'
        return (
          <button
            className="tabular-nums font-bold uppercase px-3 cursor-pointer select-none flex items-center justify-center gap-1.5"
            style={{
              height: '42px',
              fontSize: '14px',
              fontFamily: 'var(--font-digital)',
              backgroundColor: 'var(--bg-input)',
              color: tokenExpiry.isTokenExpired ? '#ef4444' : 'var(--text-tertiary)',
              border: `2px solid ${tokenExpiry.isTokenExpired ? 'rgba(239,68,68,0.4)' : 'var(--border-strong)'}`,
              borderRadius: '0px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
              e.currentTarget.style.borderColor = 'var(--accent-primary)'
              e.currentTarget.style.color = 'var(--accent-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-input)'
              e.currentTarget.style.borderColor = tokenExpiry.isTokenExpired ? 'rgba(239,68,68,0.4)' : 'var(--border-strong)'
              e.currentTarget.style.color = tokenExpiry.isTokenExpired ? '#ef4444' : 'var(--text-tertiary)'
            }}
            onClick={() => tokenExpiry.handleRefreshToken()}
            title="Click to refresh token"
          >
            <span className="w-1.5 h-1.5 flex-shrink-0" style={{ backgroundColor: dotColor }} />
            {tokenExpiry.tokenExpiry || tokenExpiry.getTokenExpiry()}
          </button>
        )
      })()}

      {/* Accounts dropdown toggle */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => {
            setShowAccountsDropdown(!showAccountsDropdown)
            if (!showAccountsDropdown) accounts.refreshHistory()
          }}
          className="flex items-center justify-center hover:bg-[var(--hover-bg)]"
          style={{
            height: '42px',
            width: '38px',
            fontFamily: 'var(--font-digital), monospace',
            backgroundColor: 'var(--bg-input)',
            border: `2px solid ${showAccountsDropdown ? 'var(--text-tertiary)' : 'var(--border-strong)'}`,
            borderRadius: '0px',
          }}
          title="Switch wallet"
        >
          <ChevronDownIcon
            className={`w-4 h-4 transition-transform ${showAccountsDropdown ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-tertiary)' }}
          />
        </button>

        {/* Accounts dropdown */}
        <AnimatePresence>
          {showAccountsDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 overflow-hidden z-[100]"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '3px solid var(--border-strong)',
                borderRadius: '0px',
                minWidth: '300px',
                boxShadow: '4px 4px 0px rgba(0,0,0,0.4)',
              }}
            >
              {/* Header */}
              <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '2px solid var(--border-strong)', backgroundColor: 'var(--bg-input)' }}>
                <div className="w-1.5 h-1.5" style={{ backgroundColor: userColor }} />
                <span className="text-[10px] font-digital uppercase font-bold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>WALLETS</span>
                <div className="flex-1" />
                <span className="text-[9px] font-digital uppercase tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                  {accounts.walletHistory.length}
                </span>
              </div>

              <div className="p-2 max-h-60 overflow-y-auto">
                {/* Current wallet */}
                <div
                  className="flex items-center gap-2.5 px-3 py-3 mb-1.5"
                  style={{
                    backgroundColor: `${userColor}15`,
                    border: `3px solid ${userColor}`,
                    fontFamily: 'var(--font-digital), monospace',
                  }}
                >
                  <div className="flex-shrink-0"><WalletModeLogo mode={walletMode} size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-digital font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                      {shortAddress}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-1.5 h-1.5" style={{ backgroundColor: tokenExpiry.isTokenExpired ? '#eab308' : '#22c55e' }} />
                      <span className="text-[9px] font-digital uppercase font-bold tabular-nums" style={{ color: tokenExpiry.isTokenExpired ? '#eab308' : '#22c55e' }}>
                        {tokenExpiry.isTokenExpired ? 'EXPIRED' : tokenExpiry.tokenExpiry || tokenExpiry.getTokenExpiry()}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[9px] font-digital uppercase px-2 py-1 font-bold"
                    style={{ color: userColor, backgroundColor: `${userColor}20`, border: `2px solid ${userColor}` }}
                  >
                    ACTIVE
                  </span>
                </div>

                {/* Previous wallets */}
                {accounts.walletHistory
                  .filter(w => w.address.toLowerCase() !== address.toLowerCase())
                  .sort((a, b) => b.lastUsed - a.lastUsed)
                  .map((wallet, i, arr) => (
                    <button
                      key={wallet.address}
                      onClick={() => {
                        accounts.handleSwitchWallet(wallet)
                        setShowAccountsDropdown(false)
                      }}
                      disabled={accounts.isSwitchingWallet}
                      className="w-full flex items-center gap-2.5 px-3 py-3 transition-all hover:bg-[var(--hover-bg)]"
                      style={{
                        fontFamily: 'var(--font-digital), monospace',
                        borderBottom: i < arr.length - 1 ? '2px solid var(--border-strong)' : 'none',
                      }}
                    >
                      <div className="flex-shrink-0"><WalletModeLogo mode={wallet.mode} size={16} /></div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="text-xs font-digital font-bold tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-digital uppercase font-bold tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                            {wallet.lastUsed ? (() => {
                              const ago = Math.floor(Date.now() / 1000 - wallet.lastUsed / 1000)
                              if (ago < 60) return `${ago}s ago`
                              if (ago < 3600) return `${Math.floor(ago / 60)}m ago`
                              if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`
                              return `${Math.floor(ago / 86400)}d ago`
                            })() : 'NO SESSION'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                {accounts.walletHistory.filter(w => w.address.toLowerCase() !== address.toLowerCase()).length === 0 && (
                  <div className="text-center py-3 text-[10px] font-digital uppercase" style={{ color: 'var(--text-tertiary)' }}>
                    No previous wallets
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Signout button */}
      <button
        onClick={handleSignOut}
        className="flex items-center justify-center hover:bg-red-500/10"
        style={{
          height: '42px',
          width: '38px',
          backgroundColor: 'var(--bg-input)',
          border: '2px solid var(--border-strong)',
          borderRadius: '0px',
          color: 'var(--text-tertiary)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
        title="Sign out"
      >
        <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
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
