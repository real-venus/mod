"use client";

import { useState, useEffect, useCallback } from 'react'
import {
  BuildingLibraryIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  WalletIcon,
} from '@heroicons/react/24/outline'
import { ethers, EventLog } from 'ethers'
import TokenABI from '@/contracts/token/Token.sol/Token.json'
import MarketABI from '@/contracts/market/Market.sol/Market.json'
import modConfig from '@/config.json'
import { CopyButton } from '@/ui/CopyButton'
import { motion, AnimatePresence } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { userContext } from '@/context'
import { Treasury, type TreasuryInfo, type HolderInfo, type TokenBalance } from '@/network/Treasury'
import { isSafeContract, getSafeOwners, getSafeThreshold, isUserSafeOwner, proposeSafeTransaction, type SafeInfo } from '@/network/safe'
import { toast } from 'react-toastify'
import BlocTimeABI from '@/contracts/bloctime/BlocTime.sol/BlocTime.json'

export const dynamic = 'force-dynamic'

const tInputStyle = { backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-strong)', color: 'var(--text-primary)' } as const

type Tab = 'overview' | 'member' | 'owner'

interface DepositEvent {
  funder: string
  token: string
  amount: string
  timestamp: number
  txHash: string
  blockNumber: number
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

export default function TreasuryPage() {
  const { user } = userContext()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [treasury] = useState(() => new Treasury())

  // ── State ──
  const [loading, setLoading] = useState(true)
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([])
  const [treasuryInfo, setTreasuryInfo] = useState<TreasuryInfo | null>(null)
  const [governanceToken, setGovernanceToken] = useState('')
  const [tokenGate, setTokenGate] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const [modTokenBalance, setModTokenBalance] = useState<string>('0')
  const [modTokenSupply, setModTokenSupply] = useState<string>('0')
  const [modTokenSymbol, setModTokenSymbol] = useState<string>('MOD')
  const [modTokenDecimals, setModTokenDecimals] = useState<number>(18)

  const [userNatBalance, setUserNatBalance] = useState<string>('0')
  const [userBlocTimeBalance, setUserBlocTimeBalance] = useState<string>('0')

  const [marketUsdcBalance, setMarketUsdcBalance] = useState<string>('0')
  const [marketUsdtBalance, setMarketUsdtBalance] = useState<string>('0')
  const [marketTotalFeesAccrued, setMarketTotalFeesAccrued] = useState<string>('0')
  const [marketUnclaimedFees, setMarketUnclaimedFees] = useState<string>('0')

  const [isOwner, setIsOwner] = useState(false)
  const [isSafeSigner, setIsSafeSigner] = useState(false)
  const [isSafeOwned, setIsSafeOwned] = useState(false)
  const [safeOwners, setSafeOwners] = useState<string[]>([])
  const [safeThreshold, setSafeThreshold] = useState(0)

  const [holderInfo, setHolderInfo] = useState<HolderInfo | null>(null)

  const [deposits, setDeposits] = useState<DepositEvent[]>([])
  const [depositsLoading, setDepositsLoading] = useState(false)

  // ── BlocTime state ──
  const [blocTimeBalance, setBlocTimeBalance] = useState<string>('0')
  const [blocTimeTotalSupply, setBlocTimeTotalSupply] = useState<string>('0')
  const [stakeAmount, setStakeAmount] = useState('')
  const [lockBlocks, setLockBlocks] = useState('')
  const [userStakes, setUserStakes] = useState<any[]>([])
  const [maxLockBlocks, setMaxLockBlocks] = useState(0)
  const [blocTimeLoading, setBlocTimeLoading] = useState(false)
  const [showBlocTimeDetails, setShowBlocTimeDetails] = useState(false)

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

          // Fetch user's NAT balance
          if (walletAddress) {
            const userBal = await tokenContract.balanceOf(walletAddress)
            setUserNatBalance(ethers.formatUnits(userBal, decimals))
          }
        }
      } catch (err) {
        console.warn('Could not fetch MOD token info:', err)
      }

      // Fetch user's BlocTime balance
      try {
        const network = 'testnet'
        const blocTimeAddr = (modConfig.chain as any)?.[network]?.contracts?.BlocTime?.address
        if (blocTimeAddr && walletAddress) {
          const blocTimeContract = new ethers.Contract(blocTimeAddr, BlocTimeABI.abi, provider)
          const balance = await blocTimeContract.balanceOf(walletAddress)
          setUserBlocTimeBalance(ethers.formatUnits(balance, 18))
        }
      } catch (err) {
        console.warn('Could not fetch BlocTime balance:', err)
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

          const [totalFees, unclaimedFees] = await Promise.all([
            marketContract.totalTreasuryFeesAccrued(),
            marketContract.getUnclaimedTreasuryFFeesUSD(),
          ])
          setMarketTotalFeesAccrued(ethers.formatUnits(totalFees, 8))
          setMarketUnclaimedFees(ethers.formatUnits(unclaimedFees, 8))
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
    if (activeTab === 'member' && walletAddress) fetchDeposits()
  }, [activeTab, walletAddress, fetchDeposits])

  // ── Fetch BlocTime data ──
  const fetchBlocTimeData = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum || !walletAddress) return
    try {
      setBlocTimeLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = 'testnet'
      const blocTimeAddr = (modConfig.chain as any)?.[network]?.contracts?.BlocTime?.address
      const nativeAddr = (modConfig.chain as any)?.[network]?.contracts?.NativeToken?.address

      if (!blocTimeAddr) return

      const blocTimeContract = new ethers.Contract(blocTimeAddr, BlocTimeABI.abi, provider)

      // Fetch user balance and total supply
      const [balance, totalSupply, params] = await Promise.all([
        blocTimeContract.balanceOf(walletAddress),
        blocTimeContract.totalSupply(),
        blocTimeContract.params(),
      ])

      setBlocTimeBalance(ethers.formatUnits(balance, 18))
      setBlocTimeTotalSupply(ethers.formatUnits(totalSupply, 18))
      setMaxLockBlocks(Number(params.maxLockBlocks))

      // Fetch user stakes
      const stakeIds = await blocTimeContract.getUserStakeIds(walletAddress)
      const stakes = await Promise.all(
        stakeIds.map(async (id: bigint) => {
          const stake = await blocTimeContract.getStakePosition(walletAddress, id)
          return {
            id: id.toString(),
            amount: stake.amount,
            startBlock: stake.startBlock,
            lockBlocks: stake.lockBlocks,
            blocTimeBalance: stake.blocTimeBalance,
            blocksRemaining: stake.blocksRemaining,
          }
        })
      )
      setUserStakes(stakes)
    } catch (err) {
      console.error('Error fetching BlocTime data:', err)
    } finally {
      setBlocTimeLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    if ((showBlocTimeDetails || activeTab === 'member') && walletAddress) fetchBlocTimeData()
  }, [showBlocTimeDetails, activeTab, walletAddress, fetchBlocTimeData])

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
      const { safeTxHash } = await proposeSafeTransaction(ownerAddress, treasury.address, data, signer, network.chainId)
      toast.success(`Safe transaction proposed: ${safeTxHash.slice(0, 10)}...`)
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

  async function handleWithdrawToken(tokenAddr: string, symbol: string) {
    execAdminAction(`Withdraw ${symbol}`, () => treasury.withdrawToken(walletAddress, tokenAddr))
  }

  async function handleWithdrawAll() {
    execAdminAction('Withdraw All', () => treasury.withdrawAll(walletAddress))
  }

  async function handleFundTreasury() {
    if (!fundToken || !fundAmount) { toast.error('Enter token and amount'); return }
    let tokenAddr = getTokenAddressFromSymbol(fundToken)

    // Handle NativeToken specifically
    if (fundToken === 'NativeToken') {
      const network = 'testnet'
      const chainConfig = (modConfig.chain as any)?.[network]
      tokenAddr = chainConfig?.contracts?.NativeToken?.address
    }

    if (!tokenAddr) { toast.error('Unknown token'); return }

    // Get decimals - check token balances first, then default to 18
    let decimals = tokenBalances.find(t => t.symbol === fundToken)?.decimals
    if (!decimals) {
      decimals = 18 // Default for NativeToken and other ERC20s
    }

    const amount = ethers.parseUnits(fundAmount, decimals)

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

  async function handleStakeToBlocTime() {
    if (!stakeAmount || !lockBlocks) { toast.error('Enter amount and lock blocks'); return }
    if (!walletAddress) { toast.error('Connect wallet first'); return }

    execAdminAction('Stake to BlocTime', async () => {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner(walletAddress)

      const network = 'testnet'
      const blocTimeAddr = (modConfig.chain as any)?.[network]?.contracts?.BlocTime?.address
      const nativeAddr = (modConfig.chain as any)?.[network]?.contracts?.NativeToken?.address

      if (!blocTimeAddr || !nativeAddr) throw new Error('BlocTime or NativeToken address not found')

      const amount = ethers.parseUnits(stakeAmount, modTokenDecimals)
      const tokenContract = new ethers.Contract(nativeAddr, TokenABI.abi, signer)
      const blocTimeContract = new ethers.Contract(blocTimeAddr, BlocTimeABI.abi, signer)

      // Approve
      const approveTx = await tokenContract.approve(blocTimeAddr, amount)
      await approveTx.wait()

      // Stake
      const stakeTx = await blocTimeContract.stake(amount, lockBlocks)
      await stakeTx.wait()

      fetchBlocTimeData()
      setStakeAmount('')
      setLockBlocks('')
    })
  }

  async function handleUnstake(stakeId: string) {
    if (!walletAddress) { toast.error('Connect wallet first'); return }

    execAdminAction(`Unstake ${stakeId}`, async () => {
      if (!window.ethereum) throw new Error('No wallet connected')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner(walletAddress)

      const network = 'testnet'
      const blocTimeAddr = (modConfig.chain as any)?.[network]?.contracts?.BlocTime?.address
      if (!blocTimeAddr) throw new Error('BlocTime address not found')

      const blocTimeContract = new ethers.Contract(blocTimeAddr, BlocTimeABI.abi, signer)
      const unstakeTx = await blocTimeContract.unstake(stakeId)
      await unstakeTx.wait()

      fetchBlocTimeData()
    })
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'member', label: 'Member', show: !!walletAddress },
    { key: 'owner', label: 'Owner', show: canAdmin },
  ]

  if (!treasury.address) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-purple-400 text-xl font-mono">Treasury not configured</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: 'IBM Plex Mono, monospace', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="relative z-10 p-4 md:p-8 max-w-4xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center border border-purple-500/40 rounded-lg bg-purple-500/10">
              <BuildingLibraryIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Treasury</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {treasury.address.slice(0, 6)}...{treasury.address.slice(-4)}
                </span>
                <CopyButton text={treasury.address} size="sm" />
                {isSafeOwned && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-green-500/15 border border-green-500/30 text-green-400 rounded">
                    <ShieldCheckIcon className="w-3 h-3" /> MULTISIG
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-2 hover:border-purple-500/30 rounded-lg hover:text-purple-400 text-xs transition-all"
            style={{ border: '2px solid var(--border-strong)', color: 'var(--text-tertiary)' }}
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1" style={{ borderBottom: '2px solid var(--border-color)' }}>
          {tabs.filter(t => t.show).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-bold transition-colors relative ${
                activeTab === tab.key ? 'text-purple-400' : ''
              }`}
              style={activeTab !== tab.key ? { color: 'var(--text-tertiary)' } : {}}
            >
              {tab.label}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="treasuryTab"
                  className="absolute bottom-0 left-2 right-2 h-[2px] bg-purple-500"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-[10px] font-mono pb-2" style={{ color: 'var(--text-tertiary)' }}>
            {lastUpdate.toLocaleTimeString()}
          </span>
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* ── Contract Addresses ── */}
              <div className="rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}>
                <div>
                  <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Treasury Address</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                      {treasury.address.slice(0, 6)}...{treasury.address.slice(-4)}
                    </span>
                    <CopyButton text={treasury.address} size="sm" />
                  </div>
                </div>
                <div>
                  <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Token Address (NAT)</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                      {(() => {
                        const network = 'testnet'
                        const nativeAddr = (modConfig.chain as any)?.[network]?.contracts?.NativeToken?.address || ''
                        return nativeAddr ? `${nativeAddr.slice(0, 6)}...${nativeAddr.slice(-4)}` : 'N/A'
                      })()}
                    </span>
                    <CopyButton text={(modConfig.chain as any)?.testnet?.contracts?.NativeToken?.address || ''} size="sm" />
                  </div>
                </div>
                <div>
                  <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>BlocTime Address</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                      {(() => {
                        const network = 'testnet'
                        const blocTimeAddr = (modConfig.chain as any)?.[network]?.contracts?.BlocTime?.address || ''
                        return blocTimeAddr ? `${blocTimeAddr.slice(0, 6)}...${blocTimeAddr.slice(-4)}` : 'N/A'
                      })()}
                    </span>
                    <CopyButton text={(modConfig.chain as any)?.testnet?.contracts?.BlocTime?.address || ''} size="sm" />
                  </div>
                </div>
              </div>

              {/* ── Treasury Assets Overview ── */}
              {(() => {
                const COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899']
                const pieData = tokenBalances
                  .filter(tb => tb.balance > 0)
                  .map(tb => ({ name: tb.symbol, value: tb.balance }))
                const modBal = parseFloat(modTokenBalance)
                if (modBal > 0) pieData.push({ name: modTokenSymbol, value: modBal })

                return (
                  <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}>
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Total Treasury Value</span>
                        <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{loading ? '...' : fmt(totalBalance)}</span>
                      </div>
                      {parseFloat(marketUnclaimedFees) > 0 && (
                        <div className="text-right">
                          <span className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>Pending Fees</span>
                          <span className="text-xl font-bold text-emerald-400">{fmt(parseFloat(marketUnclaimedFees))}</span>
                        </div>
                      )}
                    </div>

                    {/* Pie chart + legend side by side */}
                    <div className="flex items-center gap-6 mt-4">
                      <div className="w-32 h-32 flex-shrink-0">
                        {pieData.length > 0 && !loading ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={32}
                                outerRadius={56}
                                dataKey="value"
                                strokeWidth={0}
                              >
                                {pieData.map((_, idx) => (
                                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }}
                                formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, '']}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="w-full h-full rounded-full flex items-center justify-center" style={{ border: '2px solid var(--border-color)' }}>
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>--</span>
                          </div>
                        )}
                      </div>

                      {/* Legend + line items */}
                      <div className="flex-1 space-y-2">
                        {pieData.map((item, idx) => {
                          const pct = totalBalance > 0 ? ((item.value / totalBalance) * 100).toFixed(1) : '0'
                          return (
                            <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-purple-500/5 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>{pct}%</span>
                              </div>
                              <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(item.value)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* ── Safe Info ── */}
              {isSafeOwned && (
                <div className="rounded-xl p-5 border border-green-500/20 bg-green-500/[0.04]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheckIcon className="w-5 h-5 text-green-400" />
                      <span className="text-sm font-bold text-green-400">Multisig Treasury</span>
                    </div>
                    <div className="px-2.5 py-1 rounded-md bg-green-500/15 border border-green-500/30">
                      <span className="text-xs font-bold text-green-400">
                        {safeThreshold} of {safeOwners.length} required
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {safeOwners.map(addr => (
                      <div key={addr} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: addr.toLowerCase() === walletAddress.toLowerCase() ? 'var(--bg-secondary)' : 'transparent' }}>
                        <div className={`w-2 h-2 rounded-full ${addr.toLowerCase() === walletAddress.toLowerCase() ? 'bg-green-400' : 'bg-gray-500/40'}`} />
                        <span className="font-mono text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{addr.slice(0, 6)}...{addr.slice(-4)}</span>
                        {addr.toLowerCase() === walletAddress.toLowerCase() && (
                          <span className="text-green-400 text-[10px] font-bold px-2 py-0.5 bg-green-500/20 rounded border border-green-500/30">YOUR WALLET</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Member Tab ── */}
          {activeTab === 'member' && walletAddress && (
            <motion.div
              key="member"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Unified Token Card (NAT & BlocTime) */}
              <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}>
                {/* Header with Toggle */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      {governanceToken !== ethers.ZeroAddress ? 'Governance Tokens' : 'Tokens'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowBlocTimeDetails(!showBlocTimeDetails)}
                    className="text-xs px-3 py-1.5 rounded-md transition-all font-bold"
                    style={{ backgroundColor: 'var(--bg-tertiary)', border: '2px solid var(--border-strong)', color: 'var(--text-primary)' }}
                  >
                    {showBlocTimeDetails ? 'Hide Staking' : 'Stake NAT'}
                  </button>
                </div>

                {/* Token Balances Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* NAT Balance */}
                  <div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                      {modTokenSymbol}
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Your Balance</span>
                        <span className="font-mono text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                          {parseFloat(userNatBalance).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Supply</span>
                        <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {parseFloat(modTokenSupply).toLocaleString()}
                        </span>
                      </div>
                      {modTokenSupply !== '0' && userNatBalance !== '0' && (
                        <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>% of Supply</span>
                          <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {((parseFloat(userNatBalance) / parseFloat(modTokenSupply)) * 100).toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BlocTime Balance */}
                  <div>
                    <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                      BTime
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Your Balance</span>
                        <span className="font-mono text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                          {parseFloat(userBlocTimeBalance).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Earn via Staking</span>
                        <button
                          onClick={() => setShowBlocTimeDetails(true)}
                          className="text-xs transition-colors font-bold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          Stake NAT →
                        </button>
                      </div>
                      {userBlocTimeBalance !== '0' && (
                        <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Voting Power</span>
                          <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            Active
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable Staking Section */}
                <AnimatePresence>
                  {showBlocTimeDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-6 space-y-4" style={{ borderTop: '2px solid var(--border-color)' }}>
                        {/* Stake NAT Form */}
                        <div className="rounded-lg p-4 bg-cyan-500/5 border border-cyan-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <BuildingLibraryIcon className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-bold text-cyan-400">Stake NAT for BlocTime</span>
                            {blocTimeLoading && <ArrowPathIcon className="w-4 h-4 text-cyan-400 animate-spin ml-auto" />}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>Amount (NAT)</label>
                              <input
                                type="text"
                                placeholder="0.0"
                                value={stakeAmount}
                                onChange={e => setStakeAmount(e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono transition-all"
                                style={tInputStyle}
                              />
                            </div>
                            <div>
                              <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>Lock Blocks</label>
                              <input
                                type="number"
                                placeholder={maxLockBlocks > 0 ? `max: ${maxLockBlocks.toLocaleString()}` : '100000'}
                                value={lockBlocks}
                                onChange={e => setLockBlocks(e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono transition-all"
                                style={tInputStyle}
                              />
                            </div>
                          </div>
                          <button
                            onClick={handleStakeToBlocTime}
                            disabled={adminLoading !== null || !stakeAmount || !lockBlocks}
                            className="w-full mt-3 px-4 py-2.5 text-sm font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30 transition-all rounded-lg"
                          >
                            {adminLoading === 'Stake to BlocTime' ? 'Processing...' : 'Stake NAT'}
                          </button>
                        </div>

                        {/* User Stakes */}
                        {userStakes.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Your Stakes</span>
                              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                                {userStakes.length}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {userStakes.map((stake) => {
                                const amountFormatted = ethers.formatUnits(stake.amount, modTokenDecimals)
                                const blocTimeFormatted = ethers.formatUnits(stake.blocTimeBalance, 18)
                                const isUnlocked = stake.blocksRemaining === BigInt(0)

                                return (
                                  <div key={stake.id} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                          {parseFloat(amountFormatted).toLocaleString()} {modTokenSymbol}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isUnlocked ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                          {isUnlocked ? 'Unlocked' : 'Locked'}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleUnstake(stake.id)}
                                        disabled={adminLoading !== null || !isUnlocked}
                                        className="px-2.5 py-1 text-[11px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30 transition-all rounded"
                                      >
                                        {adminLoading === `Unstake ${stake.id}` ? '...' : 'Unstake'}
                                      </button>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                      <span style={{ color: 'var(--text-tertiary)' }}>BTime: {parseFloat(blocTimeFormatted).toLocaleString()}</span>
                                      <span style={{ color: 'var(--text-tertiary)' }}>Blocks left: {stake.blocksRemaining.toString()}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {!blocTimeLoading && userStakes.length === 0 && stakeAmount === '' && (
                          <div className="py-4 text-center">
                            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No active stakes</div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Claimable Rewards */}
              {holderInfo && holderInfo.tokens.length > 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <WalletIcon className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-bold text-emerald-400">Claimable Rewards</span>
                    </div>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {holderInfo.tokens.map((token, i) => {
                      const bal = tokenBalances.find(b => b.address.toLowerCase() === token.toLowerCase())
                      const claimable = holderInfo.claimableAmounts[i]
                      const claimableFormatted = ethers.formatUnits(claimable, bal?.decimals || 18)
                      const claimableNum = parseFloat(claimableFormatted)
                      return (
                        <div key={token} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>{bal?.symbol || token.slice(0, 8)}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold font-mono text-emerald-400">${claimableNum.toFixed(2)}</span>
                            <button
                              onClick={() => handleWithdrawToken(token, bal?.symbol || 'Token')}
                              disabled={adminLoading !== null || claimable === BigInt(0)}
                              className="px-3 py-1.5 text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-30 transition-all rounded-md"
                            >
                              {adminLoading === `Withdraw ${bal?.symbol || 'Token'}` ? '...' : 'Claim'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {holderInfo.tokens.length > 1 && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={handleWithdrawAll}
                          disabled={adminLoading !== null}
                          className="px-4 py-2 text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-30 transition-all rounded-lg"
                        >
                          {adminLoading === 'Withdraw All' ? '...' : 'Claim All'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Empty state if no rewards */}
              {!holderInfo?.tokens.length && (
                <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}>
                  <WalletIcon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                  <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>No claimable rewards</div>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Rewards will appear here when you hold governance tokens</div>
                </div>
              )}

              {/* Contribute to Treasury */}
              <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <BuildingLibraryIcon className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Contribute to Treasury</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={fundToken}
                    onChange={e => setFundToken(e.target.value)}
                    className="text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{ fontFamily: 'inherit', backgroundColor: 'var(--bg-input)', border: '2px solid var(--border-strong)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Select Token</option>
                    {tokenBalances.map(t => (
                      <option key={t.address} value={t.symbol}>{t.symbol}</option>
                    ))}
                    <option value="NativeToken">NativeToken</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Amount"
                    value={fundAmount}
                    onChange={e => setFundAmount(e.target.value)}
                    className="text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 font-mono transition-all"
                    style={tInputStyle}
                  />
                </div>
                <button
                  onClick={handleFundTreasury}
                  disabled={adminLoading !== null || !fundToken || !fundAmount}
                  className="w-full mt-3 px-4 py-2.5 text-sm font-bold disabled:opacity-30 transition-all rounded-lg"
                  style={{ backgroundColor: 'var(--bg-tertiary)', border: '2px solid var(--border-strong)', color: 'var(--text-primary)' }}
                >
                  {adminLoading === 'Fund Treasury' ? 'Processing...' : 'Deposit to Treasury'}
                </button>
              </div>

              {/* Your Deposits */}
              <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Your Treasury Deposits</span>
                  <button
                    onClick={fetchDeposits}
                    disabled={depositsLoading}
                    className="hover:text-purple-400 transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <ArrowPathIcon className={`w-4 h-4 ${depositsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {depositsLoading ? (
                  <div className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading deposits...</div>
                ) : deposits.filter(dep => dep.funder.toLowerCase() === walletAddress.toLowerCase()).length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>No deposits yet</div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Your deposits to the treasury will appear here</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deposits
                      .filter(dep => dep.funder.toLowerCase() === walletAddress.toLowerCase())
                      .map((dep, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-purple-400 font-bold text-sm">{dep.token}</span>
                              <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                                {new Date(dep.timestamp * 1000).toLocaleDateString()}
                              </span>
                            </div>
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              Block #{dep.blockNumber}
                            </span>
                          </div>
                          <span className="text-emerald-400 font-bold font-mono">${parseFloat(dep.amount).toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Owner Tab ── */}
          {activeTab === 'owner' && canAdmin && (
            <motion.div
              key="owner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-amber-400" />
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Owner Controls</span>
                  <span className="text-amber-400/50 text-xs ml-auto">
                    {isOwner ? 'Direct Owner' : `Safe signer (${safeThreshold}/${safeOwners.length})`}
                  </span>
                </div>
              </div>

              {/* Owner Withdrawals */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}>
                <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>Owner Withdrawals</p>
                <div className="space-y-2">
                  {tokenBalances.map(tb => (
                    <div key={tb.address} className="flex items-center justify-between py-2">
                      <div>
                        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{tb.symbol}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>${tb.balance.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => handleAdminTx(
                          'ownerWithdraw', [tb.address],
                          `Owner Withdraw ${tb.symbol}`,
                          () => treasury.ownerWithdraw(walletAddress, tb.address)
                        )}
                        disabled={adminLoading !== null}
                        className="px-3 py-1.5 text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 disabled:opacity-30 transition-all rounded-lg"
                      >
                        {adminLoading === `Owner Withdraw ${tb.symbol}` ? '...' : isSafeSigner && !isOwner ? 'Propose' : 'Withdraw'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}>
                <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>Settings</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>Owner % (now: {ownerPctDisplay}%)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="e.g. 500 = 5%"
                        value={newOwnerPct}
                        onChange={e => setNewOwnerPct(e.target.value)}
                        className="text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
                        style={tInputStyle}
                      />
                      <button
                        onClick={() => handleAdminTx(
                          'setOwnerPercentage', [Number(newOwnerPct)],
                          'Set Owner %',
                          () => treasury.setOwnerPercentage(walletAddress, Number(newOwnerPct))
                        )}
                        disabled={adminLoading !== null || !newOwnerPct}
                        className="px-4 py-2 text-xs font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 transition-all rounded-lg"
                      >
                        {adminLoading === 'Set Owner %' ? '...' : 'Set'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>Governance Token</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="0x..."
                        value={newGovToken}
                        onChange={e => setNewGovToken(e.target.value)}
                        className="text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
                        style={tInputStyle}
                      />
                      <button
                        onClick={() => handleAdminTx(
                          'setGovernanceToken', [newGovToken],
                          'Set Gov Token',
                          () => treasury.setGovernanceToken(walletAddress, newGovToken)
                        )}
                        disabled={adminLoading !== null || !newGovToken}
                        className="px-4 py-2 text-xs font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 transition-all rounded-lg"
                      >
                        {adminLoading === 'Set Gov Token' ? '...' : 'Set'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>Token Gate</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="0x..."
                        value={newTokenGate}
                        onChange={e => setNewTokenGate(e.target.value)}
                        className="text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
                        style={tInputStyle}
                      />
                      <button
                        onClick={() => handleAdminTx(
                          'setTokenGate', [newTokenGate],
                          'Set Token Gate',
                          () => treasury.setTokenGate(walletAddress, newTokenGate)
                        )}
                        disabled={adminLoading !== null || !newTokenGate}
                        className="px-4 py-2 text-xs font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 transition-all rounded-lg"
                      >
                        {adminLoading === 'Set Token Gate' ? '...' : 'Set'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Withdraw */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
                <p className="text-red-400/60 text-xs mb-3">Emergency Withdraw</p>
                <div className="flex gap-2">
                  <select
                    value={emergencyToken}
                    onChange={e => setEmergencyToken(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-red-500/50 flex-1"
                    style={{ fontFamily: 'inherit', ...tInputStyle }}
                  >
                    <option value="">Token</option>
                    {tokenBalances.map(t => (
                      <option key={t.address} value={t.address}>{t.symbol}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Amount"
                    value={emergencyAmount}
                    onChange={e => setEmergencyAmount(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-red-500/50 flex-1 font-mono"
                    style={tInputStyle}
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
                    className="px-4 py-2 text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition-all rounded-lg"
                  >
                    {adminLoading === 'Emergency Withdraw' ? '...' : 'Execute'}
                  </button>
                </div>
              </div>

              {/* Transfer Ownership */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-red-400/60 text-xs">Transfer Ownership</p>
                  <span className="text-red-400/30 text-[10px]">Irreversible</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New owner (0x...)"
                    value={newOwner}
                    onChange={e => setNewOwner(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-red-500/50 flex-1 font-mono"
                    style={tInputStyle}
                  />
                  <button
                    onClick={() => handleAdminTx(
                      'transferOwnership', [newOwner],
                      'Transfer Ownership',
                      () => treasury.transferOwnership(walletAddress, newOwner)
                    )}
                    disabled={adminLoading !== null || !newOwner}
                    className="px-4 py-2 text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition-all rounded-lg"
                  >
                    {adminLoading === 'Transfer Ownership' ? '...' : 'Transfer'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
