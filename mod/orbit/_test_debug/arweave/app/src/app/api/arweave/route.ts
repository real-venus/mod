import { NextRequest, NextResponse } from 'next/server'

const ARWEAVE_API = process.env.ARWEAVE_API || 'http://localhost:8000/arweave'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data, tags, cid, size } = body

    let endpoint = ''
    let payload: any = {}

    switch (action) {
      case 'add':
        endpoint = `${ARWEAVE_API}/add`
        payload = { data, tags }
        break

      case 'get':
        endpoint = `${ARWEAVE_API}/get`
        payload = { cid }
        break

      case 'cat':
        endpoint = `${ARWEAVE_API}/cat`
        payload = { cid }
        break

      case 'balance':
        endpoint = `${ARWEAVE_API}/balance`
        break

      case 'price':
        endpoint = `${ARWEAVE_API}/price`
        payload = { size }
        break

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Arweave API error: ${errorText}` },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Arweave API route error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    service: 'Arweave API',
    endpoints: ['add', 'get', 'cat', 'balance', 'price'],
    gateway: ARWEAVE_API,
  })
}
