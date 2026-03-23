'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/app/providers'
import { getLeaderboardContract } from '@/utils/contracts'
import { toast } from 'react-toastify'

interface Agent {
  agentId: string
  owner: string
  score: string
  rank: number
  totalRewardsClaimed: string
}

export function Leaderboard() {
  const { address, isConnected } = useWallet()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [newAgentId, setNewAgentId] = useState('')

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      const contract = await getLeaderboardContract()
      const topAgents = await contract.getLeaderboard(20)

      const agentData: Agent[] = []

      for (let i = 0; i < topAgents.length; i++) {
        if (topAgents[i]) {
          const agent = await contract.getAgent(topAgents[i])
          agentData.push({
            agentId: topAgents[i],
            owner: agent.owner,
            score: agent.score.toString(),
            rank: i + 1,
            totalRewardsClaimed: agent.totalRewardsClaimed.toString(),
          })
        }
      }

      setAgents(agentData)
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
      toast.error('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  const registerAgent = async () => {
    if (!newAgentId.trim()) {
      toast.error('Please enter an agent ID')
      return
    }

    try {
      setRegistering(true)
      const contract = await getLeaderboardContract(true)
      const tx = await contract.registerAgent(newAgentId)
      await tx.wait()

      toast.success('Agent registered successfully!')
      setNewAgentId('')
      await loadLeaderboard()
    } catch (error: any) {
      console.error('Failed to register agent:', error)
      toast.error(error?.reason || 'Failed to register agent')
    } finally {
      setRegistering(false)
    }
  }

  useEffect(() => {
    if (isConnected) {
      loadLeaderboard()
      const interval = setInterval(loadLeaderboard, 10000) // Refresh every 10s
      return () => clearInterval(interval)
    }
  }, [isConnected])

  const myAgents = agents.filter((a) => a.owner.toLowerCase() === address?.toLowerCase())

  return (
    <div className="space-y-6">
      {/* Register Agent */}
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Register New Agent</h2>
        <div className="flex space-x-4">
          <input
            type="text"
            value={newAgentId}
            onChange={(e) => setNewAgentId(e.target.value)}
            placeholder="Enter agent ID (e.g., my-agent-v1)"
            className="flex-1 px-4 py-2 bg-black/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={registerAgent}
            disabled={registering}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all"
          >
            {registering ? 'Registering...' : 'Register Agent'}
          </button>
        </div>
      </div>

      {/* My Agents */}
      {myAgents.length > 0 && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">My Agents</h2>
          <div className="space-y-3">
            {myAgents.map((agent) => (
              <div
                key={agent.agentId}
                className="flex justify-between items-center bg-black/30 p-4 rounded-lg"
              >
                <div>
                  <div className="text-white font-semibold">{agent.agentId}</div>
                  <div className="text-sm text-gray-400">
                    Score: {agent.score} | Rank: #{agent.rank}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-semibold">
                    {(parseFloat(agent.totalRewardsClaimed) / 1e18).toFixed(4)} ETH
                  </div>
                  <div className="text-xs text-gray-500">Total Claimed</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Global Leaderboard</h2>
          <button
            onClick={loadLeaderboard}
            className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 text-white rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No agents registered yet. Be the first!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-purple-500/30">
                  <th className="text-left py-3 px-4 text-purple-300 font-semibold">Rank</th>
                  <th className="text-left py-3 px-4 text-purple-300 font-semibold">Agent ID</th>
                  <th className="text-left py-3 px-4 text-purple-300 font-semibold">Owner</th>
                  <th className="text-right py-3 px-4 text-purple-300 font-semibold">Score</th>
                  <th className="text-right py-3 px-4 text-purple-300 font-semibold">
                    Total Claimed
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, idx) => (
                  <tr
                    key={agent.agentId}
                    className={`border-b border-purple-500/10 hover:bg-purple-500/5 ${
                      agent.owner.toLowerCase() === address?.toLowerCase()
                        ? 'bg-green-500/10'
                        : ''
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        {idx < 3 && (
                          <span className="text-2xl">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                          </span>
                        )}
                        <span className="text-white font-bold">#{agent.rank}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-white font-mono">{agent.agentId}</td>
                    <td className="py-4 px-4 text-gray-400 font-mono text-sm">
                      {agent.owner.substring(0, 6)}...{agent.owner.substring(38)}
                    </td>
                    <td className="py-4 px-4 text-right text-purple-300 font-bold text-lg">
                      {agent.score}
                    </td>
                    <td className="py-4 px-4 text-right text-green-400 font-semibold">
                      {(parseFloat(agent.totalRewardsClaimed) / 1e18).toFixed(4)} ETH
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
