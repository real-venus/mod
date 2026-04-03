import { NextRequest, NextResponse } from "next/server";

const CLOB_BASE = "https://clob.polymarket.com";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const path = searchParams.get("path") || "";
  const params = new URLSearchParams();

  searchParams.forEach((v, k) => {
    if (k !== "path") params.set(k, v);
  });

  const url = `${CLOB_BASE}/${path}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `CLOB ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "CLOB FETCH FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const path = searchParams.get("path") || "";

  // Forward auth headers from client
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const authKeys = ["POLY_API_KEY", "POLY_PASSPHRASE", "POLY_TIMESTAMP", "POLY_SIGNATURE"];
  for (const key of authKeys) {
    const val = req.headers.get(key);
    if (val) headers[key] = val;
  }

  const body = await req.text();
  const url = `${CLOB_BASE}/${path}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "CLOB POST FAILED" },
      { status: 500 }
    );
  }
}
