import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { cid } = await req.json()
    
    if (!cid) {
      return NextResponse.json({ error: 'No CID provided' }, { status: 400 })
    }

    // Fetch WASM from IPFS
    const wasmRes = await fetch(`http://ipfs.node:5001/api/v0/cat?arg=${cid}`, {
      method: 'POST'
    })

    if (!wasmRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch WASM from IPFS' }, { status: 500 })
    }

    const wasmBytes = await wasmRes.arrayBuffer()

    // Create deployment metadata
    const deploymentMeta = {
      wasmCid: cid,
      deployedAt: new Date().toISOString(),
      size: wasmBytes.byteLength,
      status: 'deployed'
    }

    // Store deployment metadata in IPFS
    const metaFormData = new FormData()
    metaFormData.append('file', new Blob([JSON.stringify(deploymentMeta)]), 'deployment.json')

    const metaRes = await fetch('http://ipfs.node:5001/api/v0/add', {
      method: 'POST',
      body: metaFormData
    })

    const metaData = await metaRes.json()
    
    return NextResponse.json({ 
      deployedCid: metaData.Hash,
      wasmCid: cid,
      metadata: deploymentMeta
    })
  } catch (error) {
    console.error('WASM deploy error:', error)
    return NextResponse.json({ error: 'Deployment failed' }, { status: 500 })
  }
}
