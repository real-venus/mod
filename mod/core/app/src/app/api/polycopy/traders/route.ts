import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface TraderSearchParams {
  window?: string
  limit?: string
  min_volume?: string
  min_apr?: string
  sort_by?: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const params: TraderSearchParams = {
      window: searchParams.get('window') || '30d',
      limit: searchParams.get('limit') || '20',
      min_volume: searchParams.get('min_volume') || '10000',
      sort_by: searchParams.get('sort_by') || 'apr',
    }

    if (searchParams.get('min_apr')) {
      params.min_apr = searchParams.get('min_apr')!
    }

    // Call polycopy backend API
    const apiUrl = process.env.POLYCOPY_API_URL || 'http://localhost:8001'
    const queryString = new URLSearchParams(params as Record<string, string>).toString()

    const response = await fetch(`${apiUrl}/api/traders/search?${queryString}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`Polycopy API returned ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json({
      traders: data.traders || [],
      count: data.count || 0
    })
  } catch (error) {
    console.error('Failed to fetch traders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch traders', traders: [] },
      { status: 500 }
    )
  }
}
