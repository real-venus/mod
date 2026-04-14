"use client";

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'react-toastify'
import { ethers } from 'ethers'
import {
  ClockIcon,
  ArrowPathIcon,
  LockClosedIcon,
  LockOpenIcon,
  BanknotesIcon,
  ChartBarIcon,
  TrashIcon,
  RocketLaunchIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8851'

// ── Types ───────────────────────────────────────────────────────────────

interface StakePosition {
  stakeId: number
  amount: string
  startBlock: number
  lockBlocks: number
  blocTimeBalance: string
  blocksRemaining: number
}

interface Overview {
  address: string
  stakeCount: number
  totalStaked: string
  totalBlocTime: string
  blocBalance: string
  positions: StakePosition[]
}

interface ContractParams {
  maxLockBlocks: number
  distributionPercentage: number
  totalBlocTime: string
  totalSupply: string
  nextStakeId: number
}

interface Deployment {
  chainId: string
  url: string
  bloctime: string
  nativeToken: string
}

interface CurvePoint {
  blocks: number
  multiplier: number
  multiplierX: number
}

interface CurveData {
  maxBlocks: number
  points: CurvePoint[]
}

// ── API helper ──────────────────────────────────────────────────────────

async function api(fn: string, params: Record<string, any> = {}, method = 'POST') {
  const opts: RequestInit = method === 'GET'
    ? { method: 'GET' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }
  const res = await fetch(`${API_URL}/${fn}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || err.error || 'Request failed')
  }
  const data = await res.json()
  return data.result !== undefined ? data.result : data
}

const fmtEth = (wei: string) => {
  if (!wei || wei === '0') return '0'
  const val = Number(ethers.formatEther(wei))
  return val < 0.01 ? val.toExponential(2) : val.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

const fmtAddr = (s: string) => s.length > 16 ? `${s.slice(0, 8)}...${s.slice(-6)}` : s

type Tab = 'stake' | 'deploy'

// ── Main Page ───────────────────────────────────────────────────────────

const TESTNET_CHAIN_ID = 84532
const MAINNET_CHAIN_ID = 8453

function getNetworkInfo(chainId: number | null) {
  if (chainId === TESTNET_CHAIN_ID) return { name: 'Base Sepolia', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30', supported: true }
  if (chainId === MAINNET_CHAIN_ID) return { name: 'Base Mainnet', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30', supported: false }
  if (chainId) return { name: `Chain ${chainId}`, color: 'text-white/40', bg: 'bg-white/5 border-white/10', supported: false }
  return null
}

function BlocTimeApp() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [params, setParams] = useState<ContractParams | null>(null)
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [account, setAccount] = useState('')
  const [chainId, setChainId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('stake')

  // Stake form
  const [stakeAmount, setStakeAmount] = useState('')
  const [stakeLockBlocks, setStakeLockBlocks] = useState('0')
  const [staking, setStaking] = useState(false)
  const [previewMult, setPreviewMult] = useState<number | null>(null)
  const [curve, setCurve] = useState<CurveData | null>(null)

  // Deploy form
  const [deployNativeToken, setDeployNativeToken] = useState('')
  const [deployName, setDeployName] = useState('BlocTime Token')
  const [deploySymbol, setDeploySymbol] = useState('BLOC')
  const [deployMaxLock, setDeployMaxLock] = useState('100000')
  const [deployDistPct, setDeployDistPct] = useState('5000')
  const [deploying, setDeploying] = useState(false)
  const [deployedAddress, setDeployedAddress] = useState('')

  // Setup form (post-deploy)
  const [setupPoints, setSetupPoints] = useState('0:10000,10000:15000,50000:20000,100000:30000')
  const [settingUp, setSettingUp] = useState(false)

  // ── Wallet connect ──────────────────────────────────────────────────

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined') return
    const w = window as any
    if (!w.ethereum) { toast.error('Install MetaMask'); return }
    try {
      const provider = new ethers.BrowserProvider(w.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const network = await provider.getNetwork()
      const cid = Number(network.chainId)
      setChainId(cid)
      if (accounts.length > 0) {
        setAccount(accounts[0])
        setConnected(true)
        toast.success(`Connected: ${accounts[0].slice(0, 8)}...`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Connection failed')
    }
  }, [])

  // Listen for chain/account changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as any
    if (!w.ethereum) return
    const handleChainChanged = (hexChainId: string) => {
      setChainId(Number(hexChainId))
    }
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0])
        setConnected(true)
      } else {
        setAccount('')
        setConnected(false)
        setOverview(null)
      }
    }
    w.ethereum.on('chainChanged', handleChainChanged)
    w.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => {
      w.ethereum.removeListener('chainChanged', handleChainChanged)
      w.ethereum.removeListener('accountsChanged', handleAccountsChanged)
    }
  }, [])

  // ── Data fetching ───────────────────────────────────────────────────

  const fetchDeployment = useCallback(async () => {
    try {
      const data = await api('get_deployment')
      if (data) setDeployment(data)
    } catch { /* not deployed yet */ }
  }, [])

  const fetchParams = useCallback(async () => {
    try {
      const data = await api('get_params')
      if (data) setParams(data)
    } catch { /* ignore */ }
  }, [])

  const fetchCurve = useCallback(async () => {
    try {
      const data = await api('get_curve', {}, 'GET')
      if (data) setCurve(data)
    } catch { /* ignore */ }
  }, [])

  const fetchOverview = useCallback(async () => {
    if (!account) return
    setLoading(true)
    try {
      const data = await api('get_overview', { address: account })
      if (data) setOverview(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [account])

  useEffect(() => { fetchDeployment(); fetchParams(); fetchCurve() }, [fetchDeployment, fetchParams, fetchCurve])
  useEffect(() => { if (account) fetchOverview() }, [account, fetchOverview])

  useEffect(() => {
    const iv = setInterval(() => { fetchParams(); if (account) fetchOverview() }, 15000)
    return () => clearInterval(iv)
  }, [fetchParams, fetchOverview, account])

  // Multiplier preview
  useEffect(() => {
    const blocks = parseInt(stakeLockBlocks) || 0
    if (blocks > 0) {
      api('get_multiplier', { block_count: blocks })
        .then(d => setPreviewMult(d?.multiplierX || null))
        .catch(() => setPreviewMult(null))
    } else {
      setPreviewMult(1.0)
    }
  }, [stakeLockBlocks])

  // ── Stake Actions ─────────────────────────────────────────────────

  const handleStake = useCallback(async () => {
    if (!stakeAmount.trim()) { toast.error('Enter an amount'); return }
    setStaking(true)
    try {
      await api('stake', {
        amount: stakeAmount.trim(),
        lock_blocks: parseInt(stakeLockBlocks) || 0,
      })
      toast.success('Staked successfully')
      setStakeAmount('')
      setStakeLockBlocks('0')
      fetchOverview()
      fetchParams()
    } catch (err: any) {
      toast.error(err?.message || 'Staking failed')
    }
    setStaking(false)
  }, [stakeAmount, stakeLockBlocks, fetchOverview, fetchParams])

  const handleUnstake = useCallback(async (stakeId: number) => {
    try {
      await api('unstake', { stake_id: stakeId })
      toast.success('Unstaked')
      fetchOverview()
      fetchParams()
    } catch (err: any) {
      toast.error(err?.message || 'Unstake failed')
    }
  }, [fetchOverview, fetchParams])

  // ── Deploy via MetaMask ───────────────────────────────────────────

  const handleDeploy = useCallback(async () => {
    if (!connected) { toast.error('Connect wallet first'); return }
    if (!deployNativeToken.trim()) { toast.error('Enter native token address'); return }

    setDeploying(true)
    try {
      // Fetch ABI + bytecode from API
      const artifact = await api('get_artifact', {}, 'GET')
      if (!artifact || !artifact.bytecode) throw new Error('Could not load contract artifact')

      const w = window as any
      const provider = new ethers.BrowserProvider(w.ethereum)
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()

      // Deploy contract
      const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
      toast.info('Confirm deploy transaction in MetaMask...')

      const contract = await factory.deploy(
        deployNativeToken.trim(),
        deployName.trim(),
        deploySymbol.trim(),
        BigInt(parseInt(deployMaxLock) || 100000),
        BigInt(parseInt(deployDistPct) || 5000),
      )

      toast.info('Deploying... waiting for confirmation')
      await contract.waitForDeployment()
      const addr = await contract.getAddress()
      setDeployedAddress(addr)
      toast.success(`Deployed at ${addr.slice(0, 10)}...`)

      // Determine network label
      const chainId = network.chainId.toString()
      let networkLabel = 'custom'
      if (chainId === '84532') networkLabel = 'testnet'
      else if (chainId === '8453') networkLabel = 'mainnet'
      else if (chainId === '1337' || chainId === '31337') networkLabel = 'localhost'

      // Save to API config
      await api('save_deployment', {
        network: networkLabel,
        chain_id: chainId,
        rpc_url: chainId === '84532' ? 'https://sepolia.base.org' : chainId === '8453' ? 'https://mainnet.base.org' : 'http://localhost:8545',
        bloctime: addr,
        native_token: deployNativeToken.trim(),
      })

      toast.success('Deployment saved to config')
      fetchDeployment()
      fetchParams()
    } catch (err: any) {
      toast.error(err?.message || 'Deploy failed')
    }
    setDeploying(false)
  }, [connected, deployNativeToken, deployName, deploySymbol, deployMaxLock, deployDistPct, fetchDeployment, fetchParams])

  // ── Setup multiplier points via MetaMask ──────────────────────────

  const handleSetupPoints = useCallback(async () => {
    if (!connected) { toast.error('Connect wallet first'); return }
    const target = deployedAddress || deployment?.bloctime
    if (!target) { toast.error('No deployed contract'); return }

    setSettingUp(true)
    try {
      const artifact = await api('get_artifact', {}, 'GET')
      const w = window as any
      const provider = new ethers.BrowserProvider(w.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(target, artifact.abi, signer)

      // Parse points: "0:10000,10000:15000,50000:20000,100000:30000"
      const pointsArr = setupPoints.split(',').map(p => {
        const [blocks, multiplier] = p.trim().split(':').map(v => BigInt(parseInt(v.trim())))
        return { blocks, multiplier }
      })

      toast.info('Confirm setPoints transaction in MetaMask...')
      const tx = await contract.setPoints(pointsArr)
      toast.info('Setting points... waiting for confirmation')
      await tx.wait()
      toast.success('Multiplier curve set')
      fetchParams()
    } catch (err: any) {
      toast.error(err?.message || 'Setup failed')
    }
    setSettingUp(false)
  }, [connected, deployedAddress, deployment, setupPoints, fetchParams])

  const positions = overview?.positions || []

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e5e5e5] font-mono">
      <div className="relative z-10 p-4 md:p-6 max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between border border-white/10 rounded-lg p-4 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10">
              <ClockIcon className="w-5 h-5 text-white/70" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wider uppercase">BlocTime</h1>
              <p className="text-xs text-white/40 uppercase tracking-wider">Time-Weighted Staking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected && (() => {
              const net = getNetworkInfo(chainId)
              return net ? (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${net.bg} ${net.color}`}>
                  {net.name}
                </span>
              ) : null
            })()}
            {connected ? (
              <span className="text-xs text-emerald-400/70 font-mono">{fmtAddr(account)}</span>
            ) : (
              <button
                onClick={connectWallet}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
              >
                Connect
              </button>
            )}
            <button
              onClick={() => { fetchParams(); fetchDeployment(); if (account) fetchOverview() }}
              disabled={loading}
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 border border-white/10 rounded-lg p-1 bg-white/[0.02]">
          {([['stake', 'Stake'], ['deploy', 'Deploy']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                tab === t ? 'bg-white/10 text-white/90' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Mainnet Coming Soon ────────────────────────────────────── */}
        {connected && chainId === MAINNET_CHAIN_ID && (
          <div className="border border-blue-500/30 rounded-lg p-8 bg-blue-500/[0.05] text-center">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
              <ClockIcon className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-blue-300 mb-2 uppercase tracking-wider">Coming Soon</h2>
            <p className="text-sm text-white/40 max-w-md mx-auto">
              BlocTime is currently live on Base Sepolia testnet. Mainnet deployment is coming soon.
            </p>
            <p className="text-xs text-white/20 mt-4">Switch to Base Sepolia (chain 84532) to use the app.</p>
          </div>
        )}

        {/* ── Unsupported Network ──────────────────────────────────────── */}
        {connected && chainId !== null && chainId !== TESTNET_CHAIN_ID && chainId !== MAINNET_CHAIN_ID && (
          <div className="border border-red-500/20 rounded-lg p-6 bg-red-500/[0.05] text-center">
            <p className="text-sm text-red-300">Unsupported network (chain {chainId})</p>
            <p className="text-xs text-white/30 mt-2">Please switch to Base Sepolia (chain 84532).</p>
          </div>
        )}

        {/* ── Deploy Tab ──────────────────────────────────────────────── */}
        {(!connected || chainId === TESTNET_CHAIN_ID) && tab === 'deploy' && (
          <>
            {/* Current Deployment */}
            {deployment && (
              <div className="border border-emerald-500/20 rounded-lg p-4 bg-emerald-500/[0.03]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/70">Active Deployment</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40 uppercase">BlocTime</span>
                    <span
                      className="text-xs font-mono text-white/70 cursor-pointer hover:text-white transition-colors"
                      onClick={() => { navigator.clipboard.writeText(deployment.bloctime); toast.success('Copied') }}
                      title={deployment.bloctime}
                    >
                      {fmtAddr(deployment.bloctime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40 uppercase">Native Token</span>
                    <span
                      className="text-xs font-mono text-white/70 cursor-pointer hover:text-white transition-colors"
                      onClick={() => { navigator.clipboard.writeText(deployment.nativeToken); toast.success('Copied') }}
                      title={deployment.nativeToken}
                    >
                      {fmtAddr(deployment.nativeToken)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40 uppercase">Chain</span>
                    <span className="text-xs font-mono text-white/50">{deployment.chainId}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Deploy Form */}
            <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-4">
                <RocketLaunchIcon className="w-4 h-4 text-white/40" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Deploy New BlocTime Contract</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Native Token Address (ERC20 to stake)</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={deployNativeToken}
                    onChange={e => setDeployNativeToken(e.target.value)}
                    className="w-full text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Token Name</label>
                    <input
                      type="text"
                      value={deployName}
                      onChange={e => setDeployName(e.target.value)}
                      className="w-full text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Token Symbol</label>
                    <input
                      type="text"
                      value={deploySymbol}
                      onChange={e => setDeploySymbol(e.target.value)}
                      className="w-full text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Max Lock Blocks</label>
                    <input
                      type="number"
                      value={deployMaxLock}
                      onChange={e => setDeployMaxLock(e.target.value)}
                      className="w-full text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
                    />
                    <p className="text-[9px] text-white/20 mt-1">~{(parseInt(deployMaxLock) / 43200 || 0).toFixed(0)} days at 2s blocks</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Distribution % (basis pts)</label>
                    <input
                      type="number"
                      value={deployDistPct}
                      onChange={e => setDeployDistPct(e.target.value)}
                      className="w-full text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
                    />
                    <p className="text-[9px] text-white/20 mt-1">{((parseInt(deployDistPct) || 0) / 100).toFixed(0)}%</p>
                  </div>
                </div>
                <button
                  onClick={handleDeploy}
                  disabled={deploying || !connected || !deployNativeToken.trim()}
                  className="w-full py-3 rounded-lg border border-violet-500/40 bg-violet-500/15 text-violet-300 text-xs font-bold uppercase tracking-wider hover:bg-violet-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {deploying ? (
                    <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Deploying...</>
                  ) : (
                    <><RocketLaunchIcon className="w-4 h-4" /> Deploy via MetaMask</>
                  )}
                </button>
              </div>
            </div>

            {/* Deployed Address */}
            {deployedAddress && (
              <div className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-500/[0.05]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Deployed</span>
                </div>
                <span
                  className="text-sm font-mono text-emerald-300 cursor-pointer hover:text-emerald-200 transition-colors break-all"
                  onClick={() => { navigator.clipboard.writeText(deployedAddress); toast.success('Address copied') }}
                >
                  {deployedAddress}
                </span>
              </div>
            )}

            {/* Setup Multiplier Points */}
            <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-3">
                <Cog6ToothIcon className="w-4 h-4 text-white/40" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Set Multiplier Curve</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Points (blocks:multiplier, ...)</label>
                  <input
                    type="text"
                    value={setupPoints}
                    onChange={e => setSetupPoints(e.target.value)}
                    className="w-full text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
                    placeholder="0:10000,10000:15000,50000:20000,100000:30000"
                  />
                  <p className="text-[9px] text-white/20 mt-1">10000 = 1x, 15000 = 1.5x, 20000 = 2x, 30000 = 3x</p>
                </div>
                <button
                  onClick={handleSetupPoints}
                  disabled={settingUp || !connected}
                  className="w-full py-2.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 text-xs font-bold uppercase tracking-wider hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {settingUp ? (
                    <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Setting...</>
                  ) : (
                    <><Cog6ToothIcon className="w-4 h-4" /> Set Points via MetaMask</>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Stake Tab ───────────────────────────────────────────────── */}
        {(!connected || chainId === TESTNET_CHAIN_ID) && tab === 'stake' && (
          <>
            {/* Contract Stats */}
            {params && (
              <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                  <div className="p-4 text-center border-r border-b md:border-b-0 border-white/[0.06]">
                    <p className="text-lg font-bold text-cyan-400 tabular-nums">{fmtEth(params.totalSupply)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">BLOC Supply</p>
                  </div>
                  <div className="p-4 text-center border-b md:border-b-0 md:border-r border-white/[0.06]">
                    <p className="text-lg font-bold text-amber-400 tabular-nums">{fmtEth(params.totalBlocTime)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Total Staked BT</p>
                  </div>
                  <div className="p-4 text-center border-r border-white/[0.06]">
                    <p className="text-lg font-bold text-white/80 tabular-nums">{params.maxLockBlocks.toLocaleString()}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Max Lock</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-lg font-bold text-violet-400 tabular-nums">{params.nextStakeId}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Total Stakes</p>
                  </div>
                </div>
              </div>
            )}

            {/* Account Overview */}
            {connected && overview && (
              <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
                <div className="grid grid-cols-3">
                  <div className="p-4 text-center border-r border-white/[0.06]">
                    <p className="text-lg font-bold text-emerald-400 tabular-nums">{fmtEth(overview.blocBalance)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">BLOC Balance</p>
                  </div>
                  <div className="p-4 text-center border-r border-white/[0.06]">
                    <p className="text-lg font-bold text-cyan-400 tabular-nums">{fmtEth(overview.totalStaked)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Staked</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-lg font-bold text-amber-400 tabular-nums">{overview.stakeCount}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-1">Positions</p>
                  </div>
                </div>
              </div>
            )}

            {/* Stake Form */}
            <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-3">
                <BanknotesIcon className="w-4 h-4 text-white/40" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Stake Tokens</span>
              </div>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Amount</label>
                  <input
                    type="text"
                    placeholder="100"
                    value={stakeAmount}
                    onChange={e => setStakeAmount(e.target.value)}
                    className="w-full text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
                  />
                </div>
                <div className="w-36">
                  <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Lock Blocks</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={stakeLockBlocks}
                    onChange={e => setStakeLockBlocks(e.target.value)}
                    className="w-full text-sm px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/90 focus:outline-none focus:border-white/30 font-mono transition-colors placeholder:text-white/20"
                  />
                </div>
                {previewMult !== null && (
                  <div className="flex items-center gap-1 px-3 py-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                    <ChartBarIcon className="w-3.5 h-3.5 text-cyan-400/70" />
                    <span className="text-xs font-bold text-cyan-400 tabular-nums">{previewMult.toFixed(2)}x</span>
                  </div>
                )}
                <button
                  onClick={handleStake}
                  disabled={staking || !stakeAmount.trim()}
                  className="px-6 py-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {staking ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : 'Stake'}
                </button>
              </div>
              {parseInt(stakeLockBlocks) > 0 && (
                <p className="text-[10px] text-white/30 mt-2">
                  Lock: ~{(parseInt(stakeLockBlocks) / 43200).toFixed(1)} days ({stakeLockBlocks} blocks)
                  {previewMult && previewMult > 1 && ` — ${previewMult.toFixed(2)}x multiplier`}
                </p>
              )}

              {/* Multiplier Curve */}
              {curve && curve.points.length > 1 && (() => {
                const W = 600, H = 160, PAD_L = 45, PAD_R = 15, PAD_T = 20, PAD_B = 30
                const cw = W - PAD_L - PAD_R, ch = H - PAD_T - PAD_B
                const pts = curve.points
                const minM = Math.min(...pts.map(p => p.multiplierX))
                const maxM = Math.max(...pts.map(p => p.multiplierX))
                const mRange = maxM - minM || 1
                const maxB = curve.maxBlocks || pts[pts.length - 1].blocks

                const toX = (b: number) => PAD_L + (b / maxB) * cw
                const toY = (m: number) => PAD_T + ch - ((m - minM) / mRange) * ch

                const pathD = pts.map((p, i) =>
                  `${i === 0 ? 'M' : 'L'}${toX(p.blocks).toFixed(1)},${toY(p.multiplierX).toFixed(1)}`
                ).join(' ')

                // Fill area under curve
                const fillD = pathD
                  + ` L${toX(pts[pts.length - 1].blocks).toFixed(1)},${(PAD_T + ch).toFixed(1)}`
                  + ` L${toX(pts[0].blocks).toFixed(1)},${(PAD_T + ch).toFixed(1)} Z`

                // Current position marker
                const lockB = parseInt(stakeLockBlocks) || 0
                const clampedB = Math.min(lockB, maxB)
                const markerX = toX(clampedB)
                const markerMult = previewMult || 1
                const markerY = toY(markerMult)

                // Y-axis ticks
                const yTicks = 4
                const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => minM + (mRange * i) / yTicks)

                // X-axis ticks
                const xTicks = 5
                const xLabels = Array.from({ length: xTicks + 1 }, (_, i) => Math.round((maxB * i) / xTicks))

                return (
                  <div className="mt-4 border border-white/[0.06] rounded-lg bg-white/[0.01] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Multiplier Curve</span>
                      {previewMult !== null && lockB > 0 && (
                        <span className="text-[10px] text-cyan-400 font-bold tabular-nums">
                          {lockB.toLocaleString()} blocks = {previewMult.toFixed(2)}x
                        </span>
                      )}
                    </div>
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
                      {/* Grid lines */}
                      {yLabels.map((v, i) => (
                        <g key={`y${i}`}>
                          <line
                            x1={PAD_L} y1={toY(v)} x2={W - PAD_R} y2={toY(v)}
                            stroke="rgba(255,255,255,0.05)" strokeWidth="1"
                          />
                          <text x={PAD_L - 5} y={toY(v) + 3} textAnchor="end"
                            fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace"
                          >
                            {v.toFixed(1)}x
                          </text>
                        </g>
                      ))}
                      {xLabels.map((v, i) => (
                        <g key={`x${i}`}>
                          <line
                            x1={toX(v)} y1={PAD_T} x2={toX(v)} y2={PAD_T + ch}
                            stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                          />
                          <text x={toX(v)} y={H - 5} textAnchor="middle"
                            fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace"
                          >
                            {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                          </text>
                        </g>
                      ))}

                      {/* Fill under curve */}
                      <path d={fillD} fill="url(#curveGrad)" />
                      <defs>
                        <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(34,211,238,0.15)" />
                          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                        </linearGradient>
                      </defs>

                      {/* Curve line */}
                      <path d={pathD} fill="none" stroke="rgba(34,211,238,0.6)" strokeWidth="2" strokeLinejoin="round" />

                      {/* Marker vertical line */}
                      {lockB > 0 && (
                        <>
                          <line
                            x1={markerX} y1={PAD_T} x2={markerX} y2={PAD_T + ch}
                            stroke="rgba(34,211,238,0.3)" strokeWidth="1" strokeDasharray="3,3"
                          />
                          {/* Marker dot */}
                          <circle cx={markerX} cy={markerY} r="5" fill="rgba(34,211,238,0.9)" />
                          <circle cx={markerX} cy={markerY} r="8" fill="none" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
                          {/* Marker label */}
                          <text
                            x={markerX} y={markerY - 12} textAnchor="middle"
                            fill="rgba(34,211,238,1)" fontSize="10" fontWeight="bold" fontFamily="monospace"
                          >
                            {markerMult.toFixed(2)}x
                          </text>
                        </>
                      )}

                      {/* Curve dots at data points */}
                      {pts.map((p, i) => (
                        <circle key={i} cx={toX(p.blocks)} cy={toY(p.multiplierX)} r="2.5"
                          fill="rgba(34,211,238,0.4)" />
                      ))}
                    </svg>
                  </div>
                )
              })()}
            </div>

            {/* Positions */}
            <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <LockClosedIcon className="w-4 h-4 text-white/40" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Stake Positions</span>
                </div>
                <span className="text-[10px] text-white/30">{positions.length} position{positions.length !== 1 ? 's' : ''}</span>
              </div>

              {!connected ? (
                <div className="text-center py-12">
                  <span className="text-xs text-white/30 uppercase tracking-wider">Connect wallet to view positions</span>
                </div>
              ) : positions.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-xs text-white/30 uppercase tracking-wider">No active stakes</span>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-[60px_1fr_1fr_1fr_60px] gap-2 px-4 py-2 border-b border-white/5 bg-white/[0.01]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">ID</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">Staked</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">BLOC Earned</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">Lock</div>
                    <div></div>
                  </div>
                  {positions.map(s => {
                    const unlocked = s.blocksRemaining === 0
                    return (
                      <div key={s.stakeId} className="grid grid-cols-[60px_1fr_1fr_1fr_60px] gap-2 px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors items-center">
                        <span className="text-xs text-white/50 tabular-nums">#{s.stakeId}</span>
                        <span className="text-xs font-bold text-white/80 text-right tabular-nums">{fmtEth(s.amount)}</span>
                        <span className="text-xs font-bold text-cyan-400/80 text-right tabular-nums">{fmtEth(s.blocTimeBalance)}</span>
                        <span className={`text-xs text-right tabular-nums ${unlocked ? 'text-emerald-400/80' : 'text-amber-400/80'}`}>
                          {unlocked ? (
                            <span className="flex items-center gap-1 justify-end"><LockOpenIcon className="w-3 h-3" /> Unlocked</span>
                          ) : (
                            <span>{s.blocksRemaining.toLocaleString()} blocks</span>
                          )}
                        </span>
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleUnstake(s.stakeId)}
                            disabled={!unlocked}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              unlocked
                                ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                                : 'border-white/10 bg-white/5 text-white/20 cursor-not-allowed'
                            }`}
                            title={unlocked ? 'Unstake' : `Locked for ${s.blocksRemaining} blocks`}
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-white/15 uppercase tracking-wider py-4">
          BlocTime
        </div>
      </div>
    </div>
  )
}

export default dynamic(() => Promise.resolve(BlocTimeApp), { ssr: false })
