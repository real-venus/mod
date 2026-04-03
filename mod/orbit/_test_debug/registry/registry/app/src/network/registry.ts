import { ethers } from 'ethers';
import RegistryABI from '@/contracts/Registry.json';
import appConfig from '@/config.json';

// ─── Interfaces ──────────────────────────────────────────────

export interface ModEntry {
  id: number;
  owner: string;
  name: string;
  data: string;
}

export interface NetworkConfig {
  type: string;
  name: string;
  rpc: string;
  chain_id?: number;
  registry?: string;
  account?: string | null;
  program_id?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────

export function getNetworks(): Record<string, NetworkConfig> {
  return appConfig.networks as Record<string, NetworkConfig>;
}

export function getEvmNetworks(): Record<string, NetworkConfig> {
  const all = getNetworks();
  const evm: Record<string, NetworkConfig> = {};
  for (const [key, net] of Object.entries(all)) {
    if (net.type === 'evm') {
      evm[key] = net;
    }
  }
  return evm;
}

export function getDefaultNetwork(): string {
  const networks = getNetworks();
  const def = appConfig.default_network || 'testnet';
  // Try exact match first, then partial match
  if (networks[def]) return def;
  const match = Object.keys(networks).find((k) => k.includes(def));
  return match || Object.keys(networks)[0];
}

export function getProvider(): ethers.BrowserProvider {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
  }
  return new ethers.BrowserProvider(window.ethereum);
}

export function getReadProvider(rpc: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpc);
}

// ─── Data URI helpers ────────────────────────────────────────

export function parseDataUri(uri: string): { provider: string; cid: string } {
  const parts = uri.split('/');
  if (parts.length < 2) {
    return { provider: 'unknown', cid: uri };
  }
  return { provider: parts[0], cid: parts.slice(1).join('/') };
}

export function gatewayUrl(uri: string): string {
  const { provider, cid } = parseDataUri(uri);
  switch (provider) {
    case 'ipfs':
      return `https://ipfs.io/ipfs/${cid}`;
    case 'lighthouse':
      return `https://gateway.lighthouse.storage/ipfs/${cid}`;
    case 'filecoin':
      return `https://dweb.link/ipfs/${cid}`;
    default:
      return uri;
  }
}

// ─── Registry Class ──────────────────────────────────────────

export class Registry {
  private networkKey: string;
  private config: NetworkConfig;

  constructor(networkKey?: string) {
    this.networkKey = networkKey || getDefaultNetwork();
    const networks = getNetworks();
    this.config = networks[this.networkKey];
    if (!this.config) {
      throw new Error(`Network "${this.networkKey}" not found in config`);
    }
  }

  get networkName(): string {
    return this.config.name;
  }

  get registryAddress(): string {
    return this.config.registry || '';
  }

  get networkType(): string {
    return this.config.type;
  }

  // ── Read contract (JsonRpcProvider) ──

  private getReadContract(): ethers.Contract {
    const provider = getReadProvider(this.config.rpc);
    return new ethers.Contract(this.registryAddress, RegistryABI.abi, provider);
  }

  async getNextModId(): Promise<number> {
    const contract = this.getReadContract();
    const id = await contract.nextModId();
    return Number(id);
  }

  async getMod(id: number): Promise<ModEntry> {
    const contract = this.getReadContract();
    const [owner, name, data] = await contract.getMod(id);
    return { id, owner, name, data };
  }

  async getUserMods(address: string): Promise<number[]> {
    const contract = this.getReadContract();
    const ids: bigint[] = await contract.getUserMods(address);
    return ids.map((id) => Number(id));
  }

  async isNameTaken(creator: string, name: string): Promise<boolean> {
    const contract = this.getReadContract();
    return await contract.isNameTaken(creator, name);
  }

  async listAll(): Promise<ModEntry[]> {
    const nextId = await this.getNextModId();
    const mods: ModEntry[] = [];
    const contract = this.getReadContract();

    for (let i = 1; i < nextId; i++) {
      try {
        const [owner, name, data] = await contract.getMod(i);
        // Skip removed mods (owner is zero address)
        if (owner === ethers.ZeroAddress) continue;
        mods.push({ id: i, owner, name, data });
      } catch {
        // Skip invalid entries
      }
    }

    return mods;
  }

  // ── Write contract (BrowserProvider + signer) ──

  private async getWriteContract(): Promise<ethers.Contract> {
    const provider = getProvider();
    const signer = await provider.getSigner();
    return new ethers.Contract(this.registryAddress, RegistryABI.abi, signer);
  }

  async registerMod(name: string, data: string): Promise<number> {
    const contract = await this.getWriteContract();
    const tx = await contract.registerMod(name, data);
    const receipt = await tx.wait();

    // Parse ModRegistered event to get the mod ID
    const iface = new ethers.Interface(RegistryABI.abi);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed && parsed.name === 'ModRegistered') {
          return Number(parsed.args.modId);
        }
      } catch {
        // Not our event, skip
      }
    }

    // Fallback: return nextModId - 1
    const nextId = await this.getNextModId();
    return nextId - 1;
  }

  async updateMod(modId: number, data: string): Promise<void> {
    const contract = await this.getWriteContract();
    const tx = await contract.updateMod(modId, data);
    await tx.wait();
  }

  async removeMod(modId: number): Promise<void> {
    const contract = await this.getWriteContract();
    const tx = await contract.removeMod(modId);
    await tx.wait();
  }

  async transferOwnership(modId: number, newOwner: string): Promise<void> {
    const contract = await this.getWriteContract();
    const tx = await contract.transferOwnership(modId, newOwner);
    await tx.wait();
  }
}
