'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context'
import { DollarSign, CreditCard, AlertCircle, CheckCircle, Zap } from 'lucide-react'
import { MarketAllowanceManager } from '@/mod/network/marketAllowance'
import modConfig from '@/app/mod.json'
import { ethers } from 'ethers'
import MarketABI from '@/mod/contracts/abi/market/Market.sol/Market.json'

type TokenType = 'USDC' | 'USDT'

export const Billing: React.FC = () => {
  const { user, client } = userContext()
  const [marketCredit, setMarketCredit] = useState<number>(0)
  const [addAmount, setAddAmount] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [allowance, setAllowance] = useState<number>(0)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [allowanceManager, setAllowanceManager] = useState<MarketAllowanceManager | null>(null)
  const [selectedToken, setSelectedToken] = useState<TokenType>('USDC')
  const [useClientAddress, setUseClientAddress] = useState(false)
  const [transferAddress, setTransferAddress] = useState<string>('')

  useEffect(() => {
    const network = 'testnet'
    const chainConfig = modConfig.chain?.[network]
    if (chainConfig) {
      setAllowanceManager(new MarketAllowanceManager(chainConfig))
    }
  }, [])

  useEffect(() => {
    if (useClientAddress && client?.key?.address) {
      setTransferAddress(client.key.address)
    } else if (!useClientAddress) {
      setTransferAddress('')
    }
  }, [useClientAddress, client?.key?.address])

  useEffect(() => {
    const fetchCredit = async () => {
      if (!user?.key || !allowanceManager) return
      
      try {
        const network = 'testnet'
        const chainConfig = modConfig.chain?.[network]
        if (!chainConfig) throw new Error('Chain config not found')
        
        const provider = new ethers.BrowserProvider(window.ethereum)
        const marketAddress = chainConfig.contracts.Market.address
        const marketContract = new ethers.Contract(marketAddress, MarketABI.abi, provider)
        
        let balance = await marketContract.balanceOf(user.key)
        let decimals = await marketContract.decimals()
        console.log('Fetched decimals:', Number(decimals))
        decimals = Number(decimals) + 10
        balance = parseFloat(ethers.formatUnits(balance, decimals))
    
        setMarketCredit(balance)
        
        const currentAllowance = await allowanceManager.checkMarketAllowance(user.key, selectedToken)
        setAllowance(currentAllowance )
      } catch (err) {
        console.error('Error fetching market credit:', err)
        setMarketCredit(0)
      }
    }
    
    fetchCredit()
  }, [user, allowanceManager, selectedToken])

  const handleIncreaseAllowance = async () => {
    if (!addAmount || !allowanceManager || !user?.key) {
      setBillingError('Please enter an amount and ensure wallet is connected')
      return
    }

    const amount = parseFloat(addAmount)
    if (amount <= 0) {
      setBillingError('Amount must be greater than 0')
      return
    }

    setIsProcessing(true)
    setBillingError(null)
    setSuccess(null)

    try {
      await allowanceManager.increaseMarketAllowance(user.key, amount, selectedToken)
      
      const newAllowance = await allowanceManager.checkMarketAllowance(user.key, selectedToken)
      setAllowance(newAllowance)
      setNeedsApproval(false)
      
      setSuccess(`Successfully increased allowance by $${amount.toFixed(2)} using ${selectedToken}. You can now add credit.`)
    } catch (err: any) {
      let msg = err?.message || String(err)
      if (msg.includes('1010')) msg = 'Insufficient balance for transaction.'
      else if (msg.toLowerCase().includes('cancel')) msg = 'Transaction cancelled by user.'
      setBillingError(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddCredit = async () => {
    if (!addAmount || !allowanceManager || !user?.key) {
      setBillingError('Please enter an amount and ensure wallet is connected')
      return
    }

    const amount = parseFloat(addAmount)
    if (amount <= 0) {
      setBillingError('Amount must be greater than 0')
      return
    }

    if (allowance < amount) {
      setNeedsApproval(true)
      setBillingError(`Insufficient allowance. Current: $${allowance.toFixed(2)}, Required: $${amount.toFixed(2)}. Please increase allowance first.`)
      return
    }

    setIsProcessing(true)
    setBillingError(null)
    setSuccess(null)

    try {
      const targetAddress = useClientAddress && transferAddress ? transferAddress : user.key
      
      if (useClientAddress && !ethers.isAddress(transferAddress)) {
        throw new Error('Invalid client address')
      }

      await allowanceManager.addMarketCredit(targetAddress, amount, selectedToken)
      
      const network = 'testnet'
      const chainConfig = modConfig.chain?.[network]
      if (!chainConfig) throw new Error('Chain config not found')
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const marketAddress = chainConfig.contracts.Market.address
      const marketContract = new ethers.Contract(marketAddress, MarketABI.abi, provider)
      
      const balance = await marketContract.balanceOf(user.key)
      const formattedBalance = parseFloat(ethers.formatUnits(balance, 18))
      setMarketCredit(formattedBalance)
      
      const newAllowance = await allowanceManager.checkMarketAllowance(user.key, selectedToken)
      setAllowance(newAllowance)
      
      const successMsg = useClientAddress 
        ? `Successfully added $${amount.toFixed(2)} credit using ${selectedToken} to client address ${transferAddress.slice(0, 8)}...${transferAddress.slice(-6)}!`
        : `Successfully added $${amount.toFixed(2)} credit using ${selectedToken} to your account!`
      
      setSuccess(successMsg)
      setAddAmount('')
    } catch (err: any) {
      let msg = err?.message || String(err)
      if (msg.includes('1010')) msg = 'Insufficient balance for transaction.'
      else if (msg.toLowerCase().includes('cancel')) msg = 'Transaction cancelled by user.'
      setBillingError(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">

      <div className="p-6 bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-red-500/10 border-2 border-yellow-500/50 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-yellow-500/70 font-bold text-sm uppercase mb-2">Current Balance</div>
            <div className="text-yellow-500 font-black text-5xl">${marketCredit.toFixed(2)}</div>
          </div>
          <CreditCard size={64} className="text-yellow-500/30" />
        </div>
      </div>

      <div className="p-6 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 border-2 border-cyan-500/50 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-cyan-500/70 font-bold text-sm uppercase mb-2">Market Contract Allowance ({selectedToken})</div>
            <div className="text-cyan-500 font-black text-3xl">${allowance.toFixed(2)}</div>
          </div>
        </div>
        <div className="mt-4 text-cyan-500/60 text-sm">
          This is the amount the market contract is allowed to spend on your behalf using {selectedToken}.
        </div>
      </div>

      <div className="p-6 bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 border-2 border-green-500/50 rounded-xl shadow-2xl">
        <h2 className="text-2xl font-black text-green-500 uppercase mb-6 flex items-center gap-2">
          <Zap size={24} />
          Add Credit
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-green-500 font-bold text-sm uppercase mb-2 block">
              Select Token
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedToken('USDC')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold uppercase transition-all ${
                  selectedToken === 'USDC'
                    ? 'bg-green-500/30 border-2 border-green-500 text-green-300'
                    : 'bg-black/60 border-2 border-green-500/40 text-green-500/60 hover:border-green-500/60'
                }`}
              >
                USDC
              </button>
              <button
                onClick={() => setSelectedToken('USDT')}
                className={`flex-1 py-3 px-4 rounded-lg font-bold uppercase transition-all ${
                  selectedToken === 'USDT'
                    ? 'bg-green-500/30 border-2 border-green-500 text-green-300'
                    : 'bg-black/60 border-2 border-green-500/40 text-green-500/60 hover:border-green-500/60'
                }`}
              >
                USDT
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-black/40 border-2 border-cyan-500/30 rounded-lg">
            <input
              type="checkbox"
              checked={useClientAddress}
              onChange={(e) => setUseClientAddress(e.target.checked)}
              className="w-5 h-5 accent-cyan-500"
            />
            <label className="text-sm text-cyan-400 font-mono uppercase font-bold tracking-wide">
              Transfer to Client Address (Hotkey)
            </label>
          </div>

          {useClientAddress && client?.key?.address && (
            <div className="p-3 bg-cyan-500/10 border-2 border-cyan-500/30 rounded-lg">
              <div className="text-xs text-cyan-400 font-mono uppercase mb-1">Client Key Address:</div>
              <div className="text-sm text-cyan-300 font-mono font-bold break-all">{client.key.address}</div>
            </div>
          )}

          <div>
            <label className="text-green-500 font-bold text-sm uppercase mb-2 block">
              Amount (USD)
            </label>
            <input
              type="number"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              disabled={isProcessing}
              min="0"
              step="0.01"
              placeholder="100.00"
              className="w-full bg-black/60 border-2 border-green-500/40 rounded-lg px-4 py-3 text-green-300 font-mono text-lg placeholder-green-600/50 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/30 disabled:opacity-50 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleIncreaseAllowance}
              disabled={!addAmount || isProcessing}
              className="w-full py-4 border-2 border-cyan-500/60 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-500 hover:scale-[1.02] transition-all duration-300 rounded-xl font-mono uppercase font-black text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 shadow-lg"
            >
              {isProcessing ? (
                <>
                  <Zap size={20} className="animate-spin" />
                  <span>PROCESSING...</span>
                </>
              ) : (
                <>
                  <CreditCard size={20} />
                  <span>1. INCREASE ALLOWANCE</span>
                </>
              )}
            </button>

            <button
              onClick={handleAddCredit}
              disabled={!addAmount || isProcessing || needsApproval}
              className="w-full py-4 border-2 border-green-500/60 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 hover:bg-green-500/30 hover:border-green-500 hover:scale-[1.02] transition-all duration-300 rounded-xl font-mono uppercase font-black text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 shadow-lg"
            >
              {isProcessing ? (
                <>
                  <Zap size={20} className="animate-spin" />
                  <span>PROCESSING...</span>
                </>
              ) : (
                <>
                  <DollarSign size={20} />
                  <span>2. ADD CREDIT</span>
                </>
              )}
            </button>
          </div>

          <div className="text-green-500/60 text-sm space-y-2">
            <p><strong>Step 1:</strong> Increase the allowance to authorize the market contract to spend {selectedToken} tokens on your behalf.</p>
            <p><strong>Step 2:</strong> Add credit to {useClientAddress ? 'your client address' : 'your market account'} using the approved {selectedToken} allowance.</p>
          </div>
        </div>
      </div>

      {(success || billingError) && (
        <div
          className={`p-6 rounded-xl border-2 shadow-2xl ${
            billingError
              ? 'from-red-500/10 border-red-500/40 bg-gradient-to-br'
              : 'from-emerald-500/10 border-emerald-500/40 bg-gradient-to-br'
          }`}
        >
          <div className="flex items-center gap-3 text-base font-mono uppercase font-bold mb-4">
            {billingError ? (
              <>
                <AlertCircle size={20} className="text-red-500" />
                <span className="text-red-500">ERROR</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} className="text-emerald-500" />
                <span className="text-emerald-500">SUCCESS</span>
              </>
            )}
          </div>
          <div className={`font-mono text-base bg-black/60 p-4 rounded-lg border-2 ${
            billingError ? 'text-red-400 border-red-500/30' : 'text-emerald-400 border-emerald-500/30'
          } whitespace-pre-wrap font-bold`}>
            {billingError || success}
          </div>
        </div>
      )}

      <div className="p-6 bg-black/40 border-2 border-white/20 rounded-xl">
        <h3 className="text-xl font-black text-white/70 uppercase mb-4">How It Works</h3>
        <div className="space-y-3 text-white/60 text-sm">
          <p>• Your market credit is stored on-chain and can be used for purchasing modules and services</p>
          <p>• You can toggle between USDC and USDT as payment tokens</p>
          <p>• You must first approve the market contract to spend your tokens (Step 1)</p>
          <p>• Then you can add credit which transfers tokens to the market contract (Step 2)</p>
          <p>• Enable "Transfer to Client Address" to add credit directly to your client/hotkey address</p>
          <p>• All transactions are secured by smart contracts on the blockchain</p>
        </div>
      </div>
    </div>
  )
}

export default Billing