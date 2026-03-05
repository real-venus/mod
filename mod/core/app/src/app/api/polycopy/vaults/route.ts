import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Vaults endpoint - for copy trading vaults/strategies
export async function GET(request: NextRequest) {
  try {
    // Call polycopy backend API for vault/strategy data
    const apiUrl = process.env.POLYCOPY_API_URL || 'http://localhost:8001'

    const response = await fetch(`${apiUrl}/api/vaults`, {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      // If the endpoint doesn't exist yet, return empty array
      if (response.status === 404) {
        return NextResponse.json({
          vaults: [],
          count: 0
        })
      }
      throw new Error(`Polycopy API returned ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json({
      vaults: data.vaults || [],
      count: data.count || 0
    })
  } catch (error) {
    console.error('Failed to fetch vaults:', error)
    // Return empty array instead of error to prevent UI from breaking
    return NextResponse.json({
      vaults: [],
      count: 0
    })
  }
}
