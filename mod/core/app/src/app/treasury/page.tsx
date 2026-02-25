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

export const dynamic = 'force-dynamic'

type Tab = 'overview' | 'deposits' | 'admin'

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
    const tokenAddr = getTokenAddressFromSymbol(fundToken)
    if (!tokenAddr) { toast.error('Unknown token'); return }
    const decimals = tokenBalances.find(t => t.symbol === fundToken)?.decimals || 18
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

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'deposits', label: 'Deposits', show: true },
    { key: 'admin', label: 'Admin', show: canAdmin },
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
      <div className="relative z-10 p-4 md:p-8 max-w-4xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center border border-purple-500/40 rounded-lg bg-purple-500/10">
              <BuildingLibraryIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Treasury</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/30 font-mono text-xs">
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
            className="flex items-center gap-1 px-3 py-2 border border-white/10 hover:border-purple-500/30 rounded-lg text-white/40 hover:text-purple-400 text-xs transition-all"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 border-b border-white/[0.06]">
          {tabs.filter(t => t.show).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-bold transition-colors relative ${
                activeTab === tab.key ? 'text-purple-400' : 'text-white/30 hover:text-white/50'
              }`}
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
          <span className="text-white/15 text-[10px] font-mono pb-2">
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
              {/* ── Your Balance ── */}
              {walletAddress && (
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <WalletIcon className="w-4 h-4 text-purple-400" />
                      <span className="text-white/50 text-sm">Your Balance</span>
                    </div>
                    <span className="text-white/20 text-xs font-mono">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </span>
                  </div>

                  {!holderInfo || holderInfo.tokens.length === 0 ? (
                    <p className="text-white/30 text-sm py-1">No claimable balance yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {holderInfo.tokens.map((token, i) => {
                        const bal = tokenBalances.find(b => b.address.toLowerCase() === token.toLowerCase())
                        const claimable = holderInfo.claimableAmounts[i]
                        const claimableFormatted = ethers.formatUnits(claimable, bal?.decimals || 18)
                        const claimableNum = parseFloat(claimableFormatted)
                        return (
                          <div key={token} className="flex items-center justify-between">
                            <span className="text-white/70 text-sm">{bal?.symbol || token.slice(0, 8)}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-white font-bold font-mono">${claimableNum.toFixed(2)}</span>
                              <button
                                onClick={() => handleWithdrawToken(token, bal?.symbol || 'Token')}
                                disabled={adminLoading !== null || claimable === BigInt(0)}
                                className="px-2.5 py-1 text-[11px] font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 transition-all rounded-md"
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
                            className="px-3 py-1 text-[11px] font-bold bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 disabled:opacity-30 transition-all rounded-md"
                          >
                            {adminLoading === 'Withdraw All' ? '...' : 'Claim All'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Treasury Pie Chart + Stats ── */}
              {(() => {
                const COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899']
                const pieData = tokenBalances
                  .filter(tb => tb.balance > 0)
                  .map(tb => ({ name: tb.symbol, value: tb.balance }))
                const modBal = parseFloat(modTokenBalance)
                if (modBal > 0) pieData.push({ name: modTokenSymbol, value: modBal })

                return (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-2xl font-bold">{loading ? '...' : fmt(totalBalance)}</span>
                      <span className="text-white/20 text-xs">Treasury</span>
                    </div>

                    {/* Pie chart + legend side by side */}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="w-28 h-28 flex-shrink-0">
                        {pieData.length > 0 && !loading ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={28}
                                outerRadius={48}
                                dataKey="value"
                                strokeWidth={0}
                              >
                                {pieData.map((_, idx) => (
                                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, '']}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="w-full h-full rounded-full border-2 border-white/5 flex items-center justify-center">
                            <span className="text-white/10 text-xs">--</span>
                          </div>
                        )}
                      </div>

                      {/* Legend + line items */}
                      <div className="flex-1 space-y-1.5">
                        {pieData.map((item, idx) => {
                          const pct = totalBalance > 0 ? ((item.value / totalBalance) * 100).toFixed(0) : '0'
                          return (
                            <div key={item.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                <span className="text-white/60 text-sm">{item.name}</span>
                                <span className="text-white/20 text-xs">{pct}%</span>
                              </div>
                              <span className="text-white font-mono text-sm">{fmt(item.value)}</span>
                            </div>
                          )
                        })}

                        {/* Fees as a simple line */}
                        {parseFloat(marketUnclaimedFees) > 0 && (
                          <>
                            <div className="border-t border-white/5 my-1" />
                            <div className="flex items-center justify-between">
                              <span className="text-emerald-400/60 text-xs">Unclaimed fees</span>
                              <span className="text-emerald-400 font-mono text-sm">{fmt(parseFloat(marketUnclaimedFees))}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* ── Fund Treasury ── */}
              {walletAddress && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-white/40 text-xs mb-3">Fund Treasury</p>
                  <div className="flex gap-2">
                    <select
                      value={fundToken}
                      onChange={e => setFundToken(e.target.value)}
                      className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500/50 flex-1"
                      style={{ fontFamily: 'inherit' }}
                    >
                      <option value="">Token</option>
                      {tokenBalances.map(t => (
                        <option key={t.address} value={t.symbol}>{t.symbol}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Amount"
                      value={fundAmount}
                      onChange={e => setFundAmount(e.target.value)}
                      className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
                    />
                    <button
                      onClick={handleFundTreasury}
                      disabled={adminLoading !== null || !fundToken || !fundAmount}
                      className="px-4 py-2 text-xs font-bold bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 disabled:opacity-30 transition-all rounded-lg"
                    >
                      {adminLoading === 'Fund Treasury' ? '...' : 'Send'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Safe Info ── */}
              {isSafeOwned && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheckIcon className="w-4 h-4 text-green-400" />
                    <span className="text-white/50 text-sm">Multisig</span>
                    <span className="text-white/20 text-xs font-mono ml-auto">
                      {safeThreshold}/{safeOwners.length} required
                    </span>
                  </div>
                  <div className="space-y-1">
                    {safeOwners.map(addr => (
                      <div key={addr} className="flex items-center gap-2 py-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${addr.toLowerCase() === walletAddress.toLowerCase() ? 'bg-green-400' : 'bg-white/20'}`} />
                        <span className="text-white/50 font-mono text-xs">{addr.slice(0, 6)}...{addr.slice(-4)}</span>
                        {addr.toLowerCase() === walletAddress.toLowerCase() && (
                          <span className="text-green-400 text-[10px] font-bold">You</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Deposits Tab ── */}
          {activeTab === 'deposits' && (
            <motion.div
              key="deposits"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-sm">Recent Deposits</span>
                <button
                  onClick={fetchDeposits}
                  disabled={depositsLoading}
                  className="text-white/30 hover:text-purple-400 transition-colors"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${depositsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {depositsLoading ? (
                <div className="py-12 text-center text-white/20 text-sm">Loading...</div>
              ) : deposits.length === 0 ? (
                <div className="py-12 text-center text-white/20 text-sm">No deposits found</div>
              ) : (
                <div className="space-y-2">
                  {deposits.map((dep, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400 font-bold text-sm">{dep.token}</span>
                          <span className="text-white/20 text-xs font-mono">{dep.funder.slice(0, 6)}...{dep.funder.slice(-4)}</span>
                        </div>
                        <span className="text-white/20 text-xs">
                          {new Date(dep.timestamp * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-emerald-400 font-bold font-mono">${parseFloat(dep.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Admin Tab ── */}
          {activeTab === 'admin' && canAdmin && (
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-amber-400" />
                  <span className="text-white font-bold">Admin</span>
                  <span className="text-amber-400/50 text-xs ml-auto">
                    {isOwner ? 'Owner' : `Safe signer (${safeThreshold}/${safeOwners.length})`}
                  </span>
                </div>
              </div>

              {/* Owner Withdrawals */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-white/40 text-xs mb-3">Owner Withdrawals</p>
                <div className="space-y-2">
                  {tokenBalances.map(tb => (
                    <div key={tb.address} className="flex items-center justify-between py-2">
                      <div>
                        <span className="text-white font-bold text-sm">{tb.symbol}</span>
                        <span className="text-white/20 text-xs ml-2">${tb.balance.toFixed(2)}</span>
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
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-white/40 text-xs mb-4">Settings</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-white/30 text-xs mb-1.5 block">Owner % (now: {ownerPctDisplay}%)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="e.g. 500 = 5%"
                        value={newOwnerPct}
                        onChange={e => setNewOwnerPct(e.target.value)}
                        className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
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
                    <label className="text-white/30 text-xs mb-1.5 block">Governance Token</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="0x..."
                        value={newGovToken}
                        onChange={e => setNewGovToken(e.target.value)}
                        className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
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
                    <label className="text-white/30 text-xs mb-1.5 block">Token Gate</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="0x..."
                        value={newTokenGate}
                        onChange={e => setNewTokenGate(e.target.value)}
                        className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500/50 flex-1 font-mono"
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
                    className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-red-500/50 flex-1"
                    style={{ fontFamily: 'inherit' }}
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
                    className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-red-500/50 flex-1 font-mono"
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
                    className="bg-black border border-white/10 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-red-500/50 flex-1 font-mono"
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
