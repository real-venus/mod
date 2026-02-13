import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { cid } = await req.json()
    
    if (!cid) {
      return NextResponse.json({ error: 'No CID provided' }, { status: 400 })
    }

    // Fetch deployment metadata
    const metaRes = await fetch(`http://ipfs.node:5001/api/v0/cat?arg=${cid}`, {
      method: 'POST'
    })

    if (!metaRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch deployment metadata' }, { status: 500 })
    }

    const metadata = await metaRes.json()
    const wasmCid = metadata.wasmCid

    // Fetch actual WASM binary
    const wasmRes = await fetch(`http://ipfs.node:5001/api/v0/cat?arg=${wasmCid}`, {
      method: 'POST'
    })

    if (!wasmRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch WASM binary' }, { status: 500 })
    }

    const wasmBytes = await wasmRes.arrayBuffer()

    // Instantiate and run WASM
    const wasmModule = await WebAssembly.instantiate(wasmBytes, {
      env: {
        // Provide any imports the WASM module needs
        log: (arg: number) => console.log('WASM log:', arg)
      }
    })

    // Try to call exported functions
    const exports = wasmModule.instance.exports as any
    let output = 'WASM Module Loaded Successfully\n\n'
    output += 'Exported functions:\n'
    
    for (const [name, fn] of Object.entries(exports)) {
      if (typeof fn === 'function') {
        output += `- ${name}\n`
        
        // Try calling simple functions with no args
        try {
          const result = (fn as Function)()
          output += `  Result: ${result}\n`
        } catch (e) {
          output += `  (requires arguments)\n`
        }
      }
    }
    
    return NextResponse.json({ 
      output,
      metadata,
      exports: Object.keys(exports)
    })
  } catch (error) {
    console.error('WASM execution error:', error)
    return NextResponse.json({ 
      error: 'Execution failed: ' + (error as Error).message 
    }, { status: 500 })
  }
}
