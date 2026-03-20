'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { ENGINE_URL, CHAIN_CONFIG, TOKENS, RPC_URLS, WRAPPED_NATIVE } from './config';

type Chain = 'base' | 'polygon';
type Tab = 'swap' | 'strategies' | 'copytrade';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

const WETH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
];

const STRATEGY_KINDS = [
  { value: 'dca', label: 'DCA', desc: 'Buy at regular intervals' },
  { value: 'limit_order', label: 'LIMIT', desc: 'Swap at target price' },
  { value: 'range_lp', label: 'RANGE_LP', desc: 'Concentrated liquidity' },
  { value: 'momentum', label: 'MOMENTUM', desc: 'SMA crossover' },
  { value: 'arb', label: 'ARB', desc: 'Cross-chain arbitrage' },
  { value: 'rebalance', label: 'REBALANCE', desc: 'Portfolio weights' },
  { value: 'copy_trade', label: 'COPY_TRADE', desc: 'Mirror wallet trades' },
];

interface Strategy {
  id: string;
  kind: string;
  chain: string;
  status: string;
  config: any;
  created_at: string;
  executions: { timestamp: string; action: string; result: string; tx_hash?: string }[];
}

interface WatchedWallet {
  address: string;
  nickname: string | null;
  added_at: string;
  last_synced: string | null;
}

interface WalletTrade {
  wallet: string;
  chain: string;
  tx_hash: string;
  block_number: number;
  timestamp: string;
  token_in: string;
  token_in_symbol: string;
  token_out: string;
  token_out_symbol: string;
  amount_in: string;
  amount_out: string;
  pool: string;
  fee: number;
}

interface WalletPerformance {
  wallet: string;
  total_trades: number;
  tokens_bought: { symbol: string; address: string; total_amount: string; trade_count: number }[];
  tokens_sold: { symbol: string; address: string; total_amount: string; trade_count: number }[];
  most_traded: string[];
  avg_trade_size_usd: number;
  total_volume_usd: number;
  first_trade: string | null;
  last_trade: string | null;
  active_days: number;
  trades_per_day: number;
}

interface WhitelistToken {
  address: string;
  symbol: string;
  decimals: number;
  chain: string;
  added_at: string;
}

interface TopTrader {
  rank: number;
  address: string;
  trade_count: number;
  total_volume_usd: number;
  most_traded: string[];
  last_active: string;
  first_seen: string;
}

interface ScanStatus {
  scanning: boolean;
  chain: string | null;
  days: number | null;
  blocks_scanned: number;
  blocks_total: number;
  progress_pct: number;
  wallets_found: number;
  started_at: string | null;
  error: string | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [activeChain, setActiveChain] = useState<Chain>('base');
  const [tab, setTab] = useState<Tab>('swap');

  // Swap state
  const tokens = TOKENS[activeChain];
  const tokenKeys = Object.keys(tokens);
  const [tokenIn, setTokenIn] = useState(tokens[tokenKeys[0]]);
  const [tokenOut, setTokenOut] = useState(tokens[tokenKeys[1]]);
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [estimatedOutput, setEstimatedOutput] = useState('');
  const [balanceIn, setBalanceIn] = useState('0');
  const [balanceOut, setBalanceOut] = useState('0');
  const [exchangeRate, setExchangeRate] = useState('');
  const [gasEstimate, setGasEstimate] = useState('');
  const [recentTxs, setRecentTxs] = useState<string[]>([]);

  // Wrap state
  const [wrapAmount, setWrapAmount] = useState('');
  const [wrapMode, setWrapMode] = useState<'wrap' | 'unwrap'>('wrap');
  const [wrapping, setWrapping] = useState(false);
  const [nativeBalance, setNativeBalance] = useState('0');
  const [wrappedBalance, setWrappedBalance] = useState('0');
  const [wrapTxHash, setWrapTxHash] = useState('');
  const [wrapError, setWrapError] = useState('');

  // Strategy state
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [showCreateStrategy, setShowCreateStrategy] = useState(false);
  const [newStrategyKind, setNewStrategyKind] = useState('dca');
  const [newStrategyChain, setNewStrategyChain] = useState<Chain>('base');
  const [newStrategyConfig, setNewStrategyConfig] = useState('{}');
  const [strategyError, setStrategyError] = useState('');

  // Copy trade state
  const [watchlist, setWatchlist] = useState<WatchedWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [walletTrades, setWalletTrades] = useState<WalletTrade[]>([]);
  const [walletPerf, setWalletPerf] = useState<WalletPerformance | null>(null);
  const [whitelist, setWhitelist] = useState<WhitelistToken[]>([]);
  const [newWalletAddr, setNewWalletAddr] = useState('');
  const [newWalletNick, setNewWalletNick] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showAddToken, setShowAddToken] = useState(false);
  const [newTokenAddr, setNewTokenAddr] = useState('');
  const [newTokenSymbol, setNewTokenSymbol] = useState('');
  const [newTokenDecimals, setNewTokenDecimals] = useState('18');
  const [copyTradeMax, setCopyTradeMax] = useState('0.01');
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Discovery state
  const [topTraders, setTopTraders] = useState<TopTrader[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [discoveryDays, setDiscoveryDays] = useState<number>(7);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  // Chain switch
  useEffect(() => {
    const keys = Object.keys(TOKENS[activeChain]);
    setTokenIn(TOKENS[activeChain][keys[0]]);
    setTokenOut(TOKENS[activeChain][keys[1]]);
    setAmountIn('');
    setEstimatedOutput('');
  }, [activeChain]);

  const switchToChain = useCallback((chain: Chain) => {
    setActiveChain(chain);
    const targetChainId = CHAIN_CONFIG[chain].id;
    if (chainId !== targetChainId) {
      switchChain({ chainId: targetChainId });
    }
  }, [chainId, switchChain]);

  // Balance fetching
  const fetchBalance = useCallback(async (token: typeof tokenIn, setter: (val: string) => void) => {
    if (!address) return;
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URLS[activeChain]);
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const balance = await contract.balanceOf(address);
      setter(parseFloat(ethers.formatUnits(balance, token.decimals)).toFixed(6));
    } catch {}
  }, [address, activeChain]);

  useEffect(() => {
    if (address) {
      fetchBalance(tokenIn, setBalanceIn);
      fetchBalance(tokenOut, setBalanceOut);
    }
  }, [address, tokenIn, tokenOut, fetchBalance]);

  const fetchWrapBalances = useCallback(async () => {
    if (!address) return;
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URLS[activeChain]);
      const native = await provider.getBalance(address);
      setNativeBalance(parseFloat(ethers.formatEther(native)).toFixed(6));
      const wn = WRAPPED_NATIVE[activeChain];
      const contract = new ethers.Contract(wn.address, WETH_ABI, provider);
      const wrapped = await contract.balanceOf(address);
      setWrappedBalance(parseFloat(ethers.formatEther(wrapped)).toFixed(6));
    } catch {}
  }, [address, activeChain]);

  useEffect(() => { fetchWrapBalances(); }, [fetchWrapBalances]);

  // Quote fetching
  useEffect(() => {
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setEstimatedOutput('');
      setExchangeRate('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${ENGINE_URL}/quote?chain=${activeChain}&token_in=${tokenIn.address}&token_out=${tokenOut.address}&amount=${amountIn}`
        );
        if (res.ok) {
          const data = await res.json();
          setEstimatedOutput(data.amount_out);
          const rate = parseFloat(data.amount_out) / parseFloat(amountIn);
          setExchangeRate(`1 ${tokenIn.symbol} = ${rate.toFixed(4)} ${tokenOut.symbol}`);
          setGasEstimate(`~${data.gas_estimate}`);
        }
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [amountIn, tokenIn, tokenOut, activeChain]);

  // Strategy fetching
  const fetchStrategies = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_URL}/strategies`);
      if (res.ok) setStrategies(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchStrategies();
    const i = setInterval(fetchStrategies, 10000);
    return () => clearInterval(i);
  }, [fetchStrategies]);

  // Copy trade data fetching
  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_URL}/watchlist`);
      if (res.ok) setWatchlist(await res.json());
    } catch {}
  }, []);

  const fetchWhitelist = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_URL}/whitelist?chain=${activeChain}`);
      if (res.ok) setWhitelist(await res.json());
    } catch {}
  }, [activeChain]);

  const fetchWalletData = useCallback(async (addr: string) => {
    try {
      const [tradesRes, perfRes] = await Promise.all([
        fetch(`${ENGINE_URL}/watchlist/${addr}/trades?chain=${activeChain}&days=30`),
        fetch(`${ENGINE_URL}/watchlist/${addr}/performance`),
      ]);
      if (tradesRes.ok) setWalletTrades(await tradesRes.json());
      if (perfRes.ok) setWalletPerf(await perfRes.json());
    } catch {}
  }, [activeChain]);

  useEffect(() => {
    if (tab === 'copytrade') {
      fetchWatchlist();
      fetchWhitelist();
    }
  }, [tab, fetchWatchlist, fetchWhitelist]);

  useEffect(() => {
    if (selectedWallet) fetchWalletData(selectedWallet);
  }, [selectedWallet, fetchWalletData]);

  // Actions
  const executeWrap = async () => {
    if (!walletClient || !address || !wrapAmount || parseFloat(wrapAmount) <= 0) return;
    setWrapping(true); setWrapError(''); setWrapTxHash('');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const wn = WRAPPED_NATIVE[activeChain];
      const contract = new ethers.Contract(wn.address, WETH_ABI, signer);
      const tx = wrapMode === 'wrap'
        ? await contract.deposit({ value: ethers.parseEther(wrapAmount) })
        : await contract.withdraw(ethers.parseEther(wrapAmount));
      const receipt = await tx.wait();
      setWrapTxHash(receipt.hash);
      setWrapAmount('');
      fetchWrapBalances();
    } catch (err: any) {
      setWrapError(err.reason || err.message || 'Failed');
    } finally { setWrapping(false); }
  };

  const executeSwap = async () => {
    if (!walletClient || !address || !amountIn) return;
    setLoading(true); setError(''); setTxHash('');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const tokenInContract = new ethers.Contract(tokenIn.address, ERC20_ABI, signer);
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);

      const buildRes = await fetch(`${ENGINE_URL}/swap/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: activeChain, token_in: tokenIn.address, token_out: tokenOut.address,
          amount_in: amountInWei.toString(), amount_out_min: '0', recipient: address, fee: 3000,
        }),
      });
      if (!buildRes.ok) throw new Error((await buildRes.json()).error || 'Build failed');
      const { swap: swapData, router } = await buildRes.json();

      const allowance = await tokenInContract.allowance(address, router);
      if (allowance < amountInWei) {
        setApproving(true);
        const approveTx = await tokenInContract.approve(router, ethers.MaxUint256);
        await approveTx.wait();
        setApproving(false);
      }

      const tx = await signer.sendTransaction({
        to: swapData.to, data: swapData.data,
        value: BigInt(swapData.value), gasLimit: BigInt(350000),
      });
      const receipt = await tx.wait();
      setTxHash(receipt!.hash);
      setRecentTxs(prev => [receipt!.hash, ...prev.slice(0, 4)]);
      setAmountIn(''); setEstimatedOutput('');
      fetchBalance(tokenIn, setBalanceIn);
      fetchBalance(tokenOut, setBalanceOut);
    } catch (err: any) {
      setError(err.reason || err.message || 'Swap failed');
    } finally { setLoading(false); setApproving(false); }
  };

  const swapTokens = () => {
    const temp = tokenIn; setTokenIn(tokenOut); setTokenOut(temp);
    setAmountIn(''); setEstimatedOutput('');
  };

  const createStrategy = async () => {
    setStrategyError('');
    try {
      const config = JSON.parse(newStrategyConfig);
      const res = await fetch(`${ENGINE_URL}/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: newStrategyKind, chain: newStrategyChain, config }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowCreateStrategy(false); setNewStrategyConfig('{}');
      fetchStrategies();
    } catch (err: any) { setStrategyError(err.message); }
  };

  const addToWatchlist = async () => {
    if (!newWalletAddr || newWalletAddr.length !== 42) return;
    try {
      await fetch(`${ENGINE_URL}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: newWalletAddr, nickname: newWalletNick || null }),
      });
      setNewWalletAddr(''); setNewWalletNick('');
      fetchWatchlist();
    } catch {}
  };

  const removeFromWatchlist = async (addr: string) => {
    await fetch(`${ENGINE_URL}/watchlist/${addr}`, { method: 'DELETE' });
    if (selectedWallet === addr) {
      setSelectedWallet(null); setWalletTrades([]); setWalletPerf(null);
    }
    fetchWatchlist();
  };

  const syncWallet = async (addr: string) => {
    setSyncing(true);
    try {
      await fetch(`${ENGINE_URL}/watchlist/${addr}/sync`, { method: 'POST' });
      fetchWalletData(addr);
      fetchWatchlist();
    } catch {} finally { setSyncing(false); }
  };

  const addToWhitelist = async () => {
    if (!newTokenAddr || !newTokenSymbol) return;
    try {
      await fetch(`${ENGINE_URL}/whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: activeChain, address: newTokenAddr,
          symbol: newTokenSymbol.toUpperCase(), decimals: parseInt(newTokenDecimals),
        }),
      });
      setNewTokenAddr(''); setNewTokenSymbol(''); setShowAddToken(false);
      fetchWhitelist();
    } catch {}
  };

  const removeFromWhitelist = async (chain: string, addr: string) => {
    await fetch(`${ENGINE_URL}/whitelist/${chain}/${addr}`, { method: 'DELETE' });
    fetchWhitelist();
  };

  const startCopyTrade = async () => {
    if (!selectedWallet) return;
    try {
      await fetch(`${ENGINE_URL}/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'copy_trade',
          chain: activeChain,
          config: {
            wallet_address: selectedWallet,
            max_trade_size: ethers.parseEther(copyTradeMax).toString(),
            slippage_tolerance: 0.01,
            interval_secs: 60,
          },
        }),
      });
      setShowCopyModal(false);
      fetchStrategies();
    } catch {}
  };

  // Discovery functions
  const fetchTopTraders = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_URL}/top-traders?chain=${activeChain}&days=${discoveryDays}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setTopTraders(data.traders || []);
      } else {
        setTopTraders([]);
      }
    } catch { setTopTraders([]); }
  }, [activeChain, discoveryDays]);

  const fetchScanStatus = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_URL}/top-traders/scan/status`);
      if (res.ok) {
        const status: ScanStatus = await res.json();
        setScanStatus(status);
        if (!status.scanning && discoveryLoading) {
          setDiscoveryLoading(false);
          fetchTopTraders();
        }
      }
    } catch {}
  }, [discoveryLoading, fetchTopTraders]);

  const startDiscoveryScan = async () => {
    try {
      setDiscoveryLoading(true);
      setScanStatus(null);
      const res = await fetch(`${ENGINE_URL}/top-traders/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: activeChain, days: discoveryDays }),
      });
      if (!res.ok) {
        const err = await res.json();
        setDiscoveryLoading(false);
        alert(err.error || 'Scan failed');
      }
    } catch { setDiscoveryLoading(false); }
  };

  const addTraderToWatchlist = async (addr: string) => {
    try {
      await fetch(`${ENGINE_URL}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, nickname: `Top #${topTraders.find(t => t.address === addr)?.rank || ''}` }),
      });
      fetchWatchlist();
    } catch {}
  };

  // Fetch top traders when copy tab opens or days change
  useEffect(() => {
    if (tab === 'copytrade') fetchTopTraders();
  }, [tab, fetchTopTraders]);

  // Poll scan status while scanning
  useEffect(() => {
    if (!discoveryLoading) return;
    const i = setInterval(fetchScanStatus, 2000);
    return () => clearInterval(i);
  }, [discoveryLoading, fetchScanStatus]);

  // Also check scan status on tab open (in case scan was running)
  useEffect(() => {
    if (tab === 'copytrade') fetchScanStatus();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const explorer = CHAIN_CONFIG[activeChain].explorer;
  const currentTokens = TOKENS[activeChain];

  return (
    <div className="min-h-screen text-retro-green">
      <div className="relative container mx-auto px-4 py-6 max-w-6xl">

        {/* HEADER */}
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-lg md:text-xl font-pixel glitch tracking-wider">
              {'>'} UNISWAP_ENGINE<span className="blink">_</span>
            </h1>
            <p className="text-[8px] text-retro-green/40 mt-2 tracking-widest">
              MULTICHAIN STRATEGY PROTOCOL v2.0
            </p>
          </div>
          <ConnectButton />
        </header>

        {/* CHAIN SELECTOR */}
        <div className="flex justify-center gap-3 mb-4">
          {(Object.keys(CHAIN_CONFIG) as Chain[]).map((chain) => (
            <button
              key={chain}
              onClick={() => switchToChain(chain)}
              className={`btn-pixel ${
                activeChain === chain
                  ? 'bg-retro-green text-black'
                  : 'bg-transparent text-retro-green border-retro-green'
              }`}
              style={{ borderColor: activeChain === chain ? '#000' : 'var(--retro-green)' }}
            >
              {CHAIN_CONFIG[chain].name}
            </button>
          ))}
        </div>

        {/* TAB SELECTOR */}
        <div className="flex justify-center gap-2 mb-6">
          {([
            { id: 'swap' as Tab, label: 'SWAP', color: 'retro-green' },
            { id: 'strategies' as Tab, label: `STRATS [${strategies.filter(s => s.status === 'active').length}]`, color: 'retro-cyan' },
            { id: 'copytrade' as Tab, label: `COPY [${watchlist.length}]`, color: 'retro-magenta' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`btn-pixel text-[8px] ${
                tab === t.id
                  ? `bg-${t.color} text-black`
                  : `bg-transparent text-${t.color}`
              }`}
              style={{
                backgroundColor: tab === t.id ? `var(--${t.color})` : 'transparent',
                color: tab === t.id ? '#000' : `var(--${t.color})`,
                borderColor: tab === t.id ? '#000' : `var(--${t.color})`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isConnected ? (
          <>
            {/* ========== SWAP TAB ========== */}
            {tab === 'swap' && (
              <div className="max-w-md mx-auto space-y-4">
                {/* Wrap/Unwrap */}
                <div className="card-pixel">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] text-retro-green/70">{'>'} WRAP_UNWRAP</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setWrapMode('wrap')}
                        className={`text-[8px] px-3 py-1 border ${wrapMode === 'wrap' ? 'bg-retro-green text-black border-retro-green' : 'border-retro-green/40 text-retro-green/40'}`}
                      >WRAP</button>
                      <button
                        onClick={() => setWrapMode('unwrap')}
                        className={`text-[8px] px-3 py-1 border ${wrapMode === 'unwrap' ? 'bg-retro-green text-black border-retro-green' : 'border-retro-green/40 text-retro-green/40'}`}
                      >UNWRAP</button>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <input
                        type="number" value={wrapAmount}
                        onChange={(e) => setWrapAmount(e.target.value)}
                        placeholder="0.0" className="input-pixel w-full"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[7px] text-retro-green/40">
                          {wrapMode === 'wrap' ? WRAPPED_NATIVE[activeChain].nativeSymbol : WRAPPED_NATIVE[activeChain].symbol}: {wrapMode === 'wrap' ? nativeBalance : wrappedBalance}
                        </span>
                        <button onClick={() => setWrapAmount(wrapMode === 'wrap' ? nativeBalance : wrappedBalance)} className="text-[7px] text-retro-cyan">MAX</button>
                      </div>
                    </div>
                    <button onClick={executeWrap} disabled={wrapping || !wrapAmount}
                      className="btn-pixel bg-retro-green text-black text-[8px]">
                      {wrapping ? '...' : wrapMode === 'wrap' ? 'WRAP' : 'UNWRAP'}
                    </button>
                  </div>
                  {wrapError && <p className="text-[8px] text-retro-red mt-2">{wrapError}</p>}
                  {wrapTxHash && (
                    <a href={`${explorer}/tx/${wrapTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-[8px] text-retro-cyan mt-2 block">TX: {wrapTxHash.slice(0, 14)}...</a>
                  )}
                </div>

                {/* Swap Card */}
                <div className="card-pixel pulse-glow">
                  <div className="space-y-3">
                    {/* Token In */}
                    <div className="bg-black/50 border border-retro-green/20 p-3">
                      <div className="flex justify-between mb-2">
                        <span className="text-[8px] text-retro-green/50">FROM</span>
                        <span className="text-[7px] text-retro-green/40">BAL: {balanceIn}</span>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={tokenIn.symbol}
                          onChange={(e) => setTokenIn(currentTokens[e.target.value])}
                          className="select-pixel"
                        >
                          {Object.values(currentTokens).map((t) => (
                            <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                          ))}
                        </select>
                        <div className="flex-1 relative">
                          <input type="number" value={amountIn} onChange={(e) => setAmountIn(e.target.value)}
                            placeholder="0.0" className="input-pixel w-full text-right text-sm" />
                          <button onClick={() => setAmountIn(balanceIn)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-[7px] text-retro-cyan border border-retro-cyan/40 px-1">MAX</button>
                        </div>
                      </div>
                    </div>

                    {/* Swap Arrow */}
                    <div className="flex justify-center">
                      <button onClick={swapTokens}
                        className="text-retro-green border-2 border-retro-green w-8 h-8 flex items-center justify-center hover:bg-retro-green hover:text-black transition-colors text-sm">
                        {'↕'}
                      </button>
                    </div>

                    {/* Token Out */}
                    <div className="bg-black/50 border border-retro-green/20 p-3">
                      <div className="flex justify-between mb-2">
                        <span className="text-[8px] text-retro-green/50">TO</span>
                        <span className="text-[7px] text-retro-green/40">BAL: {balanceOut}</span>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={tokenOut.symbol}
                          onChange={(e) => setTokenOut(currentTokens[e.target.value])}
                          className="select-pixel"
                        >
                          {Object.values(currentTokens).map((t) => (
                            <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                          ))}
                        </select>
                        <input type="text" value={estimatedOutput} readOnly placeholder="0.0"
                          className="input-pixel flex-1 text-right text-sm text-retro-cyan" />
                      </div>
                    </div>

                    {/* Rate Info */}
                    {exchangeRate && (
                      <div className="border border-retro-green/20 p-2 space-y-1">
                        <div className="flex justify-between text-[8px]">
                          <span className="text-retro-green/50">RATE</span>
                          <span className="text-retro-cyan">{exchangeRate}</span>
                        </div>
                        <div className="flex justify-between text-[8px]">
                          <span className="text-retro-green/50">GAS</span>
                          <span>{gasEstimate}</span>
                        </div>
                        <div className="flex justify-between text-[8px]">
                          <span className="text-retro-green/50">SLIPPAGE</span>
                          <span>{slippage}%</span>
                        </div>
                      </div>
                    )}

                    {/* Slippage */}
                    <div className="flex gap-1">
                      {['0.1', '0.5', '1.0', '3.0'].map((val) => (
                        <button key={val} onClick={() => setSlippage(val)}
                          className={`flex-1 py-2 text-[8px] border transition-colors ${
                            slippage === val
                              ? 'bg-retro-green text-black border-retro-green'
                              : 'border-retro-green/30 text-retro-green/50 hover:border-retro-green'
                          }`}>
                          {val}%
                        </button>
                      ))}
                    </div>

                    {/* Swap Button */}
                    <button onClick={executeSwap}
                      disabled={loading || !amountIn || parseFloat(amountIn) <= 0 || parseFloat(amountIn) > parseFloat(balanceIn)}
                      className="btn-pixel w-full bg-retro-cyan text-black py-3 text-[10px] tracking-wider disabled:bg-retro-green/20 disabled:text-retro-green/30">
                      {loading ? (approving ? '> APPROVING...' : '> SWAPPING...') :
                        parseFloat(amountIn) > parseFloat(balanceIn) ? 'INSUFFICIENT BALANCE' :
                        `> EXECUTE_SWAP [${CHAIN_CONFIG[activeChain].name}]`}
                    </button>
                  </div>

                  {error && (
                    <div className="mt-3 p-3 border border-retro-red bg-retro-red/10">
                      <p className="text-[8px] text-retro-red">{error}</p>
                    </div>
                  )}
                  {txHash && (
                    <div className="mt-3 p-3 border border-retro-green bg-retro-green/10">
                      <p className="text-[9px] text-retro-green mb-1">SWAP COMPLETE</p>
                      <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                        className="text-[8px] text-retro-cyan underline">{shortAddr(txHash)}</a>
                    </div>
                  )}
                </div>

                {/* Recent TXs */}
                {recentTxs.length > 0 && (
                  <div className="card-pixel">
                    <span className="text-[8px] text-retro-green/50 mb-2 block">{'>'} RECENT_TX</span>
                    {recentTxs.map((tx, i) => (
                      <a key={i} href={`${explorer}/tx/${tx}`} target="_blank" rel="noopener noreferrer"
                        className="block text-[7px] text-retro-cyan truncate py-1 border-t border-retro-green/10 first:border-0">
                        {tx}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========== STRATEGIES TAB ========== */}
            {tab === 'strategies' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => setShowCreateStrategy(!showCreateStrategy)}
                    className="btn-pixel bg-retro-cyan text-black">
                    {showCreateStrategy ? 'CANCEL' : '+ NEW_STRATEGY'}
                  </button>
                </div>

                {showCreateStrategy && (
                  <div className="card-pixel-cyan space-y-3" style={{ background: '#0d0d0d', border: '3px solid var(--retro-cyan)', boxShadow: '6px 6px 0 rgba(0, 255, 255, 0.15)' }}>
                    <span className="text-[9px] text-retro-cyan">{'>'} CREATE_STRATEGY</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[7px] text-retro-cyan/60 mb-1 block">TYPE</label>
                        <select value={newStrategyKind} onChange={(e) => setNewStrategyKind(e.target.value)}
                          className="select-pixel w-full" style={{ borderColor: 'var(--retro-cyan)', color: 'var(--retro-cyan)' }}>
                          {STRATEGY_KINDS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <p className="text-[7px] text-retro-cyan/40 mt-1">
                          {STRATEGY_KINDS.find(s => s.value === newStrategyKind)?.desc}
                        </p>
                      </div>
                      <div>
                        <label className="text-[7px] text-retro-cyan/60 mb-1 block">CHAIN</label>
                        <select value={newStrategyChain} onChange={(e) => setNewStrategyChain(e.target.value as Chain)}
                          className="select-pixel w-full" style={{ borderColor: 'var(--retro-cyan)', color: 'var(--retro-cyan)' }}>
                          {(Object.keys(CHAIN_CONFIG) as Chain[]).map((c) => (
                            <option key={c} value={c}>{CHAIN_CONFIG[c].name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[7px] text-retro-cyan/60 mb-1 block">CONFIG_JSON</label>
                      <textarea value={newStrategyConfig} onChange={(e) => setNewStrategyConfig(e.target.value)}
                        rows={5} className="input-pixel w-full text-[8px]" style={{ borderColor: 'var(--retro-cyan)', color: 'var(--retro-cyan)' }} />
                    </div>
                    {strategyError && <p className="text-[8px] text-retro-red">{strategyError}</p>}
                    <button onClick={createStrategy}
                      className="btn-pixel w-full bg-retro-cyan text-black">
                      {'>'} DEPLOY_STRATEGY
                    </button>
                  </div>
                )}

                {strategies.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-[10px] text-retro-green/30 mb-2">NO STRATEGIES DEPLOYED</p>
                    <p className="text-[8px] text-retro-green/20">Create your first strategy above</p>
                  </div>
                ) : (
                  strategies.map((s) => (
                    <div key={s.id} className="card-pixel">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[7px] px-2 py-1 ${
                            s.status === 'active' ? 'badge-active' :
                            s.status === 'paused' ? 'badge-paused' : 'badge-error'
                          }`}>
                            {s.status.toUpperCase()}
                          </span>
                          <span className="text-[9px] text-retro-cyan">{s.kind.toUpperCase()}</span>
                          <span className="text-[7px] text-retro-green/30">{s.chain}</span>
                        </div>
                        <div className="flex gap-1">
                          {s.status === 'active' && (
                            <button onClick={() => { fetch(`${ENGINE_URL}/strategies/${s.id}/pause`, { method: 'POST' }).then(fetchStrategies); }}
                              className="text-[7px] text-retro-yellow border border-retro-yellow px-2 py-1 hover:bg-retro-yellow hover:text-black">PAUSE</button>
                          )}
                          {s.status === 'paused' && (
                            <button onClick={() => { fetch(`${ENGINE_URL}/strategies/${s.id}/resume`, { method: 'POST' }).then(fetchStrategies); }}
                              className="text-[7px] text-retro-green border border-retro-green px-2 py-1 hover:bg-retro-green hover:text-black">RESUME</button>
                          )}
                          <button onClick={() => { fetch(`${ENGINE_URL}/strategies/${s.id}`, { method: 'DELETE' }).then(fetchStrategies); }}
                            className="text-[7px] text-retro-red border border-retro-red px-2 py-1 hover:bg-retro-red hover:text-black">DEL</button>
                        </div>
                      </div>
                      <div className="text-[7px] text-retro-green/30 mb-2">
                        ID:{s.id.slice(0, 8)} | {new Date(s.created_at).toLocaleDateString()}
                      </div>
                      <pre className="text-[7px] bg-black/60 border border-retro-green/10 p-2 overflow-x-auto text-retro-green/60 mb-2">
                        {JSON.stringify(s.config, null, 2)}
                      </pre>
                      {s.executions?.length > 0 && (
                        <div className="border-t border-retro-green/10 pt-2">
                          <span className="text-[7px] text-retro-green/30">LAST {Math.min(3, s.executions.length)} EXEC:</span>
                          {s.executions.slice(-3).reverse().map((ex, i) => (
                            <div key={i} className="text-[7px] py-0.5 text-retro-green/50">
                              <span className="text-retro-green/30">{new Date(ex.timestamp).toLocaleTimeString()}</span>
                              {' '}{ex.action} <span className={ex.result === 'ok' ? 'text-retro-green' : 'text-retro-red'}>[{ex.result}]</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ========== COPY TRADE TAB ========== */}
            {tab === 'copytrade' && (
              <div className="space-y-4">

                {/* TOP TRADERS DISCOVERY */}
                <div className="card-pixel" style={{ border: '3px solid var(--retro-magenta)', boxShadow: '6px 6px 0 rgba(255, 0, 255, 0.15)' }}>
                  {/* Header: Title + Lookback selector + Scan button */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] text-retro-magenta font-bold">{'>'} TOP_TRADERS [{activeChain.toUpperCase()}]</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 7, 14, 30].map((d) => (
                          <button key={d} onClick={() => setDiscoveryDays(d)}
                            className={`px-3 py-1 text-[8px] border transition-colors ${
                              discoveryDays === d
                                ? 'bg-retro-magenta text-black border-retro-magenta'
                                : 'border-retro-magenta/30 text-retro-magenta/50 hover:border-retro-magenta'
                            }`}>
                            {d}D
                          </button>
                        ))}
                      </div>
                      <button onClick={startDiscoveryScan}
                        disabled={discoveryLoading}
                        className="btn-pixel text-[8px] px-4"
                        style={{
                          background: discoveryLoading ? 'transparent' : 'var(--retro-magenta)',
                          color: discoveryLoading ? 'var(--retro-magenta)' : '#000',
                          borderColor: 'var(--retro-magenta)',
                        }}>
                        {discoveryLoading ? 'SCANNING...' : 'SCAN'}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar during scan */}
                  {scanStatus?.scanning && (
                    <div className="mb-3">
                      <div className="flex justify-between text-[7px] text-retro-magenta/60 mb-1">
                        <span>SCANNING {scanStatus.chain?.toUpperCase()}... {scanStatus.progress_pct.toFixed(1)}%</span>
                        <span>{scanStatus.wallets_found.toLocaleString()} wallets found</span>
                      </div>
                      <div className="w-full h-3 border border-retro-magenta/40 bg-black">
                        <div className="h-full bg-retro-magenta/60 transition-all duration-500"
                          style={{ width: `${Math.min(scanStatus.progress_pct, 100)}%` }} />
                      </div>
                      <div className="text-[6px] text-retro-magenta/30 mt-1">
                        {scanStatus.blocks_scanned.toLocaleString()} / {scanStatus.blocks_total.toLocaleString()} blocks
                      </div>
                    </div>
                  )}

                  {/* Scan error */}
                  {scanStatus?.error && !scanStatus.scanning && (
                    <div className="mb-3 p-2 border border-retro-red/40 text-[8px] text-retro-red">
                      ERROR: {scanStatus.error}
                    </div>
                  )}

                  {/* Leaderboard */}
                  {topTraders.length > 0 ? (
                    <div>
                      {/* Table header */}
                      <div className="flex items-center gap-2 px-2 py-1 border-b border-retro-magenta/30 text-[7px] text-retro-magenta/40">
                        <span className="w-8 text-right">#</span>
                        <span className="flex-1">ADDRESS</span>
                        <span className="w-14 text-right">TRADES</span>
                        <span className="w-20 text-right">VOLUME</span>
                        <span className="w-24 text-center hidden md:block">TOKENS</span>
                        <span className="w-14 text-right hidden md:block">LAST</span>
                        <span className="w-8"></span>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {topTraders.map((t) => (
                          <div key={t.address}
                            className="flex items-center gap-2 px-2 py-1.5 border-b border-retro-magenta/10 hover:bg-retro-magenta/5 transition-colors text-[8px]">
                            <span className="w-8 text-right text-retro-magenta font-bold">
                              {t.rank <= 3 ? ['', '1st', '2nd', '3rd'][t.rank] : `#${t.rank}`}
                            </span>
                            <span className="flex-1 text-retro-cyan font-mono">{shortAddr(t.address)}</span>
                            <span className="w-14 text-right text-retro-green">{t.trade_count}</span>
                            <span className="w-20 text-right text-retro-yellow">
                              ${t.total_volume_usd >= 1000000
                                ? `${(t.total_volume_usd / 1000000).toFixed(1)}M`
                                : t.total_volume_usd >= 1000
                                ? `${(t.total_volume_usd / 1000).toFixed(1)}K`
                                : t.total_volume_usd.toFixed(0)}
                            </span>
                            <span className="w-24 text-center hidden md:block text-retro-green/40 text-[7px]">
                              {t.most_traded.slice(0, 2).join('/')}
                            </span>
                            <span className="w-14 text-right hidden md:block text-retro-magenta/30 text-[6px]">
                              {timeAgo(t.last_active)}
                            </span>
                            <button onClick={() => addTraderToWatchlist(t.address)}
                              className="w-8 text-[8px] text-retro-cyan border border-retro-cyan/40 px-1 hover:bg-retro-cyan/20 transition-colors"
                              title="Add to watchlist">+</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : !scanStatus?.scanning && (
                    <div className="text-center py-6">
                      <p className="text-[9px] text-retro-magenta/30 mb-1">NO DATA YET</p>
                      <p className="text-[7px] text-retro-magenta/20">Hit SCAN to discover top traders on {activeChain.toUpperCase()}</p>
                    </div>
                  )}
                </div>

                {/* Top Section: Watchlist + Performance + Trades */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* LEFT: Watchlist */}
                  <div className="card-pixel-magenta" style={{ background: '#0d0d0d', border: '3px solid var(--retro-magenta)', boxShadow: '6px 6px 0 rgba(255, 0, 255, 0.15)' }}>
                    <span className="text-[9px] text-retro-magenta block mb-3">{'>'} WATCH_LIST</span>

                    {/* Add wallet */}
                    <div className="mb-3 space-y-1">
                      <input value={newWalletAddr} onChange={(e) => setNewWalletAddr(e.target.value)}
                        placeholder="0x..." className="input-pixel w-full text-[8px]"
                        style={{ borderColor: 'var(--retro-magenta)', color: 'var(--retro-magenta)' }} />
                      <input value={newWalletNick} onChange={(e) => setNewWalletNick(e.target.value)}
                        placeholder="NICKNAME" className="input-pixel w-full text-[8px]"
                        style={{ borderColor: 'var(--retro-magenta)', color: 'var(--retro-magenta)' }} />
                      <button onClick={addToWatchlist}
                        className="btn-pixel w-full text-[8px]"
                        style={{ background: 'var(--retro-magenta)', color: '#000', borderColor: '#000' }}>
                        + ADD_WALLET
                      </button>
                    </div>

                    {/* Wallet list */}
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {watchlist.map((w) => (
                        <div key={w.address}
                          onClick={() => setSelectedWallet(w.address)}
                          className={`p-2 border cursor-pointer transition-colors text-[8px] ${
                            selectedWallet === w.address
                              ? 'border-retro-cyan bg-retro-cyan/10 text-retro-cyan'
                              : 'border-retro-magenta/30 text-retro-magenta/70 hover:border-retro-magenta'
                          }`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-bold">{w.nickname || shortAddr(w.address)}</div>
                              <div className="text-[7px] opacity-50">{shortAddr(w.address)}</div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={(e) => { e.stopPropagation(); syncWallet(w.address); }}
                                className="text-[7px] text-retro-cyan border border-retro-cyan/40 px-1 hover:bg-retro-cyan/20"
                                title="Sync trades">
                                {syncing && selectedWallet === w.address ? '...' : 'SYNC'}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); removeFromWatchlist(w.address); }}
                                className="text-[7px] text-retro-red border border-retro-red/40 px-1 hover:bg-retro-red/20">X</button>
                            </div>
                          </div>
                          {w.last_synced && (
                            <div className="text-[6px] opacity-30 mt-0.5">synced: {timeAgo(w.last_synced)}</div>
                          )}
                        </div>
                      ))}
                      {watchlist.length === 0 && (
                        <div className="text-[8px] text-retro-magenta/30 text-center py-4">
                          No wallets tracked yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CENTER: Performance */}
                  <div className="card-pixel-cyan" style={{ background: '#0d0d0d', border: '3px solid var(--retro-cyan)', boxShadow: '6px 6px 0 rgba(0, 255, 255, 0.15)' }}>
                    <span className="text-[9px] text-retro-cyan block mb-3">{'>'} 30D_PERFORMANCE</span>

                    {walletPerf && walletPerf.total_trades > 0 ? (
                      <div className="space-y-2">
                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="border border-retro-cyan/20 p-2 text-center">
                            <div className="text-[14px] text-retro-cyan font-bold">{walletPerf.total_trades}</div>
                            <div className="text-[6px] text-retro-cyan/40">TRADES</div>
                          </div>
                          <div className="border border-retro-cyan/20 p-2 text-center">
                            <div className="text-[14px] text-retro-yellow font-bold">{walletPerf.active_days}</div>
                            <div className="text-[6px] text-retro-yellow/40">ACTIVE DAYS</div>
                          </div>
                          <div className="border border-retro-cyan/20 p-2 text-center">
                            <div className="text-[12px] text-retro-green font-bold">${walletPerf.total_volume_usd.toFixed(0)}</div>
                            <div className="text-[6px] text-retro-green/40">VOLUME USD</div>
                          </div>
                          <div className="border border-retro-cyan/20 p-2 text-center">
                            <div className="text-[12px] text-retro-magenta font-bold">{walletPerf.trades_per_day.toFixed(1)}</div>
                            <div className="text-[6px] text-retro-magenta/40">TRADES/DAY</div>
                          </div>
                        </div>

                        {/* Avg trade size */}
                        {walletPerf.avg_trade_size_usd > 0 && (
                          <div className="border border-retro-cyan/20 p-2">
                            <div className="flex justify-between text-[8px]">
                              <span className="text-retro-cyan/50">AVG_SIZE</span>
                              <span className="text-retro-cyan">${walletPerf.avg_trade_size_usd.toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        {/* Most traded */}
                        {walletPerf.most_traded.length > 0 && (
                          <div className="border border-retro-cyan/20 p-2">
                            <div className="text-[7px] text-retro-cyan/40 mb-1">MOST_TRADED</div>
                            <div className="flex flex-wrap gap-1">
                              {walletPerf.most_traded.map((sym) => (
                                <span key={sym} className="text-[8px] border border-retro-cyan/30 px-2 py-0.5 text-retro-cyan">{sym}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tokens bought */}
                        {walletPerf.tokens_bought.length > 0 && (
                          <div className="border border-retro-green/20 p-2">
                            <div className="text-[7px] text-retro-green/40 mb-1">BOUGHT</div>
                            {walletPerf.tokens_bought.slice(0, 4).map((t) => (
                              <div key={t.symbol} className="flex justify-between text-[7px] py-0.5">
                                <span className="text-retro-green">{t.symbol}</span>
                                <span className="text-retro-green/50">{t.trade_count}x</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tokens sold */}
                        {walletPerf.tokens_sold.length > 0 && (
                          <div className="border border-retro-red/20 p-2">
                            <div className="text-[7px] text-retro-red/40 mb-1">SOLD</div>
                            {walletPerf.tokens_sold.slice(0, 4).map((t) => (
                              <div key={t.symbol} className="flex justify-between text-[7px] py-0.5">
                                <span className="text-retro-red">{t.symbol}</span>
                                <span className="text-retro-red/50">{t.trade_count}x</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Time range */}
                        <div className="border border-retro-cyan/10 p-2 text-[7px] text-retro-cyan/30">
                          {walletPerf.first_trade && <div>FIRST: {timeAgo(walletPerf.first_trade)}</div>}
                          {walletPerf.last_trade && <div>LAST: {timeAgo(walletPerf.last_trade)}</div>}
                        </div>

                        {/* Copy button */}
                        <button onClick={() => setShowCopyModal(true)}
                          className="btn-pixel w-full text-[9px]"
                          style={{ background: 'var(--retro-magenta)', color: '#000', borderColor: '#000' }}>
                          {'>'} COPY_THIS_WALLET
                        </button>
                      </div>
                    ) : selectedWallet ? (
                      <div className="text-center py-8">
                        <p className="text-[9px] text-retro-cyan/30 mb-2">NO TRADE DATA</p>
                        <p className="text-[7px] text-retro-cyan/20 mb-3">Sync to fetch on-chain trades</p>
                        <button onClick={() => syncWallet(selectedWallet)}
                          className="btn-pixel text-[8px]"
                          style={{ background: 'var(--retro-cyan)', color: '#000', borderColor: '#000' }}>
                          {syncing ? 'SYNCING...' : 'SYNC_NOW'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-[9px] text-retro-cyan/30">SELECT A WALLET</p>
                        <p className="text-[7px] text-retro-cyan/20 mt-1">from the watchlist</p>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: Trade History */}
                  <div className="card-pixel-yellow" style={{ background: '#0d0d0d', border: '3px solid var(--retro-yellow)', boxShadow: '6px 6px 0 rgba(255, 255, 0, 0.15)' }}>
                    <span className="text-[9px] text-retro-yellow block mb-3">{'>'} TRADE_HISTORY</span>

                    {walletTrades.length > 0 ? (
                      <div className="space-y-1 max-h-96 overflow-y-auto">
                        {walletTrades.slice().reverse().map((t, i) => (
                          <div key={`${t.tx_hash}-${i}`}
                            className="p-2 border border-retro-yellow/15 bg-black/30 hover:border-retro-yellow/40 transition-colors">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[9px] text-retro-red">{t.token_in_symbol}</span>
                                <span className="text-[8px] text-retro-yellow/40 mx-1">{'>'}</span>
                                <span className="text-[9px] text-retro-green">{t.token_out_symbol}</span>
                              </div>
                              <span className="text-[6px] text-retro-yellow/30">{timeAgo(t.timestamp)}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <a href={`${explorer}/tx/${t.tx_hash}`} target="_blank" rel="noopener noreferrer"
                                className="text-[6px] text-retro-cyan/50 hover:text-retro-cyan">{shortAddr(t.tx_hash)}</a>
                              <span className="text-[6px] text-retro-yellow/30">{t.chain}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : selectedWallet ? (
                      <div className="text-center py-8">
                        <p className="text-[9px] text-retro-yellow/30">NO TRADES FOUND</p>
                        <p className="text-[7px] text-retro-yellow/20 mt-1">Sync to fetch history</p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-[9px] text-retro-yellow/30">SELECT A WALLET</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom: Token Whitelist */}
                <div className="card-pixel">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] text-retro-green">{'>'} TOKEN_WHITELIST [{activeChain.toUpperCase()}]</span>
                    <button onClick={() => setShowAddToken(!showAddToken)}
                      className="btn-pixel text-[7px] bg-retro-green text-black">
                      {showAddToken ? 'CANCEL' : '+ ADD'}
                    </button>
                  </div>

                  {showAddToken && (
                    <div className="border border-retro-green/30 p-3 mb-3 space-y-2">
                      <input value={newTokenAddr} onChange={(e) => setNewTokenAddr(e.target.value)}
                        placeholder="TOKEN ADDRESS (0x...)" className="input-pixel w-full text-[8px]" />
                      <div className="flex gap-2">
                        <input value={newTokenSymbol} onChange={(e) => setNewTokenSymbol(e.target.value)}
                          placeholder="SYMBOL" className="input-pixel flex-1 text-[8px]" />
                        <input value={newTokenDecimals} onChange={(e) => setNewTokenDecimals(e.target.value)}
                          placeholder="DEC" className="input-pixel w-20 text-[8px]" />
                      </div>
                      <button onClick={addToWhitelist}
                        className="btn-pixel w-full bg-retro-green text-black text-[8px]">ADD_TOKEN</button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {whitelist.map((t) => (
                      <div key={`${t.chain}-${t.address}`}
                        className="flex items-center gap-2 border border-retro-green/30 px-3 py-1.5 bg-black/30">
                        <span className="text-[9px] text-retro-green">{t.symbol}</span>
                        <span className="text-[6px] text-retro-green/30">{t.decimals}d</span>
                        <button onClick={() => removeFromWhitelist(activeChain, t.address)}
                          className="text-[8px] text-retro-red hover:text-retro-red/70 ml-1">X</button>
                      </div>
                    ))}
                    {whitelist.length === 0 && (
                      <span className="text-[8px] text-retro-green/30">No tokens whitelisted</span>
                    )}
                  </div>
                </div>

                {/* Copy Trade Modal */}
                {showCopyModal && selectedWallet && (
                  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="card-pixel max-w-sm w-full" style={{ border: '3px solid var(--retro-magenta)', boxShadow: '8px 8px 0 rgba(255, 0, 255, 0.3)' }}>
                      <span className="text-[10px] text-retro-magenta block mb-4">{'>'} SETUP_COPY_TRADE</span>

                      <div className="space-y-3">
                        <div className="border border-retro-magenta/20 p-2">
                          <div className="text-[7px] text-retro-magenta/40">TARGET</div>
                          <div className="text-[9px] text-retro-cyan">{shortAddr(selectedWallet)}</div>
                        </div>

                        <div>
                          <label className="text-[7px] text-retro-magenta/60 mb-1 block">MAX TRADE SIZE (ETH)</label>
                          <input value={copyTradeMax} onChange={(e) => setCopyTradeMax(e.target.value)}
                            type="number" step="0.001" className="input-pixel w-full text-[9px]"
                            style={{ borderColor: 'var(--retro-magenta)', color: 'var(--retro-magenta)' }} />
                        </div>

                        <div className="border border-retro-magenta/20 p-2 text-[7px] text-retro-magenta/40">
                          <div>CHAIN: {activeChain.toUpperCase()}</div>
                          <div>TICK: 60s</div>
                          <div>SLIPPAGE: 1%</div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => setShowCopyModal(false)}
                            className="btn-pixel flex-1 text-[8px] bg-transparent text-retro-magenta"
                            style={{ borderColor: 'var(--retro-magenta)' }}>CANCEL</button>
                          <button onClick={startCopyTrade}
                            className="btn-pixel flex-1 text-[8px]"
                            style={{ background: 'var(--retro-magenta)', color: '#000', borderColor: '#000' }}>
                            {'>'} START
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Not connected */
          <div className="text-center py-20">
            <div className="inline-block card-pixel p-10">
              <pre className="text-retro-green text-[10px] mb-6 leading-relaxed">
{`    ╔═══════════════════╗
    ║  UNISWAP ENGINE   ║
    ║  ═══════════════   ║
    ║  CONNECT WALLET    ║
    ║  TO BEGIN TRADING  ║
    ╚═══════════════════╝`}
              </pre>
              <p className="text-[8px] text-retro-green/40">
                BASE | POLYGON | STRATEGIES | COPY_TRADE
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center">
          <div className="text-[6px] text-retro-green/20 tracking-widest">
            UNISWAP_ENGINE v2.0 // RUST + NEXT.JS // {new Date().getFullYear()}
          </div>
        </footer>
      </div>
    </div>
  );
}
