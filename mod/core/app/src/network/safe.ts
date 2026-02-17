import { ethers } from 'ethers'

const SAFE_ABI = [
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function nonce() view returns (uint256)',
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

/**
 * Propose a Safe transaction via the Safe Protocol Kit
 * Returns the safeTxHash for tracking
 *
 * Uses the Safe SDK which has Node.js deps — this function must only be
 * called at runtime in the browser, never at build time.
 */
export async function proposeSafeTransaction(
  safeAddress: string,
  to: string,
  data: string,
  signer: ethers.Signer,
  chainId: bigint
): Promise<string> {
  const provider = signer.provider
  if (!provider) throw new Error('Signer has no provider')

  const signerAddress = await signer.getAddress()

  // Build a minimal Safe-like tx and sign it directly using the Safe contract
  // This avoids importing the heavy Safe SDK packages at build time.
  const SAFE_TX_ABI = [
    'function nonce() view returns (uint256)',
    'function getOwners() view returns (address[])',
    'function getThreshold() view returns (uint256)',
    'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver, bytes signatures) payable returns (bool success)',
    'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
  ]

  const safeContract = new ethers.Contract(safeAddress, SAFE_TX_ABI, signer)
  const nonce = await safeContract.nonce()
  const threshold = Number(await safeContract.getThreshold())

  // Get the transaction hash from the Safe contract
  const safeTxHash = await safeContract.getTransactionHash(
    to,            // to
    0,             // value
    data,          // data
    0,             // operation (Call)
    0,             // safeTxGas
    0,             // baseGas
    0,             // gasPrice
    ethers.ZeroAddress, // gasToken
    ethers.ZeroAddress, // refundReceiver
    nonce          // _nonce
  )

  // Sign the hash using EIP-191
  const signature = await signer.signMessage(ethers.getBytes(safeTxHash))

  // If threshold is 1, we can execute directly
  if (threshold <= 1) {
    // Encode signature in the format Safe expects: {bytes32 r}{bytes32 s}{uint8 v}
    const sig = ethers.Signature.from(signature)
    const encodedSig = ethers.solidityPacked(
      ['bytes32', 'bytes32', 'uint8'],
      [sig.r, sig.s, sig.v]
    )

    const tx = await safeContract.execTransaction(
      to,
      0,
      data,
      0,   // Call
      0,   // safeTxGas
      0,   // baseGas
      0,   // gasPrice
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      encodedSig
    )
    await tx.wait()
    return safeTxHash
  }

  // For multisig with threshold > 1, try the Safe Transaction Service API
  try {
    const serviceUrl = getTransactionServiceUrl(chainId)
    const response = await fetch(`${serviceUrl}/api/v1/safes/${safeAddress}/multisig-transactions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        value: '0',
        data,
        operation: 0,
        safeTxGas: '0',
        baseGas: '0',
        gasPrice: '0',
        gasToken: ethers.ZeroAddress,
        refundReceiver: ethers.ZeroAddress,
        nonce: Number(nonce),
        contractTransactionHash: safeTxHash,
        sender: signerAddress,
        signature,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Transaction Service error: ${err}`)
    }
  } catch (err) {
    console.warn('Safe Transaction Service not available:', err)
    throw new Error(
      `Transaction signed but could not be submitted to the Safe Transaction Service. ` +
      `This Safe requires ${threshold} confirmations. Please submit via the Safe app.`
    )
  }

  return safeTxHash
}

function getTransactionServiceUrl(chainId: bigint): string {
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
