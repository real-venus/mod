'use client'

import { useState, useCallback } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { getAdapter } from '@/adapters'
import { toast } from 'react-toastify'

export type StakeStatus = 'idle' | 'approving' | 'staking' | 'unstaking' | 'success' | 'error'

export function useStake() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [status, setStatus] = useState<StakeStatus>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)

  const stake = useCallback(async (protocolId: string, token: string, amount: string) => {
    if (!address || !walletClient) {
      toast.error('Connect wallet first')
      return
    }

    const adapter = getAdapter(protocolId)
    if (!adapter) {
      toast.error('Protocol not found')
      return
    }

    try {
      // Step 1: Approve
      setStatus('approving')
      const approvalTx = await adapter.getApprovalTx(token, amount, address)
      if (approvalTx) {
        const approveTxHash = await walletClient.sendTransaction({
          to: approvalTx.to as `0x${string}`,
          data: approvalTx.data as `0x${string}`,
          account: address,
          chain: walletClient.chain,
        })
        toast.info('Approval submitted...')
        // Wait briefly for approval to propagate
        await new Promise(r => setTimeout(r, 3000))
      }

      // Step 2: Stake
      setStatus('staking')
      const stakeTx = await adapter.buildStakeTx(token, amount, address)
      const hash = await walletClient.sendTransaction({
        to: stakeTx.to as `0x${string}`,
        data: stakeTx.data as `0x${string}`,
        value: stakeTx.value,
        account: address,
        chain: walletClient.chain,
      })

      setTxHash(hash)
      setStatus('success')
      toast.success(
        <span>
          Staked! <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer" className="underline">View tx</a>
        </span>
      )
    } catch (err: any) {
      setStatus('error')
      toast.error(err?.shortMessage || err?.message || 'Transaction failed')
    }
  }, [address, walletClient])

  const unstake = useCallback(async (protocolId: string, token: string, amount: string) => {
    if (!address || !walletClient) {
      toast.error('Connect wallet first')
      return
    }

    const adapter = getAdapter(protocolId)
    if (!adapter) {
      toast.error('Protocol not found')
      return
    }

    try {
      setStatus('unstaking')
      const tx = await adapter.buildUnstakeTx(token, amount, address)
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: tx.value,
        account: address,
        chain: walletClient.chain,
      })

      setTxHash(hash)
      setStatus('success')
      toast.success(
        <span>
          Withdrawn! <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer" className="underline">View tx</a>
        </span>
      )
    } catch (err: any) {
      setStatus('error')
      toast.error(err?.shortMessage || err?.message || 'Transaction failed')
    }
  }, [address, walletClient])

  const reset = useCallback(() => {
    setStatus('idle')
    setTxHash(null)
  }, [])

  return { stake, unstake, status, txHash, reset }
}
