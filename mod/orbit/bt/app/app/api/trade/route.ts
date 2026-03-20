import { NextRequest, NextResponse } from "next/server";

/**
 * Trade API endpoints
 * In production, these proxy to the Python backend running bt.BtTrader
 *
 * POST /api/trade
 * Body: { action: "buy" | "sell" | "swap" | "copy", ...params }
 */

const BT_API_URL = process.env.BT_API_URL || "http://localhost:50110";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    // Proxy to Python backend
    const endpoint = `${BT_API_URL}/bt/${action}`;

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(30000),
      });

      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json(
          { error: `Backend error: ${text}` },
          { status: resp.status }
        );
      }

      const data = await resp.json();
      return NextResponse.json(data);
    } catch {
      // If backend is not running, return mock response
      return NextResponse.json({
        success: true,
        action,
        params,
        message: `${action} submitted (backend offline - mock response)`,
        mock: true,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Invalid request" },
      { status: 400 }
    );
  }
}
