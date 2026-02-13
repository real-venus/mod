import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to IPFS node
    const ipfsFormData = new FormData()
    ipfsFormData.append('file', new Blob([buffer]), file.name)

    const ipfsRes = await fetch('http://ipfs.node:5001/api/v0/add', {
      method: 'POST',
      body: ipfsFormData
    })

    const ipfsData = await ipfsRes.json()
    
    return NextResponse.json({ 
      cid: ipfsData.Hash,
      name: file.name,
      size: file.size
    })
  } catch (error) {
    console.error('IPFS upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
