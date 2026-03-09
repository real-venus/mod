import { useState, useEffect } from 'react'
import { useAccount, useNetwork, usePublicClient, useWalletClient } from 'wagmi'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'
import { PREFI_V3_ABI, ERC20_ABI, getContractAddress, parsePrice, formatPrice } from '@/lib/contracts'

export function usePreFi() {
  const { address } = useAccount()
  const { chain } = useNetwork()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [isLoading, setIsLoading] = useState(false)
  const [markets, setMarkets] = useState<any[]>([])
  const [userPredictions, setUserPredictions] = useState<any[]>([])

  const getContract = (isWrite = false) => {
    if (!chain) return null

    const contractAddress = getContractAddress(chain.id, 'preFiV3')
    if (!contractAddress) return null

    if (isWrite && walletClient) {
      const provider = new ethers.BrowserProvider(walletClient as any)
      return provider.getSigner().then(signer =>
        new ethers.Contract(contractAddress, PREFI_V3_ABI, signer)
      )
    }

    if (publicClient) {
      const provider = new ethers.JsonRpcProvider(chain.rpcUrls.default.http[0])
      return new ethers.Contract(contractAddress, PREFI_V3_ABI, provider)
    }

    return null
  }

  const getStakeTokenContract = async (isWrite = false) => {
    if (!chain) return null

    const tokenAddress = getContractAddress(chain.id, 'stakeToken')
    if (!tokenAddress) return null

    if (isWrite && walletClient) {
      const provider = new ethers.BrowserProvider(walletClient as any)
      const signer = await provider.getSigner()
      return new ethers.Contract(tokenAddress, ERC20_ABI, signer)
    }

    const provider = new ethers.JsonRpcProvider(chain.rpcUrls.default.http[0])
    return new ethers.Contract(tokenAddress, ERC20_ABI, provider)
  }

  // Fetch markets
  const fetchMarkets = async () => {
    try {
      const contract = await getContract()
      if (!contract) return

      const marketCount = await contract.marketCounter()
      const marketsData = []

      for (let i = 1; i <= Number(marketCount); i++) {
        const info = await contract.getMarketInfo(i)
        marketsData.push({
          id: i,
          asset: info[0],
          tokenAddress: info[1],
          startTime: Number(info[2]),
          endTime: Number(info[3]),
          settled: info[4],
          actualPrice: info[5],
          totalStaked: info[6],
          playersCount: Number(info[7]),
        })
      }

      setMarkets(marketsData)
    } catch (error) {
      console.error('Error fetching markets:', error)
    }
  }

  // Fetch user predictions
  const fetchUserPredictions = async () => {
    if (!address || !chain) return

    try {
      const contract = await getContract()
      if (!contract) return

      const marketCount = await contract.marketCounter()
      const predictions = []

      for (let i = 1; i <= Number(marketCount); i++) {
        const pred = await contract.getPrediction(i, address)
        if (pred[1] > 0n) { // Has staked amount
          predictions.push({
            marketId: i,
            predictedPrice: pred[0],
            stakedAmount: pred[1],
            timestamp: Number(pred[2]),
            claimed: pred[3],
            reward: pred[4],
          })
        }
      }

      setUserPredictions(predictions)
    } catch (error) {
      console.error('Error fetching predictions:', error)
    }
  }

  // Place prediction
  const placePrediction = async (marketId: number, predictedPrice: string, stakeAmount: string) => {
    if (!walletClient || !address) {
      toast.error('Please connect your wallet')
      return false
    }

    setIsLoading(true)

    try {
      // 1. Approve tokens
      const stakeToken = await getStakeTokenContract(true)
      if (!stakeToken) throw new Error('Stake token not found')

      const contract = await getContract(true)
      if (!contract) throw new Error('Contract not found')

      const amount = parsePrice(stakeAmount)
      const price = parsePrice(predictedPrice)

      // Check allowance
      const allowance = await stakeToken.allowance(address, await contract.getAddress())

      if (allowance < amount) {
        toast.info('Approving tokens...')
        const approveTx = await stakeToken.approve(await contract.getAddress(), amount)
        await approveTx.wait()
        toast.success('Tokens approved!')
      }

      // 2. Place prediction
      toast.info('Placing prediction...')
      const tx = await contract.predict(marketId, price, amount)
      await tx.wait()

      toast.success('Prediction placed successfully! 🎉')
      await fetchMarkets()
      await fetchUserPredictions()

      return true
    } catch (error: any) {
      console.error('Error placing prediction:', error)
      toast.error(error.reason || error.message || 'Failed to place prediction')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // Claim reward
  const claimReward = async (marketId: number) => {
    if (!walletClient) {
      toast.error('Please connect your wallet')
      return false
    }

    setIsLoading(true)

    try {
      const contract = await getContract(true)
      if (!contract) throw new Error('Contract not found')

      toast.info('Claiming reward...')
      const tx = await contract.claimReward(marketId)
      await tx.wait()

      toast.success('Reward claimed! 💰')
      await fetchUserPredictions()

      return true
    } catch (error: any) {
      console.error('Error claiming reward:', error)
      toast.error(error.reason || error.message || 'Failed to claim reward')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // Get token balance
  const getTokenBalance = async () => {
    if (!address || !chain) return '0'

    try {
      const token = await getStakeTokenContract()
      if (!token) return '0'

      const balance = await token.balanceOf(address)
      return formatPrice(balance)
    } catch (error) {
      console.error('Error getting balance:', error)
      return '0'
    }
  }

  useEffect(() => {
    if (chain) {
      fetchMarkets()
    }
  }, [chain])

  useEffect(() => {
    if (address && chain) {
      fetchUserPredictions()
    }
  }, [address, chain])

  return {
    markets,
    userPredictions,
    isLoading,
    placePrediction,
    claimReward,
    getTokenBalance,
    refreshMarkets: fetchMarkets,
    refreshPredictions: fetchUserPredictions,
  }
}
