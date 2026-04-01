import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params
    const searchParams = request.nextUrl.searchParams
    const window = searchParams.get('window') || '30d'

    // Call polycopy backend API
    const apiUrl = process.env.POLYCOPY_API_URL || 'http://localhost:8001'

    const response = await fetch(
      `${apiUrl}/api/traders/profile/${address}?window=${window}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      throw new Error(`Polycopy API returned ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json(data.profile || {})
  } catch (error) {
    console.error('Failed to fetch trader profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trader profile' },
      { status: 500 }
    )
  }
}
