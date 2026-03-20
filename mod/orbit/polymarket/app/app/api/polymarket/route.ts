import { NextRequest, NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";

const DATA_ENDPOINTS = new Set([
  "positions", "trades", "activity", "value", "holders", "leaderboard",
  "profit-leaderboard", "volume-leaderboard",
]);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const endpoint = searchParams.get("endpoint") || "markets";
  const params = new URLSearchParams();

  searchParams.forEach((v, k) => {
    if (k !== "endpoint") params.set(k, v);
  });

  const baseUrl = DATA_ENDPOINTS.has(endpoint) ? DATA_API : GAMMA_API;
  const url = `${baseUrl}/${endpoint}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
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
