import { NextRequest } from "next/server";

const BASE = process.env.CHUTES_BASE_URL || "https://api.chutes.ai";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") || "";
  const search = req.nextUrl.searchParams.get("q") || "";

  const upstream = await fetch(`${BASE}/chutes/?page=1&limit=200`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(err, { status: upstream.status });
  }

  let data = await upstream.json();

  // Filter if search query provided
  if (search && Array.isArray(data)) {
    const q = search.toLowerCase();
    data = data.filter((m: any) =>
      JSON.stringify(m).toLowerCase().includes(q)
    );
  }

  return Response.json(data);
}
