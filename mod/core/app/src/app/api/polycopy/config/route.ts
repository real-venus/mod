import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Get polycopy configuration
export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.POLYCOPY_API_URL || 'http://localhost:8001'

    const response = await fetch(`${apiUrl}/api/config`, {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`Polycopy API returned ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    )
  }
}

// Update polycopy configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const apiUrl = process.env.POLYCOPY_API_URL || 'http://localhost:8001'

    const response = await fetch(`${apiUrl}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`Polycopy API returned ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to update config:', error)
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    )
  }
}
