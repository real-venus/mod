"use client";

import { useState, useEffect, useCallback } from 'react'
import {
  BuildingLibraryIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  UserIcon,
  KeyIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { ethers, EventLog } from 'ethers'
import TokenABI from '@/contracts/token/Token.sol/Token.json'
import MarketABI from '@/contracts/market/Market.sol/Market.json'
import modConfig from '@/config.json'
import { CopyButton } from '@/ui/CopyButton'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { userContext } from '@/context'
import { Treasury, type TreasuryInfo, type HolderInfo, type TokenBalance } from '@/network/Treasury'
import { isSafeContract, getSafeOwners, getSafeThreshold, isUserSafeOwner, proposeSafeTransaction, type SafeInfo } from '@/network/safe'
import { toast } from 'react-toastify'

export const dynamic = 'force-dynamic'

type Tab = 'overview' | 'deposits' | 'admin'

interface RevenueDataPoint {
  timestamp: number
  date: string
  revenue: number
  totalBalance: number
}

interface DepositEvent {
  funder: string
  token: string
  amount: string
  timestamp: number
  txHash: string
  blockNumber: number
}

// ── Animated number display ──
function AnimatedValue({ value, prefix = '', suffix = '', loading = false }: {
  value: string; prefix?: string; suffix?: string; loading?: boolean
}) {
  if (loading) return <span className="animate-pulse text-white/40">...</span>
  return <span>{prefix}{value}{suffix}</span>
}

// ── Glow card wrapper ──
function GlowCard({ children, color, delay = 0, className = '' }: {
  children: React.ReactNode; color: string; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className={`relative group ${className}`}
    >
      <div
        className="absolute -inset-[1px] rounded-xl opacity-40 group-hover:opacity-60 blur-sm transition-opacity duration-500"
        style={{ background: `linear-gradient(135deg, ${color}40, transparent 60%)` }}
      />
      <div className="relative bg-black/80 border border-white/[0.08] rounded-xl p-6 backdrop-blur-xl h-full">
        {children}
      </div>
    </motion.div>
  )
}

export default function TreasuryPage() {
  const { user } = userContext()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [treasury] = useState(() => new Treasury())

  // ── Overview state ──
  const [loading, setLoading] = useState(true)
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([])
  const [treasuryInfo, setTreasuryInfo] = useState<TreasuryInfo | null>(null)
  const [governanceToken, setGovernanceToken] = useState('')
  const [tokenGate, setTokenGate] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')
  const [revenueHistory, setRevenueHistory] = useState<RevenueDataPoint[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // ── MOD (NativeToken) state ──
  const [modTokenBalance, setModTokenBalance] = useState<string>('0')
  const [modTokenSupply, setModTokenSupply] = useState<string>('0')
  const [modTokenSymbol, setModTokenSymbol] = useState<string>('MOD')
  const [modTokenDecimals, setModTokenDecimals] = useState<number>(18)

  // ── Market balance state ──
  const [marketTotalSupply, setMarketTotalSupply] = useState<string>('0')
  const [marketUsdcBalance, setMarketUsdcBalance] = useState<string>('0')
  const [marketUsdtBalance, setMarketUsdtBalance] = useState<string>('0')
  const [marketFeePercent, setMarketFeePercent] = useState<number>(0)
  const [marketTotalFeesAccrued, setMarketTotalFeesAccrued] = useState<string>('0')
  const [marketClaimedFees, setMarketClaimedFees] = useState<string>('0')
  const [marketUnclaimedFees, setMarketUnclaimedFees] = useState<string>('0')
  const [marketTxCount, setMarketTxCount] = useState<number>(0)

  // ── Owner/Safe state ──
  const [isOwner, setIsOwner] = useState(false)
  const [isSafeSigner, setIsSafeSigner] = useState(false)
  const [isSafeOwned, setIsSafeOwned] = useState(false)
  const [safeOwners, setSafeOwners] = useState<string[]>([])
  const [safeThreshold, setSafeThreshold] = useState(0)

  // ── Holder state ──
  const [holderInfo, setHolderInfo] = useState<HolderInfo | null>(null)

  // ── Deposits state ──
  const [deposits, setDeposits] = useState<DepositEvent[]>([])
  const [depositsLoading, setDepositsLoading] = useState(false)

  // ── Admin form state ──
  const [adminLoading, setAdminLoading] = useState<string | null>(null)
  const [newOwnerPct, setNewOwnerPct] = useState('')
  const [newGovToken, setNewGovToken] = useState('')
  const [newTokenGate, setNewTokenGate] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [emergencyToken, setEmergencyToken] = useState('')
  const [emergencyAmount, setEmergencyAmount] = useState('')
  const [fundToken, setFundToken] = useState('')
  const [fundAmount, setFundAmount] = useState('')

  const walletAddress = user?.key || ''

  // ── Fetch treasury data ──
  const fetchData = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return

    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)

      const [info, owner, govToken, tGate, balances] = await Promise.all([
        treasury.getTreasuryInfo(),
        treasury.getOwner(),
        treasury.getGovernanceToken(),
        treasury.getTokenGate(),
        treasury.getTokenBalances(),
      ])

      setTreasuryInfo(info)
      setOwnerAddress(owner)
      setGovernanceToken(govToken)
      setTokenGate(tGate)
      setTokenBalances(balances)

      const totalBal = balances.reduce((s, b) => s + b.balance, 0)
      const dp: RevenueDataPoint = {
        timestamp: Date.now(),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        revenue: totalBal,
        totalBalance: totalBal,
      }
      setRevenueHistory(prev => [...prev, dp].slice(-30))
      setLastUpdate(new Date())

      // Fetch MOD (NativeToken) balance held by treasury
      try {
        const network = 'testnet'
        const nativeAddr = (modConfig.chain as any)?.[network]?.contracts?.NativeToken?.address
        if (nativeAddr) {
          const tokenContract = new ethers.Contract(nativeAddr, TokenABI.abi, provider)
          const [bal, supply, sym, dec] = await Promise.all([
            tokenContract.balanceOf(treasury.address),
            tokenContract.totalSupply(),
            tokenContract.symbol(),
            tokenContract.decimals(),
          ])
          const decimals = Number(dec)
          setModTokenDecimals(decimals)
          setModTokenBalance(ethers.formatUnits(bal, decimals))
          setModTokenSupply(ethers.formatUnits(supply, decimals))
          setModTokenSymbol(sym)
        }
      } catch (err) {
        console.warn('Could not fetch MOD token info:', err)
      }

      // Fetch Market contract balances
      try {
        const network = 'testnet'
        const chainConfig = (modConfig.chain as any)?.[network]
        const marketAddr = chainConfig?.contracts?.Market?.address
        const usdcAddr = chainConfig?.contracts?.USDC?.address
        const usdtAddr = chainConfig?.contracts?.USDT?.address
        if (marketAddr) {
          const marketContract = new ethers.Contract(marketAddr, MarketABI.abi, provider)
          const supply = await marketContract.totalSupply()
          setMarketTotalSupply(ethers.formatUnits(supply, 8))

          if (usdcAddr) {
            const usdcContract = new ethers.Contract(usdcAddr, TokenABI.abi, provider)
            const usdcBal = await usdcContract.balanceOf(marketAddr)
            const usdcDec = await usdcContract.decimals()
            setMarketUsdcBalance(ethers.formatUnits(usdcBal, Number(usdcDec)))
          }
          if (usdtAddr) {
            const usdtContract = new ethers.Contract(usdtAddr, TokenABI.abi, provider)
            const usdtBal = await usdtContract.balanceOf(marketAddr)
            const usdtDec = await usdtContract.decimals()
            setMarketUsdtBalance(ethers.formatUnits(usdtBal, Number(usdtDec)))
          }

          // Fetch market statistics
          const [feePercent, totalFees, claimedFees, unclaimedFees, txId] = await Promise.all([
            marketContract.TREASURY_FEE_PERCENT(),
            marketContract.totalTreasuryFeesAccrued(),
            marketContract.getClaimedTreasuryFeesUSD(),
            marketContract.getUnclaimedTreasuryFFeesUSD(),
            marketContract.nextTransactionId(),
          ])
          setMarketFeePercent(Number(feePercent))
          setMarketTotalFeesAccrued(ethers.formatUnits(totalFees, 8))
          setMarketClaimedFees(ethers.formatUnits(claimedFees, 8))
          setMarketUnclaimedFees(ethers.formatUnits(unclaimedFees, 8))
          setMarketTxCount(Number(txId))
        }
      } catch (err) {
        console.warn('Could not fetch Market balances:', err)
      }

      // Owner / Safe detection
      if (walletAddress) {
        const isDirectOwner = owner.toLowerCase() === walletAddress.toLowerCase()
        setIsOwner(isDirectOwner)

        if (!isDirectOwner) {
          const safeCheck = await isSafeContract(owner, provider)
          setIsSafeOwned(safeCheck)
          if (safeCheck) {
            const [owners, threshold, userIsSigner] = await Promise.all([
              getSafeOwners(owner, provider),
              getSafeThreshold(owner, provider),
              isUserSafeOwner(owner, walletAddress, provider),
            ])
            setSafeOwners(owners)
            setSafeThreshold(threshold)
            setIsSafeSigner(userIsSigner)
          }
        } else {
          // Check if address itself is a safe (owner is direct but could be a safe too)
          const safeCheck = await isSafeContract(owner, provider)
          setIsSafeOwned(safeCheck)
          if (safeCheck) {
            const [owners, threshold] = await Promise.all([
              getSafeOwners(owner, provider),
              getSafeThreshold(owner, provider),
            ])
            setSafeOwners(owners)
            setSafeThreshold(threshold)
          }
        }

        // Holder info
        try {
          const hInfo = await treasury.getHolderInfo(walletAddress)
          setHolderInfo(hInfo)
        } catch {
          setHolderInfo(null)
        }
      }
    } catch (err) {
      console.error('Error fetching treasury:', err)
    } finally {
      setLoading(false)
    }
  }, [walletAddress, treasury])

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 30000)
    return () => clearInterval(iv)
  }, [fetchData])

  // ── Fetch deposits ──
  const fetchDeposits = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return
    try {
      setDepositsLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const TreasuryABI = ['event TreasuryFunded(address indexed funder, address indexed token, uint256 amount)']
      const contract = new ethers.Contract(treasury.address, TreasuryABI, provider)
      const currentBlock = await provider.getBlockNumber()
      const fromBlock = Math.max(0, currentBlock - 10000)
      const events = await contract.queryFilter(contract.filters.TreasuryFunded(), fromBlock, currentBlock)
      const parsed = events.filter((e): e is EventLog => 'args' in e)
      const items: DepositEvent[] = await Promise.all(
        parsed.map(async (ev) => {
          const block = await ev.getBlock()
          let sym = 'UNKNOWN'; let dec = 18
          try {
            const tc = new ethers.Contract(ev.args.token, ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'], provider)
            sym = await tc.symbol(); dec = await tc.decimals()
          } catch {}
          return {
            funder: ev.args.funder, token: sym,
            amount: ethers.formatUnits(ev.args.amount, dec),
            timestamp: block.timestamp, txHash: ev.transactionHash, blockNumber: ev.blockNumber,
          }
        })
      )
      items.sort((a, b) => b.timestamp - a.timestamp)
      setDeposits(items)
    } catch (err) {
      console.error('Error fetching deposits:', err)
    } finally {
      setDepositsLoading(false)
    }
  }, [treasury])

  useEffect(() => {
    if (activeTab === 'deposits') fetchDeposits()
  }, [activeTab, fetchDeposits])

  const canAdmin = isOwner || isSafeSigner
  const totalBalance = tokenBalances.reduce((s, b) => s + b.balance, 0)
  const ownerPctDisplay = treasuryInfo ? (Number(treasuryInfo.ownerPct) / 100).toFixed(2) : '0'

  // ── Admin actions ──
  async function execAdminAction(label: string, fn: () => Promise<any>) {
    if (!walletAddress) { toast.error('Connect wallet first'); return }
    setAdminLoading(label)
    try {
      await fn()
      toast.success(`${label} successful`)
      fetchData()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || `${label} failed`)
    } finally {
      setAdminLoading(null)
    }
  }

  async function handleSafePropose(fnName: string, args: any[], label: string) {
    if (!walletAddress) { toast.error('Connect wallet first'); return }
    setAdminLoading(label)
    try {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner(walletAddress)
      const data = treasury.encodeFunctionData(fnName, args)
      const network = await provider.getNetwork()
      const txHash = await proposeSafeTransaction(ownerAddress, treasury.address, data, signer, network.chainId)
      toast.success(`Safe transaction proposed: ${txHash.slice(0, 10)}...`)
      fetchData()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || `${label} failed`)
    } finally {
      setAdminLoading(null)
    }
  }

  function handleAdminTx(fnName: string, args: any[], label: string, directFn: () => Promise<any>) {
    if (isSafeSigner && !isOwner) {
      handleSafePropose(fnName, args, label)
    } else {
      execAdminAction(label, directFn)
    }
  }

  // ── Holder actions ──
  async function handleWithdrawToken(tokenAddr: string, symbol: string) {
    execAdminAction(`Withdraw ${symbol}`, () => treasury.withdrawToken(walletAddress, tokenAddr))
  }

  async function handleWithdrawAll() {
    execAdminAction('Withdraw All', () => treasury.withdrawAll(walletAddress))
  }

  async function handleFundTreasury() {
    if (!fundToken || !fundAmount) { toast.error('Enter token and amount'); return }
    const tokenAddr = getTokenAddressFromSymbol(fundToken)
    if (!tokenAddr) { toast.error('Unknown token'); return }
    const decimals = tokenBalances.find(t => t.symbol === fundToken)?.decimals || 18
    const amount = ethers.parseUnits(fundAmount, decimals)

    // Approve first
    execAdminAction('Fund Treasury', async () => {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner(walletAddress)
      const tokenContract = new ethers.Contract(tokenAddr, [
        'function approve(address,uint256) returns (bool)',
      ], signer)
      const approveTx = await tokenContract.approve(treasury.address, amount)
      await approveTx.wait()
      await treasury.fundTreasury(walletAddress, tokenAddr, amount)
    })
  }

  function getTokenAddressFromSymbol(symbol: string): string | null {
    const network = 'testnet'
    const chainConfig = (modConfig.chain as any)?.[network]
    if (!chainConfig) return null
    for (const [, val] of Object.entries(chainConfig.contracts)) {
      const v = val as any
      if (v.address) {
        const match = tokenBalances.find(t => t.address.toLowerCase() === v.address.toLowerCase() && t.symbol === symbol)
        if (match) return match.address
      }
    }
    return tokenBalances.find(t => t.symbol === symbol)?.address || null
  }

  // ── Tab config ──
  const tabs: { key: Tab; label: string; color: string; show: boolean }[] = [
    { key: 'overview', label: 'OVERVIEW', color: '#a855f7', show: true },
    { key: 'deposits', label: 'DEPOSITS', color: '#ec4899', show: true },
    { key: 'admin', label: 'ADMIN', color: '#f59e0b', show: canAdmin },
  ]

  if (!treasury.address) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-purple-400 text-xl font-mono">Treasury not configured</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
      {/* Background grid effect */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(168,85,247,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 p-6 md:p-8 max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center gap-4"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="relative">
              <div className="w-14 h-14 flex items-center justify-center border border-purple-500/50 rounded-xl bg-purple-500/10">
                <BuildingLibraryIcon className="w-8 h-8 text-purple-400" />
              </div>
              <div className="absolute -inset-1 rounded-xl bg-purple-500/20 blur-md -z-10 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Treasury</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white/40 font-mono text-sm">
                  {treasury.address.slice(0, 6)}...{treasury.address.slice(-4)}
                </span>
                <CopyButton text={treasury.address} size="sm" />
                {isSafeOwned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-500/15 border border-green-500/30 text-green-400 rounded-sm">
                    <ShieldCheckIcon className="w-3 h-3" /> MULTISIG
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Owner badge */}
          {canAdmin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg"
              style={{
                borderColor: 'rgba(245, 158, 11, 0.3)',
                background: 'rgba(245, 158, 11, 0.06)',
              }}
            >
              <ShieldCheckIcon className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
                {isOwner ? 'Owner' : 'Safe Signer'}
              </span>
            </motion.div>
          )}

          {/* Refresh */}
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-white/10 hover:border-purple-500/30 rounded-lg transition-all text-white/40 hover:text-purple-400 text-xs font-bold uppercase tracking-wider"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </motion.div>

        {/* ── Sub-navigation tabs ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-1 border-b border-white/[0.06] pb-0"
        >
          {tabs.filter(t => t.show).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-4 py-3 text-[13px] font-extrabold uppercase tracking-[0.12em] transition-colors"
              style={{
                color: activeTab === tab.key ? tab.color : 'rgba(255,255,255,0.3)',
              }}
            >
              {tab.label}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="treasuryTab"
                  className="absolute bottom-0 left-2 right-2"
                  style={{ height: '2px', background: tab.color, boxShadow: `0 0 8px ${tab.color}80` }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 text-white/20 text-[11px] font-mono pb-2">
            <ClockIcon className="w-3.5 h-3.5" />
            {lastUpdate.toLocaleTimeString()}
          </div>
        </motion.div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <GlowCard color="#22c55e" delay={0.1}>
                  <div className="flex items-center gap-2 mb-3">
                    <BanknotesIcon className="w-5 h-5 text-green-400" />
                    <span className="text-green-400/70 text-[11px] font-bold uppercase tracking-wider">Total Balance</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">
                    <AnimatedValue value={totalBalance.toFixed(2)} prefix="$" loading={loading} />
                  </p>
                </GlowCard>

                {tokenBalances.map((tb, i) => (
                  <GlowCard key={tb.address} color="#3b82f6" delay={0.15 + i * 0.05}>
                    <div className="flex items-center gap-2 mb-3">
                      <CurrencyDollarIcon className="w-5 h-5 text-blue-400" />
                      <span className="text-blue-400/70 text-[11px] font-bold uppercase tracking-wider">{tb.symbol}</span>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-white">
                      <AnimatedValue value={tb.balance.toFixed(2)} prefix="$" loading={loading} />
                    </p>
                  </GlowCard>
                ))}

                <GlowCard color="#f59e0b" delay={0.25}>
                  <div className="flex items-center gap-2 mb-3">
                    <CurrencyDollarIcon className="w-5 h-5 text-amber-400" />
                    <span className="text-amber-400/70 text-[11px] font-bold uppercase tracking-wider">{modTokenSymbol} Token</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">
                    <AnimatedValue value={parseFloat(modTokenBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })} loading={loading} />
                  </p>
                  <p className="text-white/30 text-[10px] font-mono mt-1">
                    Supply: {parseFloat(modTokenSupply).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </GlowCard>

                <GlowCard color="#a855f7" delay={0.3}>
                  <div className="flex items-center gap-2 mb-3">
                    <ChartBarIcon className="w-5 h-5 text-purple-400" />
                    <span className="text-purple-400/70 text-[11px] font-bold uppercase tracking-wider">Owner Share</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">
                    <AnimatedValue value={ownerPctDisplay} suffix="%" loading={loading} />
                  </p>
                </GlowCard>
              </div>

              {/* ── Market Statistics ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <GlowCard color="#ec4899" delay={0.32}>
                  <div className="flex items-center gap-2 mb-3">
                    <ChartBarIcon className="w-5 h-5 text-pink-400" />
                    <span className="text-pink-400/70 text-[11px] font-bold uppercase tracking-wider">Treasury Fee</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">
                    <AnimatedValue value={String(marketFeePercent)} suffix="%" loading={loading} />
                  </p>
                  <p className="text-white/30 text-[10px] font-mono mt-1">Cut on each debit</p>
                </GlowCard>

                <GlowCard color="#ec4899" delay={0.34}>
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowTrendingUpIcon className="w-5 h-5 text-pink-400" />
                    <span className="text-pink-400/70 text-[11px] font-bold uppercase tracking-wider">Transactions</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">
                    <AnimatedValue value={marketTxCount.toLocaleString()} loading={loading} />
                  </p>
                  <p className="text-white/30 text-[10px] font-mono mt-1">Total market txns</p>
                </GlowCard>

                <GlowCard color="#ec4899" delay={0.36}>
                  <div className="flex items-center gap-2 mb-3">
                    <BanknotesIcon className="w-5 h-5 text-pink-400" />
                    <span className="text-pink-400/70 text-[11px] font-bold uppercase tracking-wider">Fees Accrued</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">
                    <AnimatedValue value={parseFloat(marketTotalFeesAccrued).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} prefix="$" loading={loading} />
                  </p>
                  <p className="text-white/30 text-[10px] font-mono mt-1">Lifetime treasury revenue</p>
                </GlowCard>

                <GlowCard color="#10b981" delay={0.38}>
                  <div className="flex items-center gap-2 mb-3">
                    <CurrencyDollarIcon className="w-5 h-5 text-emerald-400" />
                    <span className="text-emerald-400/70 text-[11px] font-bold uppercase tracking-wider">Unclaimed Fees</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-400">
                    <AnimatedValue value={parseFloat(marketUnclaimedFees).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} prefix="$" loading={loading} />
                  </p>
                  <p className="text-white/30 text-[10px] font-mono mt-1">Available to claim</p>
                </GlowCard>
              </div>

              {/* ── Token Portfolio & Fee Breakdown ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Token Portfolio */}
                <GlowCard color="#ec4899" delay={0.4}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ChartBarIcon className="w-5 h-5 text-pink-400" />
                      <span className="text-white font-bold text-lg">Market Portfolio</span>
                    </div>
                    <span className="text-white/30 text-[10px] font-mono">
                      Supply: ${parseFloat(marketTotalSupply).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Stacked bar */}
                  {(() => {
                    const usdc = parseFloat(marketUsdcBalance)
                    const usdt = parseFloat(marketUsdtBalance)
                    const total = usdc + usdt
                    const usdcPct = total > 0 ? (usdc / total) * 100 : 50
                    const usdtPct = total > 0 ? (usdt / total) * 100 : 50
                    return (
                      <>
                        <div className="w-full h-4 bg-white/[0.06] rounded-full overflow-hidden flex mb-4">
                          <div
                            className="h-full transition-all duration-700"
                            style={{ width: `${usdcPct}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }}
                          />
                          <div
                            className="h-full transition-all duration-700"
                            style={{ width: `${usdtPct}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)' }}
                          />
                        </div>

                        {/* USDC row */}
                        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-blue-500/[0.04] border border-blue-500/10 mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <div>
                              <span className="text-white font-bold text-sm">USDC</span>
                              <span className="text-blue-400/60 text-[10px] ml-2 font-bold uppercase tracking-wider">USD Coin</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-bold font-mono text-sm">
                              ${usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-blue-400/60 text-[10px] font-mono">{usdcPct.toFixed(1)}%</p>
                          </div>
                        </div>

                        {/* USDT row */}
                        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-green-500/[0.04] border border-green-500/10">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <div>
                              <span className="text-white font-bold text-sm">USDT</span>
                              <span className="text-green-400/60 text-[10px] ml-2 font-bold uppercase tracking-wider">Tether</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-bold font-mono text-sm">
                              ${usdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-green-400/60 text-[10px] font-mono">{usdtPct.toFixed(1)}%</p>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </GlowCard>

                {/* Fee Accrual Breakdown */}
                <GlowCard color="#a855f7" delay={0.42}>
                  <div className="flex items-center gap-2 mb-4">
                    <ArrowTrendingUpIcon className="w-5 h-5 text-purple-400" />
                    <span className="text-white font-bold text-lg">Fee Accrual</span>
                  </div>

                  {/* Claimed vs Unclaimed bar */}
                  {(() => {
                    const claimed = parseFloat(marketClaimedFees)
                    const unclaimed = parseFloat(marketUnclaimedFees)
                    const total = parseFloat(marketTotalFeesAccrued)
                    const claimedPct = total > 0 ? (claimed / total) * 100 : 0
                    const unclaimedPct = total > 0 ? (unclaimed / total) * 100 : 0
                    return (
                      <>
                        <div className="mb-4">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                            <span className="text-white/40">Claim Progress</span>
                            <span className="text-white font-mono">{claimedPct.toFixed(1)}% claimed</span>
                          </div>
                          <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden flex">
                            <div
                              className="h-full transition-all duration-700"
                              style={{ width: `${claimedPct}%`, background: 'linear-gradient(90deg, #a855f7, #c084fc)' }}
                            />
                            <div
                              className="h-full transition-all duration-700"
                              style={{ width: `${unclaimedPct}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] mt-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-purple-500" />
                              <span className="text-white/25">Claimed</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-white/25">Unclaimed</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="py-2 px-3 bg-white/[0.02] rounded-lg">
                            <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider mb-1">Total Accrued</p>
                            <p className="text-white font-bold font-mono text-sm">
                              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="py-2 px-3 bg-white/[0.02] rounded-lg">
                            <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider mb-1">Claimed</p>
                            <p className="text-purple-400 font-bold font-mono text-sm">
                              ${claimed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="py-2 px-3 bg-white/[0.02] rounded-lg">
                            <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider mb-1">Unclaimed</p>
                            <p className="text-emerald-400 font-bold font-mono text-sm">
                              ${unclaimed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </GlowCard>
              </div>

              {/* ── Your Credit & Withdraw ── */}
              {walletAddress && holderInfo && (
                <GlowCard color="#10b981" delay={0.32}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ArrowDownTrayIcon className="w-5 h-5 text-emerald-400" />
                      <span className="text-white font-bold text-lg">Your Credit</span>
                    </div>
                    <span className="text-white/30 text-xs font-mono">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2 text-white/40 text-sm">
                      <UserIcon className="w-4 h-4" />
                      <span>Ownership: <span className="text-white font-bold">{(Number(holderInfo.ownershipPercentage) / 100).toFixed(2)}%</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-white/40 text-sm">
                      <ChartBarIcon className="w-4 h-4" />
                      <span>Gov Balance: <span className="text-white font-bold">{parseFloat(ethers.formatUnits(holderInfo.governanceBalance, tokenBalances.find(t => t.address.toLowerCase() === governanceToken.toLowerCase())?.decimals ?? modTokenDecimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
                    </div>
                  </div>

                  {holderInfo.tokens.length > 0 && (
                    <div className="space-y-2">
                      {holderInfo.tokens.map((token, i) => {
                        const bal = tokenBalances.find(b => b.address.toLowerCase() === token.toLowerCase())
                        const claimable = holderInfo.claimableAmounts[i]
                        const claimed = holderInfo.claimedAmounts[i]
                        const claimableFormatted = ethers.formatUnits(claimable, bal?.decimals || 18)
                        const claimedFormatted = ethers.formatUnits(claimed, bal?.decimals || 18)
                        const isStable = bal?.symbol === 'USDC' || bal?.symbol === 'USDT'
                        return (
                          <div key={token} className="flex items-center justify-between py-3 px-4 rounded-lg border"
                            style={{
                              background: isStable ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                              borderColor: isStable ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                            }}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-bold">{bal?.symbol || token.slice(0, 8)}</span>
                                {isStable && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/70 rounded-sm">
                                    Stablecoin
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-white/30 text-[11px] font-mono">
                                  claimed: {parseFloat(claimedFormatted).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-emerald-400 font-bold font-mono text-lg">{parseFloat(claimableFormatted).toFixed(4)}</p>
                                <p className="text-white/20 text-[10px]">available</p>
                              </div>
                              <button
                                onClick={() => handleWithdrawToken(token, bal?.symbol || 'Token')}
                                disabled={adminLoading !== null || claimable === BigInt(0)}
                                className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 transition-all rounded-lg"
                              >
                                {adminLoading === `Withdraw ${bal?.symbol || 'Token'}` ? 'Processing...' : 'Withdraw'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleWithdrawAll}
                          disabled={adminLoading !== null}
                          className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-30 transition-all rounded-lg flex items-center gap-2"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          {adminLoading === 'Withdraw All' ? 'Processing...' : 'Withdraw All'}
                        </button>
                      </div>
                    </div>
                  )}

                  {holderInfo.tokens.length === 0 && (
                    <div className="py-6 text-center text-white/30 text-sm">No claimable credit yet</div>
                  )}
                </GlowCard>
              )}

              {/* ── USDC / USDT Limits ── */}
              {treasuryInfo && tokenBalances.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tokenBalances
                    .filter(tb => tb.symbol === 'USDC' || tb.symbol === 'USDT')
                    .map((tb, idx) => {
                      const tokenIdx = treasuryInfo.tokens.findIndex(
                        t => t.toLowerCase() === tb.address.toLowerCase()
                      )
                      const totalClaimed = tokenIdx >= 0
                        ? parseFloat(ethers.formatUnits(treasuryInfo.totalClaimedAmounts[tokenIdx], tb.decimals))
                        : 0
                      const totalDeposited = tb.balance + totalClaimed
                      const availableForClaims = tb.balance * (1 - Number(treasuryInfo.ownerPct) / 10000)
                      const ownerShare = tb.balance * (Number(treasuryInfo.ownerPct) / 10000)
                      const utilizationPct = totalDeposited > 0
                        ? ((totalClaimed / totalDeposited) * 100)
                        : 0

                      return (
                        <GlowCard key={tb.address} color={tb.symbol === 'USDC' ? '#3b82f6' : '#22c55e'} delay={0.34 + idx * 0.05}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <CurrencyDollarIcon className={`w-5 h-5 ${tb.symbol === 'USDC' ? 'text-blue-400' : 'text-green-400'}`} />
                              <span className="text-white font-bold text-lg">{tb.symbol} Limits</span>
                            </div>
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-sm ${
                              tb.symbol === 'USDC'
                                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400/80'
                                : 'bg-green-500/10 border border-green-500/20 text-green-400/80'
                            }`}>
                              {tb.symbol === 'USDC' ? 'USD Coin' : 'Tether'}
                            </span>
                          </div>

                          {/* Balance bar */}
                          <div className="mb-4">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                              <span className="text-white/40">Treasury Balance</span>
                              <span className="text-white font-mono">${tb.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.min(utilizationPct, 100)}%`,
                                  background: tb.symbol === 'USDC'
                                    ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                                    : 'linear-gradient(90deg, #22c55e, #4ade80)',
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] mt-1">
                              <span className="text-white/25">{utilizationPct.toFixed(1)}% utilized</span>
                              <span className="text-white/25">total deposited: ${totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="py-2 px-3 bg-white/[0.02] rounded-lg">
                              <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider mb-1">Holder Pool</p>
                              <p className="text-white font-bold font-mono text-sm">${availableForClaims.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="py-2 px-3 bg-white/[0.02] rounded-lg">
                              <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider mb-1">Owner Share</p>
                              <p className="text-amber-400 font-bold font-mono text-sm">${ownerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="py-2 px-3 bg-white/[0.02] rounded-lg">
                              <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider mb-1">Total Claimed</p>
                              <p className="text-purple-400 font-bold font-mono text-sm">${totalClaimed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        </GlowCard>
                      )
                    })}
                </div>
              )}

              {/* Revenue Chart */}
              {revenueHistory.length > 1 && (
                <GlowCard color="#a855f7" delay={0.35}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ArrowTrendingUpIcon className="w-5 h-5 text-purple-400" />
                      <span className="text-white font-bold text-lg">Balance History</span>
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueHistory}>
                        <defs>
                          <linearGradient id="treasuryGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis dataKey="date" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '8px', color: '#fff', fontFamily: 'IBM Plex Mono' }}
                          formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, 'Balance']}
                        />
                        <Area type="monotone" dataKey="totalBalance" stroke="#a855f7" strokeWidth={2} fill="url(#treasuryGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </GlowCard>
              )}

              {/* Contract Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GlowCard color="#8b5cf6" delay={0.4}>
                  <h3 className="text-white/60 text-[11px] font-bold uppercase tracking-wider mb-3">Owner</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-sm break-all">{ownerAddress || '...'}</span>
                    {ownerAddress && <CopyButton text={ownerAddress} size="sm" />}
                  </div>
                </GlowCard>

                {governanceToken && governanceToken !== ethers.ZeroAddress && (
                  <GlowCard color="#8b5cf6" delay={0.45}>
                    <h3 className="text-white/60 text-[11px] font-bold uppercase tracking-wider mb-3">Governance Token</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm break-all">{governanceToken}</span>
                      <CopyButton text={governanceToken} size="sm" />
                    </div>
                  </GlowCard>
                )}
              </div>

              {/* Fund Treasury */}
              {walletAddress && (
                <GlowCard color="#8b5cf6" delay={0.5}>
                  <div className="flex items-center gap-2 mb-4">
                    <ArrowUpTrayIcon className="w-5 h-5 text-purple-400" />
                    <span className="text-white font-bold">Fund Treasury</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={fundToken}
                      onChange={e => setFundToken(e.target.value)}
                      className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-purple-500/50 flex-1"
                      style={{ fontFamily: 'inherit' }}
                    >
                      <option value="">Select token</option>
                      {tokenBalances.map(t => (
                        <option key={t.address} value={t.symbol}>{t.symbol}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Amount"
                      value={fundAmount}
                      onChange={e => setFundAmount(e.target.value)}
                      className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
                    />
                    <button
                      onClick={handleFundTreasury}
                      disabled={adminLoading !== null || !fundToken || !fundAmount}
                      className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 disabled:opacity-30 transition-all rounded-sm whitespace-nowrap"
                    >
                      {adminLoading === 'Fund Treasury' ? 'Processing...' : 'Fund'}
                    </button>
                  </div>
                </GlowCard>
              )}

              {/* Safe Info */}
              {isSafeOwned && (
                <GlowCard color="#22c55e" delay={0.55}>
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheckIcon className="w-5 h-5 text-green-400" />
                    <span className="text-white font-bold">Multisig (Safe)</span>
                    <span className="text-green-400/60 text-xs font-mono ml-2">
                      Threshold: {safeThreshold}/{safeOwners.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {safeOwners.map((addr, i) => (
                      <div key={addr} className="flex items-center gap-2 py-1.5 px-3 bg-white/[0.02] rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${addr.toLowerCase() === walletAddress.toLowerCase() ? 'bg-green-400' : 'bg-white/20'}`} />
                        <span className="text-white font-mono text-sm">{addr.slice(0, 6)}...{addr.slice(-4)}</span>
                        <CopyButton text={addr} size="sm" />
                        {addr.toLowerCase() === walletAddress.toLowerCase() && (
                          <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider ml-auto">You</span>
                        )}
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}
            </motion.div>
          )}

          {/* ── Deposits Tab ── */}
          {activeTab === 'deposits' && (
            <motion.div
              key="deposits"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Deposit Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlowCard color="#22c55e" delay={0.1}>
                  <div className="flex items-center gap-2 mb-3">
                    <BanknotesIcon className="w-5 h-5 text-green-400" />
                    <span className="text-green-400/70 text-[11px] font-bold uppercase tracking-wider">Total Deposits</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    <AnimatedValue
                      value={deposits.reduce((s, d) => s + parseFloat(d.amount), 0).toFixed(2)}
                      prefix="$"
                      loading={depositsLoading}
                    />
                  </p>
                </GlowCard>

                <GlowCard color="#3b82f6" delay={0.15}>
                  <div className="flex items-center gap-2 mb-3">
                    <ClockIcon className="w-5 h-5 text-blue-400" />
                    <span className="text-blue-400/70 text-[11px] font-bold uppercase tracking-wider">Events</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    <AnimatedValue value={String(deposits.length)} loading={depositsLoading} />
                  </p>
                </GlowCard>

                <GlowCard color="#a855f7" delay={0.2}>
                  <div className="flex items-center gap-2 mb-3">
                    <UserGroupIcon className="w-5 h-5 text-purple-400" />
                    <span className="text-purple-400/70 text-[11px] font-bold uppercase tracking-wider">Unique Funders</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    <AnimatedValue value={String(new Set(deposits.map(d => d.funder)).size)} loading={depositsLoading} />
                  </p>
                </GlowCard>
              </div>

              {/* Deposits Table */}
              <GlowCard color="#a855f7" delay={0.25}>
                <h3 className="text-white font-bold mb-4">Recent Deposits</h3>
                {depositsLoading ? (
                  <div className="py-12 text-center text-white/30 text-sm">Loading deposits...</div>
                ) : deposits.length === 0 ? (
                  <div className="py-12 text-center text-white/30 text-sm">No deposits found in recent blocks</div>
                ) : (
                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="px-6 py-3 text-left text-white/30 text-[10px] font-bold uppercase tracking-wider">Funder</th>
                          <th className="px-6 py-3 text-left text-white/30 text-[10px] font-bold uppercase tracking-wider">Token</th>
                          <th className="px-6 py-3 text-right text-white/30 text-[10px] font-bold uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-3 text-left text-white/30 text-[10px] font-bold uppercase tracking-wider">Time</th>
                          <th className="px-6 py-3 text-left text-white/30 text-[10px] font-bold uppercase tracking-wider">Tx</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deposits.map((dep, idx) => (
                          <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white font-mono text-sm">{dep.funder.slice(0,6)}...{dep.funder.slice(-4)}</span>
                                <CopyButton text={dep.funder} size="sm" />
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <span className="text-purple-400 font-bold text-sm">{dep.token}</span>
                            </td>
                            <td className="px-6 py-3 text-right">
                              <span className="text-emerald-400 font-bold font-mono text-sm">${parseFloat(dep.amount).toFixed(2)}</span>
                            </td>
                            <td className="px-6 py-3">
                              <span className="text-white/40 text-xs">{new Date(dep.timestamp * 1000).toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white/50 font-mono text-xs">{dep.txHash.slice(0,8)}...{dep.txHash.slice(-6)}</span>
                                <CopyButton text={dep.txHash} size="sm" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlowCard>
            </motion.div>
          )}

          {/* ── Admin Tab ── */}
          {activeTab === 'admin' && canAdmin && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Admin header */}
              <div className="relative">
                <div className="absolute -inset-[1px] rounded-xl opacity-50 blur-sm"
                  style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(245,158,11,0.05) 60%)' }}
                />
                <div className="relative bg-black/80 border border-amber-500/20 rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <ShieldCheckIcon className="w-6 h-6 text-amber-400" />
                    <div>
                      <h2 className="text-white font-bold text-lg">Admin Controls</h2>
                      <p className="text-amber-400/60 text-xs font-mono">
                        {isOwner ? 'Direct owner — transactions execute immediately' : `Safe signer — transactions proposed to multisig (${safeThreshold}/${safeOwners.length})`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner Withdrawals */}
              <GlowCard color="#f59e0b" delay={0.1}>
                <div className="flex items-center gap-2 mb-4">
                  <ArrowUpTrayIcon className="w-5 h-5 text-amber-400" />
                  <span className="text-white font-bold">Owner Withdrawals</span>
                </div>
                <div className="space-y-2">
                  {tokenBalances.map(tb => (
                    <div key={tb.address} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg">
                      <div>
                        <span className="text-white font-bold text-sm">{tb.symbol}</span>
                        <span className="text-white/30 text-xs ml-2">balance: ${tb.balance.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => handleAdminTx(
                          'ownerWithdraw', [tb.address],
                          `Owner Withdraw ${tb.symbol}`,
                          () => treasury.ownerWithdraw(walletAddress, tb.address)
                        )}
                        disabled={adminLoading !== null}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 disabled:opacity-30 transition-all rounded-sm"
                      >
                        {adminLoading === `Owner Withdraw ${tb.symbol}` ? 'Processing...' : isSafeSigner && !isOwner ? 'Propose Withdraw' : 'Withdraw'}
                      </button>
                    </div>
                  ))}
                </div>
              </GlowCard>

              {/* Settings */}
              <GlowCard color="#8b5cf6" delay={0.2}>
                <div className="flex items-center gap-2 mb-5">
                  <Cog6ToothIcon className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-bold">Settings</span>
                </div>
                <div className="space-y-5">
                  {/* Owner Percentage */}
                  <div>
                    <label className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2 block">
                      Owner Percentage (current: {ownerPctDisplay}%)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="e.g. 500 = 5%"
                        value={newOwnerPct}
                        onChange={e => setNewOwnerPct(e.target.value)}
                        className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
                      />
                      <button
                        onClick={() => handleAdminTx(
                          'setOwnerPercentage', [Number(newOwnerPct)],
                          'Set Owner %',
                          () => treasury.setOwnerPercentage(walletAddress, Number(newOwnerPct))
                        )}
                        disabled={adminLoading !== null || !newOwnerPct}
                        className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 transition-all rounded-sm whitespace-nowrap"
                      >
                        {adminLoading === 'Set Owner %' ? '...' : 'Update'}
                      </button>
                    </div>
                  </div>

                  {/* Governance Token */}
                  <div>
                    <label className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2 block">
                      Governance Token
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="0x..."
                        value={newGovToken}
                        onChange={e => setNewGovToken(e.target.value)}
                        className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
                      />
                      <button
                        onClick={() => handleAdminTx(
                          'setGovernanceToken', [newGovToken],
                          'Set Gov Token',
                          () => treasury.setGovernanceToken(walletAddress, newGovToken)
                        )}
                        disabled={adminLoading !== null || !newGovToken}
                        className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 transition-all rounded-sm whitespace-nowrap"
                      >
                        {adminLoading === 'Set Gov Token' ? '...' : 'Update'}
                      </button>
                    </div>
                  </div>

                  {/* Token Gate */}
                  <div>
                    <label className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2 block">
                      Token Gate
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="0x..."
                        value={newTokenGate}
                        onChange={e => setNewTokenGate(e.target.value)}
                        className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
                      />
                      <button
                        onClick={() => handleAdminTx(
                          'setTokenGate', [newTokenGate],
                          'Set Token Gate',
                          () => treasury.setTokenGate(walletAddress, newTokenGate)
                        )}
                        disabled={adminLoading !== null || !newTokenGate}
                        className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 transition-all rounded-sm whitespace-nowrap"
                      >
                        {adminLoading === 'Set Token Gate' ? '...' : 'Update'}
                      </button>
                    </div>
                  </div>
                </div>
              </GlowCard>

              {/* Emergency Withdraw */}
              <GlowCard color="#ef4444" delay={0.3}>
                <div className="flex items-center gap-2 mb-4">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                  <span className="text-white font-bold">Emergency Withdraw</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={emergencyToken}
                    onChange={e => setEmergencyToken(e.target.value)}
                    className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-red-500/50 flex-1"
                    style={{ fontFamily: 'inherit' }}
                  >
                    <option value="">Select token</option>
                    {tokenBalances.map(t => (
                      <option key={t.address} value={t.address}>{t.symbol}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Amount"
                    value={emergencyAmount}
                    onChange={e => setEmergencyAmount(e.target.value)}
                    className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-red-500/50 flex-1 font-mono"
                  />
                  <button
                    onClick={() => {
                      const tb = tokenBalances.find(t => t.address === emergencyToken)
                      const amt = ethers.parseUnits(emergencyAmount, tb?.decimals || 18)
                      handleAdminTx(
                        'emergencyWithdraw', [emergencyToken, amt],
                        'Emergency Withdraw',
                        () => treasury.emergencyWithdraw(walletAddress, emergencyToken, amt)
                      )
                    }}
                    disabled={adminLoading !== null || !emergencyToken || !emergencyAmount}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition-all rounded-sm whitespace-nowrap"
                  >
                    {adminLoading === 'Emergency Withdraw' ? '...' : 'Execute'}
                  </button>
                </div>
              </GlowCard>

              {/* Transfer Ownership */}
              <GlowCard color="#ef4444" delay={0.35}>
                <div className="flex items-center gap-2 mb-4">
                  <KeyIcon className="w-5 h-5 text-red-400" />
                  <span className="text-white font-bold">Transfer Ownership</span>
                  <span className="text-red-400/40 text-[10px] font-bold uppercase tracking-wider ml-auto">Irreversible</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New owner address (0x...)"
                    value={newOwner}
                    onChange={e => setNewOwner(e.target.value)}
                    className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-red-500/50 flex-1 font-mono"
                  />
                  <button
                    onClick={() => handleAdminTx(
                      'transferOwnership', [newOwner],
                      'Transfer Ownership',
                      () => treasury.transferOwnership(walletAddress, newOwner)
                    )}
                    disabled={adminLoading !== null || !newOwner}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition-all rounded-sm whitespace-nowrap"
                  >
                    {adminLoading === 'Transfer Ownership' ? '...' : 'Transfer'}
                  </button>
                </div>
              </GlowCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
