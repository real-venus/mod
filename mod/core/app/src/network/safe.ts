import { ethers } from 'ethers'

const SAFE_ABI = [
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function nonce() view returns (uint256)',
]

const SAFE_FULL_ABI = [
  'function nonce() view returns (uint256)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver, bytes signatures) payable returns (bool success)',
  'event ExecutionSuccess(bytes32 txHash, uint256 payment)',
  'event ExecutionFailure(bytes32 txHash, uint256 payment)',
]

/**
 * Detect if an address is a Gnosis Safe contract by probing Safe-specific methods
 */
export async function isSafeContract(address: string, provider: ethers.Provider): Promise<boolean> {
  try {
    const contract = new ethers.Contract(address, SAFE_ABI, provider)
    const [owners, threshold] = await Promise.all([
      contract.getOwners(),
      contract.getThreshold(),
    ])
    return Array.isArray(owners) && owners.length > 0 && Number(threshold) > 0
  } catch {
    return false
  }
}

/**
 * Get the list of Safe signer addresses
 */
export async function getSafeOwners(safeAddress: string, provider: ethers.Provider): Promise<string[]> {
  const contract = new ethers.Contract(safeAddress, SAFE_ABI, provider)
  return await contract.getOwners()
}

/**
 * Get the Safe threshold (number of confirmations required)
 */
export async function getSafeThreshold(safeAddress: string, provider: ethers.Provider): Promise<number> {
  const contract = new ethers.Contract(safeAddress, SAFE_ABI, provider)
  const threshold = await contract.getThreshold()
  return Number(threshold)
}

/**
 * Check if a user is one of the Safe signers
 */
export async function isUserSafeOwner(
  safeAddress: string,
  userAddress: string,
  provider: ethers.Provider
): Promise<boolean> {
  try {
    const owners = await getSafeOwners(safeAddress, provider)
    return owners.some(
      (owner: string) => owner.toLowerCase() === userAddress.toLowerCase()
    )
  } catch {
    return false
  }
}

export interface SafeInfo {
  address: string
  owners: string[]
  threshold: number
  nonce: number
}

/**
 * Get full Safe information
 */
export async function getSafeInfo(safeAddress: string, provider: ethers.Provider): Promise<SafeInfo> {
  const contract = new ethers.Contract(safeAddress, SAFE_ABI, provider)
  const [owners, threshold, nonce] = await Promise.all([
    contract.getOwners(),
    contract.getThreshold(),
    contract.nonce(),
  ])
  return {
    address: safeAddress,
    owners,
    threshold: Number(threshold),
    nonce: Number(nonce),
  }
}

// ── Local Pending Transaction Storage ──
// Custom-deployed Safe contracts are not recognized by the Safe Transaction
// Service. We store pending signatures in localStorage and execute on-chain
// once the threshold is met.

const STORAGE_KEY = 'safe_pending_txs'

export interface SafeConfirmation {
  owner: string
  signature: string
  submissionDate: string
}

export interface PendingTransaction {
  safe: string
  to: string
  value: string
  data: string
  operation: number
  safeTxGas: number
  baseGas: number
  gasPrice: string
  gasToken: string
  refundReceiver: string
  nonce: number
  submissionDate: string
  safeTxHash: string
  isExecuted: boolean
  confirmations: SafeConfirmation[]
  confirmationsRequired: number
}

function loadPendingTxs(): PendingTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePendingTxs(txs: PendingTransaction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txs))
}

export interface SafeTxParams {
  safe: string
  to: string
  data: string
  value: string
  chainId: string
  nonce: number
  threshold: number
  sender: string
  safeTxHash: string
}

/**
 * Propose a Safe transaction.
 *
 * For threshold=1: signs and executes on-chain immediately.
 * For threshold>1: signs, stores the pending tx in localStorage,
 * and waits for other owners to confirm before execution.
 */
export async function proposeSafeTransaction(
  safeAddress: string,
  to: string,
  data: string,
  signer: ethers.Signer,
  chainId: bigint,
  value: bigint = BigInt(0)
): Promise<{ safeTxHash: string; params: SafeTxParams }> {
  const provider = signer.provider
  if (!provider) throw new Error('Signer has no provider')

  const signerAddress = await signer.getAddress()
  const checksumSafe = ethers.getAddress(safeAddress)
  const checksumTo = ethers.getAddress(to)
  const checksumSender = ethers.getAddress(signerAddress)
  const safeContract = new ethers.Contract(checksumSafe, SAFE_FULL_ABI, signer)
  const nonce = await safeContract.nonce()
  const threshold = Number(await safeContract.getThreshold())

  // Use on-chain getTransactionHash() — canonical hash
  const safeTxHash: string = await safeContract.getTransactionHash(
    checksumTo,
    value,
    data,
    0,        // operation (Call)
    0,        // safeTxGas
    0,        // baseGas
    0,        // gasPrice
    ethers.ZeroAddress, // gasToken
    ethers.ZeroAddress, // refundReceiver
    nonce
  )

  const params: SafeTxParams = {
    safe: checksumSafe,
    to: checksumTo,
    data,
    value: value.toString(),
    chainId: chainId.toString(),
    nonce: Number(nonce),
    threshold,
    sender: checksumSender,
    safeTxHash,
  }
  console.log('[Safe] Transaction params:', params)

  // Sign using signMessage (eth_sign) — our custom Safe contract ALWAYS uses
  // keccak256("\x19Ethereum Signed Message:\n32" + dataHash) for ecrecover,
  // so we must use signMessage which applies that prefix automatically.
  // v stays as raw 27/28 since our contract has no v>30 branching.
  const rawSignature = await signer.signMessage(ethers.getBytes(safeTxHash))

  // If threshold is 1, execute immediately
  if (threshold <= 1) {
    const sig = ethers.Signature.from(rawSignature)
    const execSig = ethers.solidityPacked(
      ['bytes32', 'bytes32', 'uint8'],
      [sig.r, sig.s, sig.v]  // raw ECDSA v (27/28) — our contract has no v+4 logic
    )

    const tx = await safeContract.execTransaction(
      checksumTo,
      value,
      data,
      0, 0, 0, 0,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      execSig
    )
    await tx.wait()
    return { safeTxHash, params }
  }

  // For multisig: store pending tx with this signature in localStorage
  const allTxs = loadPendingTxs()

  // Check if this tx already exists (same safeTxHash)
  const existing = allTxs.find((t) => t.safeTxHash === safeTxHash)
  if (existing) {
    // Add confirmation if not already signed by this owner
    const alreadySigned = existing.confirmations.some(
      (c) => c.owner.toLowerCase() === checksumSender.toLowerCase()
    )
    if (!alreadySigned) {
      existing.confirmations.push({
        owner: checksumSender,
        signature: rawSignature,
        submissionDate: new Date().toISOString(),
      })
    }
    savePendingTxs(allTxs)
  } else {
    // Create new pending tx
    const pendingTx: PendingTransaction = {
      safe: checksumSafe,
      to: checksumTo,
      value: value.toString(),
      data,
      operation: 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: '0',
      gasToken: ethers.ZeroAddress,
      refundReceiver: ethers.ZeroAddress,
      nonce: Number(nonce),
      submissionDate: new Date().toISOString(),
      safeTxHash,
      isExecuted: false,
      confirmations: [
        {
          owner: checksumSender,
          signature: rawSignature,
          submissionDate: new Date().toISOString(),
        },
      ],
      confirmationsRequired: threshold,
    }
    allTxs.push(pendingTx)
    savePendingTxs(allTxs)
  }

  return { safeTxHash, params }
}

// ── Get Pending Transactions (from localStorage) ──

export async function getPendingTransactions(
  safeAddress: string,
  _chainId: bigint | number
): Promise<PendingTransaction[]> {
  const checksumSafe = ethers.getAddress(safeAddress)
  const allTxs = loadPendingTxs()
  return allTxs.filter(
    (tx) => tx.safe.toLowerCase() === checksumSafe.toLowerCase() && !tx.isExecuted
  )
}

// ── Remove stale transactions (nonce < on-chain nonce) ──

export function removeStalePendingTxs(safeAddress: string, onChainNonce: number): number {
  const checksumSafe = ethers.getAddress(safeAddress)
  const allTxs = loadPendingTxs()
  const before = allTxs.length
  const filtered = allTxs.filter(
    (tx) =>
      tx.safe.toLowerCase() !== checksumSafe.toLowerCase() ||
      tx.nonce >= onChainNonce
  )
  savePendingTxs(filtered)
  return before - filtered.length
}

// ── Confirm (add signature to) a pending transaction ──

export async function confirmTransaction(
  _safeAddress: string,
  safeTxHash: string,
  signer: ethers.Signer,
  _chainId: bigint | number
): Promise<void> {
  const signerAddress = ethers.getAddress(await signer.getAddress())

  const allTxs = loadPendingTxs()
  const tx = allTxs.find((t) => t.safeTxHash === safeTxHash)
  if (!tx) throw new Error('Transaction not found')

  const alreadySigned = tx.confirmations.some(
    (c) => c.owner.toLowerCase() === signerAddress.toLowerCase()
  )
  if (alreadySigned) throw new Error('Already confirmed by this signer')

  // Sign using signMessage — our custom Safe always wraps with personal message prefix
  const rawSignature = await signer.signMessage(ethers.getBytes(safeTxHash))

  tx.confirmations.push({
    owner: signerAddress,
    signature: rawSignature,
    submissionDate: new Date().toISOString(),
  })
  savePendingTxs(allTxs)
}

// ── Execute a pending transaction on-chain ──

export async function executeTransaction(
  safeAddress: string,
  pendingTx: PendingTransaction,
  signer: ethers.Signer
): Promise<string> {
  const checksumSafe = ethers.getAddress(safeAddress)
  const safeContract = new ethers.Contract(checksumSafe, SAFE_FULL_ABI, signer)

  // Verify nonce hasn't changed since signing
  const currentNonce = await safeContract.nonce()
  if (Number(currentNonce) !== pendingTx.nonce) {
    throw new Error(
      `Nonce mismatch: transaction was signed at nonce ${pendingTx.nonce} ` +
      `but Safe is now at nonce ${Number(currentNonce)}. Please re-propose this transaction.`
    )
  }

  // Sort confirmations by owner address ascending (Safe contract requirement)
  // Compare as BigInt to match Solidity's uint160 address comparison
  const sorted = [...pendingTx.confirmations].sort((a, b) => {
    const addrA = BigInt(a.owner)
    const addrB = BigInt(b.owner)
    if (addrA < addrB) return -1
    if (addrA > addrB) return 1
    return 0
  })

  // Combine signatures: each is 65 bytes (r + s + v)
  // eth_sign signatures with raw ECDSA v (27/28) — our contract has no v+4 logic
  let combinedSigs = '0x'
  for (const conf of sorted) {
    const sig = ethers.Signature.from(conf.signature)
    console.log('[Safe] Sig from', conf.owner, '→ v:', sig.v, 'r:', sig.r.slice(0, 10), 's:', sig.s.slice(0, 10))
    const packed = ethers.solidityPacked(
      ['bytes32', 'bytes32', 'uint8'],
      [sig.r, sig.s, sig.v]  // raw v (27/28)
    )
    combinedSigs += packed.slice(2)
  }

  const tx = await safeContract.execTransaction(
    pendingTx.to,
    pendingTx.value,
    pendingTx.data || '0x',
    pendingTx.operation,
    pendingTx.safeTxGas,
    pendingTx.baseGas,
    pendingTx.gasPrice,
    pendingTx.gasToken,
    pendingTx.refundReceiver,
    combinedSigs
  )
  const receipt = await tx.wait()

  // Mark as executed in storage
  const allTxs = loadPendingTxs()
  const stored = allTxs.find((t) => t.safeTxHash === pendingTx.safeTxHash)
  if (stored) stored.isExecuted = true
  savePendingTxs(allTxs)

  return receipt.hash
}

// ── Owner Management Encoders (Safe self-calls) ──

const SAFE_OWNER_ABI = [
  'function addOwnerWithThreshold(address owner, uint256 _threshold)',
  'function removeOwner(address prevOwner, address owner, uint256 _threshold)',
  'function changeThreshold(uint256 _threshold)',
]

export function encodeAddOwnerWithThreshold(owner: string, threshold: number): string {
  const iface = new ethers.Interface(SAFE_OWNER_ABI)
  return iface.encodeFunctionData('addOwnerWithThreshold', [owner, threshold])
}

export function encodeRemoveOwner(prevOwner: string, owner: string, threshold: number): string {
  const iface = new ethers.Interface(SAFE_OWNER_ABI)
  return iface.encodeFunctionData('removeOwner', [prevOwner, owner, threshold])
}

export function encodeChangeThreshold(threshold: number): string {
  const iface = new ethers.Interface(SAFE_OWNER_ABI)
  return iface.encodeFunctionData('changeThreshold', [threshold])
}

// ── Generic Contract Call Encoder ──

export function encodeContractCall(abi: any[], functionName: string, args: any[]): string {
  const iface = new ethers.Interface(abi)
  return iface.encodeFunctionData(functionName, args)
}

// ── Get Executed Transactions (on-chain event logs) ──

export interface ExecutedTransaction {
  txHash: string       // on-chain tx hash
  safeTxHash: string   // Safe's internal tx hash from event
  blockNumber: number
  timestamp: number    // unix seconds
  to: string
  value: string
  data: string
  success: boolean
  executor: string     // msg.sender who called execTransaction
}

export async function getExecutedTransactions(
  safeAddress: string,
  provider: ethers.Provider,
): Promise<ExecutedTransaction[]> {
  const checksumSafe = ethers.getAddress(safeAddress)
  const safeContract = new ethers.Contract(checksumSafe, SAFE_FULL_ABI, provider)

  // Scan in chunks to avoid RPC 413 (payload too large) errors
  const currentBlock = await provider.getBlockNumber()
  const CHUNK_SIZE = 50_000
  const MAX_HISTORY = 500_000 // scan at most ~500k blocks back
  const startBlock = Math.max(0, currentBlock - MAX_HISTORY)

  const allSuccess: ethers.EventLog[] = []
  const allFailure: ethers.EventLog[] = []

  for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
    const to = Math.min(from + CHUNK_SIZE - 1, currentBlock)
    try {
      const [success, failure] = await Promise.all([
        safeContract.queryFilter(safeContract.filters.ExecutionSuccess(), from, to),
        safeContract.queryFilter(safeContract.filters.ExecutionFailure(), from, to),
      ])
      allSuccess.push(...(success as ethers.EventLog[]))
      allFailure.push(...(failure as ethers.EventLog[]))
    } catch (err: any) {
      console.warn(`Failed to query blocks ${from}-${to}:`, err?.message)
    }
  }

  // Decode execTransaction calldata from each tx to get to/value/data
  const iface = new ethers.Interface(SAFE_FULL_ABI)
  const results: ExecutedTransaction[] = []
  const successSet = new Set(allSuccess)

  for (const log of [...allSuccess, ...allFailure]) {
    const isSuccess = successSet.has(log)
    const txReceipt = await log.getTransaction()
    if (!txReceipt) continue

    let to = '', value = '0', data = '0x'
    try {
      const decoded = iface.decodeFunctionData('execTransaction', txReceipt.data)
      to = decoded[0]
      value = decoded[1].toString()
      data = decoded[2]
    } catch {
      // Not an execTransaction call (shouldn't happen)
    }

    const block = await log.getBlock()

    results.push({
      txHash: txReceipt.hash,
      safeTxHash: (log as any).args?.[0] || '',
      blockNumber: log.blockNumber,
      timestamp: block?.timestamp || 0,
      to,
      value,
      data,
      success: isSuccess,
      executor: txReceipt.from,
    })
  }

  // Sort by block number descending (newest first)
  results.sort((a, b) => b.blockNumber - a.blockNumber)
  return results
}

// ── Utility: get Transaction Service URL (kept for future canonical Safe use) ──

export function getTransactionServiceUrl(chainId: bigint | number): string {
  const urls: Record<string, string> = {
    '1': 'https://safe-transaction-mainnet.safe.global',
    '10': 'https://safe-transaction-optimism.safe.global',
    '56': 'https://safe-transaction-bsc.safe.global',
    '100': 'https://safe-transaction-gnosis-chain.safe.global',
    '137': 'https://safe-transaction-polygon.safe.global',
    '8453': 'https://safe-transaction-base.safe.global',
    '42161': 'https://safe-transaction-arbitrum.safe.global',
    '84532': 'https://safe-transaction-base-sepolia.safe.global',
    '11155111': 'https://safe-transaction-sepolia.safe.global',
  }
  return urls[chainId.toString()] || 'https://safe-transaction-mainnet.safe.global'
}
