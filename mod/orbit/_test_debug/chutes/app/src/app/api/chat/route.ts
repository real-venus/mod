import { NextRequest } from "next/server";

const BASE = process.env.CHUTES_BASE_URL || "https://api.chutes.ai";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const apiKey = req.headers.get("x-api-key") || "";

  const upstream = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(err, { status: upstream.status });
  }

  // If streaming, pipe the SSE stream through
  if (body.stream) {
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const data = await upstream.json();
  return Response.json(data);
}
