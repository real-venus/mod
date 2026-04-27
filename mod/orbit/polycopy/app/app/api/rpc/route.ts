import { NextRequest, NextResponse } from "next/server";

const CHAIN_RPCS: Record<number, string[]> = {
  137: [
    "https://polygon-bor-rpc.publicnode.com",
    "https://polygon.drpc.org",
    "https://rpc.ankr.com/polygon",
  ],
  8453: [
    "https://mainnet.base.org",
    "https://base-rpc.publicnode.com",
    "https://base.drpc.org",
  ],
  42161: [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum-one-rpc.publicnode.com",
    "https://arbitrum.drpc.org",
  ],
  1: [
    "https://eth.llamarpc.com",
    "https://ethereum-rpc.publicnode.com",
  ],
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const chainId = body.chainId as number;
  const method = body.method as string;
  const params = body.params as unknown[];

  if (!chainId || !method) {
    return NextResponse.json({ error: "chainId and method required" }, { status: 400 });
  }

  const rpcs = CHAIN_RPCS[chainId];
  if (!rpcs) {
    return NextResponse.json({ error: `unsupported chain: ${chainId}` }, { status: 400 });
  }

  const rpcBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });

  for (const rpcUrl of rpcs) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rpcBody,
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;
      return NextResponse.json(data);
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: `All RPCs failed for chain ${chainId}` },
    { status: 502 }
  );
}
