import { NextRequest, NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

const DATA_PREFIXES = ["positions", "trades", "activity", "value", "holders", "users", "v1/"];
const CLOB_PREFIXES = ["prices-history", "book", "books", "midpoint", "midpoints", "price"];

function pickBase(endpoint: string): string {
  if (DATA_PREFIXES.some((p) => endpoint === p || endpoint.startsWith(p))) return DATA_API;
  if (CLOB_PREFIXES.some((p) => endpoint === p || endpoint.startsWith(p))) return CLOB_API;
  return GAMMA_API;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const endpoint = searchParams.get("endpoint") || "markets";
  const params = new URLSearchParams();

  searchParams.forEach((v, k) => {
    if (k !== "endpoint") params.set(k, v);
  });

  const url = `${pickBase(endpoint)}/${endpoint}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 15 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `API ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "FETCH FAILED" },
      { status: 500 }
    );
  }
}
