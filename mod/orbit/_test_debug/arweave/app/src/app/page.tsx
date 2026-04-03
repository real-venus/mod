'use client'

import { useState } from 'react'

export default function ArweavePage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'retrieve' | 'wallet'>('upload')
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Upload state
  const [uploadContent, setUploadContent] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [txId, setTxId] = useState('')

  // Retrieve state
  const [retrieveTxId, setRetrieveTxId] = useState('')
  const [retrievedData, setRetrievedData] = useState('')

  // Wallet state
  const [balance, setBalance] = useState<number | null>(null)
  const [walletAddress, setWalletAddress] = useState('')
  const [priceSize, setPriceSize] = useState('')
  const [priceResult, setPriceResult] = useState<number | null>(null)

  const handleUpload = async () => {
    if (!uploadContent.trim()) {
      setStatus('Please enter content to upload')
      return
    }

    setLoading(true)
    setStatus('Uploading to Arweave...')

    try {
      let data: any = uploadContent
      try {
        data = JSON.parse(uploadContent)
      } catch {
        // Not JSON, use as string
      }

      const tags = uploadTags ? JSON.parse(uploadTags) : undefined

      const response = await fetch('/api/arweave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', data, tags }),
      })

      const result = await response.json()

      if (response.ok) {
        setTxId(result.txId)
        setStatus(`Uploaded successfully! TX ID: ${result.txId}`)
      } else {
        setStatus(`Error: ${result.error}`)
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRetrieve = async () => {
    if (!retrieveTxId.trim()) {
      setStatus('Please enter a transaction ID')
      return
    }

    setLoading(true)
    setStatus('Retrieving from Arweave...')

    try {
      const response = await fetch('/api/arweave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', cid: retrieveTxId }),
      })

      const result = await response.json()

      if (response.ok) {
        const dataStr = typeof result.data === 'string'
          ? result.data
          : JSON.stringify(result.data, null, 2)
        setRetrievedData(dataStr)
        setStatus('Data retrieved successfully!')
      } else {
        setStatus(`Error: ${result.error}`)
        setRetrievedData('')
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`)
      setRetrievedData('')
    } finally {
      setLoading(false)
    }
  }

  const handleGetBalance = async () => {
    setLoading(true)
    setStatus('Fetching wallet balance...')

    try {
      const response = await fetch('/api/arweave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'balance' }),
      })

      const result = await response.json()

      if (response.ok) {
        setBalance(result.balance)
        setWalletAddress(result.address || 'No wallet loaded')
        setStatus(`Balance: ${result.balance} AR`)
      } else {
        setStatus(`Error: ${result.error}`)
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGetPrice = async () => {
    if (!priceSize.trim()) {
      setStatus('Please enter a size in bytes')
      return
    }

    setLoading(true)
    setStatus('Fetching storage price...')

    try {
      const response = await fetch('/api/arweave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'price', size: parseInt(priceSize) }),
      })

      const result = await response.json()

      if (response.ok) {
        setPriceResult(result.price)
        setStatus(`Storage cost for ${priceSize} bytes: ${result.price} AR`)
      } else {
        setStatus(`Error: ${result.error}`)
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Arweave Storage</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Permanent decentralized storage on the Arweave network
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('retrieve')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'retrieve'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Retrieve
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'wallet'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Wallet
          </button>
        </div>

        {/* Content */}
        <div className="ar-card">
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4">Upload Data to Arweave</h2>

              <div>
                <label className="ar-label">Content (JSON or Text)</label>
                <textarea
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  placeholder='{"key": "value"} or plain text'
                  className="ar-input min-h-[200px] font-mono text-sm"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="ar-label">Tags (Optional JSON)</label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder='{"tag1": "value1"}'
                  className="ar-input font-mono text-sm"
                  disabled={loading}
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={loading}
                className="ar-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Uploading...' : 'Upload to Arweave'}
              </button>

              {txId && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                    Transaction ID:
                  </p>
                  <code className="text-xs break-all text-green-700 dark:text-green-300">
                    {txId}
                  </code>
                </div>
              )}
            </div>
          )}

          {activeTab === 'retrieve' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4">Retrieve Data from Arweave</h2>

              <div>
                <label className="ar-label">Transaction ID</label>
                <input
                  type="text"
                  value={retrieveTxId}
                  onChange={(e) => setRetrieveTxId(e.target.value)}
                  placeholder="Enter transaction ID or hash"
                  className="ar-input font-mono text-sm"
                  disabled={loading}
                />
              </div>

              <button
                onClick={handleRetrieve}
                disabled={loading}
                className="ar-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Retrieving...' : 'Retrieve Data'}
              </button>

              {retrievedData && (
                <div className="mt-4">
                  <label className="ar-label">Retrieved Data:</label>
                  <pre className="ar-input min-h-[200px] font-mono text-sm overflow-auto">
                    {retrievedData}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mb-4">Wallet & Pricing</h2>

              {/* Balance Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Wallet Balance</h3>
                <button
                  onClick={handleGetBalance}
                  disabled={loading}
                  className="ar-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Fetching...' : 'Get Balance'}
                </button>

                {balance !== null && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Address: {walletAddress}
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {balance} AR
                    </div>
                  </div>
                )}
              </div>

              {/* Price Calculator */}
              <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-semibold">Storage Price Calculator</h3>

                <div>
                  <label className="ar-label">Data Size (bytes)</label>
                  <input
                    type="number"
                    value={priceSize}
                    onChange={(e) => setPriceSize(e.target.value)}
                    placeholder="Enter size in bytes"
                    className="ar-input"
                    disabled={loading}
                  />
                </div>

                <button
                  onClick={handleGetPrice}
                  disabled={loading}
                  className="ar-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Calculating...' : 'Calculate Price'}
                </button>

                {priceResult !== null && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Storage cost for {priceSize} bytes:
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {priceResult} AR
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        {status && (
          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
            <p className="text-sm">{status}</p>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Connected to Arweave Gateway: arweave.net</p>
          <p className="mt-2">
            Data stored on Arweave is permanent and cannot be deleted.
          </p>
        </div>
      </div>
    </main>
  )
}
