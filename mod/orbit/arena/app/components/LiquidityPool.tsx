'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/app/providers'
import { getRewardPoolContract, getLeaderboardContract } from '@/utils/contracts'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'

interface PoolStats {
  ethLiquidity: string
  blocksPerDistribution: string
  lastDistributionBlock: string
  currentBlock: string
  blocksUntilNext: number
}

interface PendingReward {
  agentId: string
  ethReward: string
}

export function LiquidityPool() {
  const { address, isConnected } = useWallet()
  const [stats, setStats] = useState<PoolStats | null>(null)
  const [pendingRewards, setPendingRewards] = useState<PendingReward[]>([])
  const [depositAmount, setDepositAmount] = useState('')
  const [depositing, setDepositing] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)

  const loadPoolStats = async () => {
    try {
      const contract = await getRewardPoolContract()
      const provider = new ethers.BrowserProvider(window.ethereum!)

      const [ethLiquidity, blocksPerDist, lastDistBlock, currentBlock] = await Promise.all([
        contract.ethLiquidity(),
        contract.blocksPerDistribution(),
        contract.lastDistributionBlock(),
        provider.getBlockNumber(),
      ])

      const blocksUntilNext = Math.max(
        0,
        Number(lastDistBlock) + Number(blocksPerDist) - currentBlock
      )

      setStats({
        ethLiquidity: ethers.formatEther(ethLiquidity),
        blocksPerDistribution: blocksPerDist.toString(),
        lastDistributionBlock: lastDistBlock.toString(),
        currentBlock: currentBlock.toString(),
        blocksUntilNext,
      })
    } catch (error) {
      console.error('Failed to load pool stats:', error)
    }
  }

  const loadPendingRewards = async () => {
    if (!address) return

    try {
      const leaderboardContract = await getLeaderboardContract()
      const rewardPoolContract = await getRewardPoolContract()

      const myAgentIds = await leaderboardContract.getOwnerAgents(address)
      const rewards: PendingReward[] = []

      for (const agentId of myAgentIds) {
        const ethReward = await rewardPoolContract.getPendingRewards(agentId, ethers.ZeroAddress)
        if (ethReward > 0) {
          rewards.push({
            agentId,
            ethReward: ethers.formatEther(ethReward),
          })
        }
      }

      setPendingRewards(rewards)
    } catch (error) {
      console.error('Failed to load pending rewards:', error)
    }
  }

  const depositETH = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    try {
      setDepositing(true)
      const contract = await getRewardPoolContract(true)
      const tx = await contract.addEthLiquidity({
        value: ethers.parseEther(depositAmount),
      })
      await tx.wait()

      toast.success('ETH deposited successfully!')
      setDepositAmount('')
      await loadPoolStats()
    } catch (error: any) {
      console.error('Failed to deposit ETH:', error)
      toast.error(error?.reason || 'Failed to deposit ETH')
    } finally {
      setDepositing(false)
    }
  }

  const claimReward = async (agentId: string) => {
    try {
      setClaiming(agentId)
      const contract = await getRewardPoolContract(true)
      const tx = await contract.claimRewards(agentId, ethers.ZeroAddress)
      await tx.wait()

      toast.success('Rewards claimed successfully!')
      await loadPendingRewards()
      await loadPoolStats()
    } catch (error: any) {
      console.error('Failed to claim rewards:', error)
      toast.error(error?.reason || 'Failed to claim rewards')
    } finally {
      setClaiming(null)
    }
  }

  useEffect(() => {
    if (isConnected) {
      loadPoolStats()
      loadPendingRewards()
      const interval = setInterval(() => {
        loadPoolStats()
        loadPendingRewards()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [isConnected, address])

  return (
    <div className="space-y-6">
      {/* Pool Statistics */}
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Reward Pool Statistics</h2>
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-black/30 p-4 rounded-lg">
              <div className="text-gray-400 text-sm mb-1">Total ETH Liquidity</div>
              <div className="text-2xl font-bold text-purple-300">{stats.ethLiquidity} ETH</div>
            </div>
            <div className="bg-black/30 p-4 rounded-lg">
              <div className="text-gray-400 text-sm mb-1">Distribution Frequency</div>
              <div className="text-2xl font-bold text-purple-300">
                {stats.blocksPerDistribution} blocks
              </div>
            </div>
            <div className="bg-black/30 p-4 rounded-lg">
              <div className="text-gray-400 text-sm mb-1">Current Block</div>
              <div className="text-2xl font-bold text-purple-300">{stats.currentBlock}</div>
            </div>
            <div className="bg-black/30 p-4 rounded-lg">
              <div className="text-gray-400 text-sm mb-1">Next Distribution</div>
              <div className="text-2xl font-bold text-green-400">
                {stats.blocksUntilNext} blocks
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        )}
      </div>

      {/* Add Liquidity */}
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Add Liquidity</h2>
        <p className="text-gray-400 mb-4">
          Deposit ETH to the reward pool. Rewards are distributed automatically every{' '}
          {stats?.blocksPerDistribution || '...'} blocks to the top-ranked agents.
        </p>
        <div className="flex space-x-4">
          <input
            type="number"
            step="0.001"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount in ETH"
            className="flex-1 px-4 py-2 bg-black/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={depositETH}
            disabled={depositing}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all"
          >
            {depositing ? 'Depositing...' : 'Deposit ETH'}
          </button>
        </div>
      </div>

      {/* Pending Rewards */}
      {pendingRewards.length > 0 && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Pending Rewards</h2>
          <div className="space-y-3">
            {pendingRewards.map((reward) => (
              <div
                key={reward.agentId}
                className="flex justify-between items-center bg-black/30 p-4 rounded-lg"
              >
                <div>
                  <div className="text-white font-semibold">{reward.agentId}</div>
                  <div className="text-green-400 font-bold text-lg">{reward.ethReward} ETH</div>
                </div>
                <button
                  onClick={() => claimReward(reward.agentId)}
                  disabled={claiming === reward.agentId}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                >
                  {claiming === reward.agentId ? 'Claiming...' : 'Claim'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
        <div className="space-y-3 text-gray-300">
          <div className="flex items-start space-x-3">
            <div className="text-purple-400 font-bold">1.</div>
            <div>
              Businesses and users deposit ETH into the reward pool to incentivize agent performance
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-purple-400 font-bold">2.</div>
            <div>
              Every {stats?.blocksPerDistribution || '...'} blocks, 10% of the pool is distributed
              to the top 10 agents
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-purple-400 font-bold">3.</div>
            <div>
              Distribution: 1st place (30%), 2nd place (20%), 3rd place (15%), 4th-10th (5% each)
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-purple-400 font-bold">4.</div>
            <div>Agent owners can claim their accumulated rewards at any time</div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-purple-400 font-bold">5.</div>
            <div>
              Authorities (tournament organizers) update agent scores based on competition results
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
