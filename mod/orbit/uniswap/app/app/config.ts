import configJson from '../../config.json';

type Chain = 'base' | 'polygon';

const cfg = configJson as any;

export const ENGINE_PORT = cfg.engine?.port || 8080;
export const APP_PORT = cfg.app?.port || 3000;
export const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || `http://localhost:${ENGINE_PORT}`;

export const CHAIN_CONFIG: Record<Chain, { id: number; name: string; explorer: string }> = {} as any;
export const TOKENS: Record<Chain, Record<string, { address: string; symbol: string; decimals: number }>> = {} as any;
export const RPC_URLS: Record<Chain, string> = {} as any;
export const WRAPPED_NATIVE: Record<Chain, { address: string; symbol: string; nativeSymbol: string }> = {} as any;

for (const [key, chain] of Object.entries(cfg.chains || {})) {
  const c = chain as any;
  const k = key as Chain;

  CHAIN_CONFIG[k] = {
    id: c.chain_id,
    name: c.name,
    explorer: c.explorer,
  };

  RPC_URLS[k] = c.rpc_url;

  TOKENS[k] = {};
  for (const [sym, info] of Object.entries(c.tokens || {})) {
    const t = info as any;
    TOKENS[k][sym] = { address: t.address, symbol: sym, decimals: t.decimals };
  }

  if (c.wrapped_native) {
    WRAPPED_NATIVE[k] = {
      address: c.wrapped_native.address,
      symbol: c.wrapped_native.symbol,
      nativeSymbol: c.wrapped_native.native_symbol,
    };
  }
}
