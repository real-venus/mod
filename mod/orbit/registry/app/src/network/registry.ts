import { ethers } from 'ethers'
import RegistryABI from '@/contracts/Registry.json'
import appConfig from '@/config.json'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ModEntry {
  id: number
  owner: string
  name: string
  data: string // prefixed CID: ipfs/{cid}, lighthouse/{cid}, filecoin/{cid}
}

export interface NetworkConfig {
  type: string
  name: string
  rpc: string
  chain_id?: number
  registry?: string
  account?: string | null
  program_id?: string | null
}

// ── Provider ────────────────────────────────────────────────────────────────

function getProvider(): ethers.BrowserProvider {
  if (typeof window === 'undefined') {
    throw new Error('Window is undefined')
  }
  if (!window.ethereum) {
    throw new Error('No wallet found. Install MetaMask.')
  }
  return new ethers.BrowserProvider(window.ethereum)
}

function getReadProvider(rpc: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpc)
}

// ── Network helpers ─────────────────────────────────────────────────────────

export function getNetworks(): Record<string, NetworkConfig> {
  return appConfig.networks as Record<string, NetworkConfig>
}

export function getEvmNetworks(): Record<string, NetworkConfig> {
  const all = getNetworks()
  const evm: Record<string, NetworkConfig> = {}
  for (const [k, v] of Object.entries(all)) {
    if (v.type === 'evm' && v.registry) evm[k] = v
  }
  return evm
}

export function getDefaultNetwork(): string {
  const nets = getEvmNetworks()
  const keys = Object.keys(nets)
  if (keys.includes('evm_testnet')) return 'evm_testnet'
  return keys[0] || ''
}

// ── Registry class ──────────────────────────────────────────────────────────

export class Registry {
  private networkKey: string
  private config: NetworkConfig

  constructor(networkKey?: string) {
    this.networkKey = networkKey || getDefaultNetwork()
    const nets = getNetworks()
    this.config = nets[this.networkKey]
    if (!this.config) {
      throw new Error(`Network ${this.networkKey} not found`)
    }
  }

  get networkName(): string {
    return this.config.name
  }

  get registryAddress(): string {
    return this.config.registry || ''
  }

  get networkType(): string {
    return this.config.type
  }

  // ── Read-only (no wallet needed) ──────────────────────────────────────

  private getReadContract(): ethers.Contract {
    const provider = getReadProvider(this.config.rpc)
    return new ethers.Contract(this.registryAddress, RegistryABI.abi, provider)
  }

  async getNextModId(): Promise<number> {
    const contract = this.getReadContract()
    const next = await contract.nextModId()
    return Number(next)
  }

  async getMod(modId: number): Promise<ModEntry | null> {
    const contract = this.getReadContract()
    const [owner, name, data] = await contract.getMod(modId)
    if (owner === ethers.ZeroAddress) return null
    return { id: modId, owner, name, data }
  }

  async getUserMods(address: string): Promise<number[]> {
    const contract = this.getReadContract()
    const ids = await contract.getUserMods(address)
    return ids.map((id: bigint) => Number(id))
  }

  async isNameTaken(creator: string, name: string): Promise<boolean> {
    const contract = this.getReadContract()
    return contract.isNameTaken(creator, name)
  }

  async listAll(): Promise<ModEntry[]> {
    const nextId = await this.getNextModId()
    const mods: ModEntry[] = []
    for (let i = 1; i < nextId; i++) {
      const mod = await this.getMod(i)
      if (mod) mods.push(mod)
    }
    return mods
  }

  // ── Write (wallet required) ───────────────────────────────────────────

  private async getWriteContract(): Promise<ethers.Contract> {
    const provider = getProvider()
    const signer = await provider.getSigner()
    return new ethers.Contract(this.registryAddress, RegistryABI.abi, signer)
  }

  async registerMod(name: string, data: string): Promise<number> {
    const contract = await this.getWriteContract()
    const tx = await contract.registerMod(name, data)
    const receipt = await tx.wait()

    // Parse event to get mod ID
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data })
        if (parsed && parsed.name === 'ModRegistered') {
          return Number(parsed.args.modId)
        }
      } catch { /* skip unparseable logs */ }
    }

    // Fallback
    const nextId = await this.getNextModId()
    return nextId - 1
  }

  async updateMod(modId: number, data: string): Promise<boolean> {
    const contract = await this.getWriteContract()
    const tx = await contract.updateMod(modId, data)
    await tx.wait()
    return true
  }

  async removeMod(modId: number): Promise<boolean> {
    const contract = await this.getWriteContract()
    const tx = await contract.removeMod(modId)
    await tx.wait()
    return true
  }

  async transferOwnership(modId: number, newOwner: string): Promise<boolean> {
    const contract = await this.getWriteContract()
    const tx = await contract.transferOwnership(modId, newOwner)
    await tx.wait()
    return true
  }
}

// ── Data URI helpers ────────────────────────────────────────────────────────

export function parseDataUri(uri: string): { provider: string | null; cid: string } {
  for (const p of ['ipfs', 'lighthouse', 'filecoin']) {
    if (uri.startsWith(`${p}/`)) {
      return { provider: p, cid: uri.slice(p.length + 1) }
    }
  }
  return { provider: null, cid: uri }
}

export function gatewayUrl(uri: string): string {
  const { provider, cid } = parseDataUri(uri)
  if (provider === 'ipfs' || provider === 'filecoin') {
    return `https://ipfs.io/ipfs/${cid}`
  }
  if (provider === 'lighthouse') {
    return `https://gateway.lighthouse.storage/ipfs/${cid}`
  }
  return uri
}
