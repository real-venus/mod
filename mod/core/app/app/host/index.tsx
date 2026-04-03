"use client";

import { CheckCircleIcon, StarIcon as CrownIcon, PlusIcon, ServerIcon, TrashIcon, XCircleIcon } from '@heroicons/react/24/outline'

import { useState, useEffect } from 'react'
import { userContext } from '@/context/UserContext'
import Client from '@/client'
import modConfig from '@config'

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || modConfig.url.api || 'http://localhost:8000'

interface HostInfo {
  url: string
  owner: string | null
  status: 'active' | 'inactive' | 'checking'
}

export default function HostsPage() {
  const { client, user } = userContext()
  const [hosts, setHosts] = useState<HostInfo[]>([])
  const [currentHost, setCurrentHost] = useState<string>('')
  const [newHostUrl, setNewHostUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadHosts()
  }, [])

  const loadHosts = async () => {
    const savedHosts = localStorage.getItem('custom_hosts')
    const current = localStorage.getItem('custom_node_url') || DEFAULT_API_URL
    setCurrentHost(current)

    let hostList: HostInfo[] = []
    if (savedHosts) {
      const parsed = JSON.parse(savedHosts)
      hostList = parsed.map((url: string) => ({ url, owner: null, status: 'checking' as const }))
    } else {
      hostList = [{ url: DEFAULT_API_URL, owner: null, status: 'checking' as const }]
    }

    setHosts(hostList)
    
    // Check each host
    for (let i = 0; i < hostList.length; i++) {
      checkHost(hostList[i].url, i)
    }
  }

  const checkHost = async (url: string, index: number) => {
    if (!client) return;
    try {
      const tempClient = new Client(url, client!.token)
      const response = await tempClient.call('mod', {})
      
      setHosts(prev => {
        const updated = [...prev]
        updated[index] = {
          url,
          owner: response?.owner || 'Unknown',
          status: 'active'
        }
        return updated
      })
    } catch (err) {
      setHosts(prev => {
        const updated = [...prev]
        updated[index] = {
          url,
          owner: null,
          status: 'inactive'
        }
        return updated
      })
    }
  }

  const addHost = async () => {
    if (!newHostUrl.trim()) return
    
    setLoading(true)
    const newHost: HostInfo = { url: newHostUrl.trim(), owner: null, status: 'checking' }
    const updatedHosts = [...hosts, newHost]
    setHosts(updatedHosts)
    
    const hostUrls = updatedHosts.map(h => h.url)
    localStorage.setItem('custom_hosts', JSON.stringify(hostUrls))
    
    await checkHost(newHostUrl.trim(), updatedHosts.length - 1)
    setNewHostUrl('')
    setLoading(false)
  }

  const selectHost = (url: string) => {
    localStorage.setItem('custom_node_url', url)
    setCurrentHost(url)
    window.location.reload()
  }

  const removeHost = (url: string) => {
    const updatedHosts = hosts.filter(h => h.url !== url)
    setHosts(updatedHosts)
    const hostUrls = updatedHosts.map(h => h.url)
    localStorage.setItem('custom_hosts', JSON.stringify(hostUrls))
    
    if (currentHost === url) {
      selectHost(DEFAULT_API_URL)
    }
  }

  const isOwner = (host: HostInfo) => {
    return user && host.owner && user.key === host.owner
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>HOST MANAGER</h1>
          <p className="text-gray-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Manage and select API backend hosts</p>
        </div>

        <div className="mb-6 p-6 bg-purple-500/10 border-2 border-purple-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <ServerIcon className="h-6 w-6 text-purple-400" />
            <h2 className="text-lg font-bold text-purple-400" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>CURRENT HOST</h2>
          </div>
          <p className="text-purple-300 font-mono text-sm break-all">{currentHost}</p>
        </div>

        <div className="mb-6 p-6 bg-black/60 border-2 border-green-500/30 rounded-lg">
          <h2 className="text-lg font-bold text-green-400 mb-4" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>ADD NEW HOST</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newHostUrl}
              onChange={(e) => setNewHostUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addHost()}
              placeholder="https://api.example.com"
              className="flex-1 bg-black/40 border-2 border-green-500/40 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/60"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            />
            <button
              onClick={addHost}
              disabled={loading || !newHostUrl.trim()}
              className="px-6 py-3 bg-green-500/20 text-green-400 border-2 border-green-500/40 hover:bg-green-500/30 rounded-lg transition-all font-bold disabled:opacity-50 flex items-center gap-2"
              style={{ fontFamily: 'IBM Plex Mono, monospace' }}
            >
              <PlusIcon className="h-5 w-5" />
              ADD
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>AVAILABLE HOSTS</h2>
          {hosts.map((host, index) => (
            <div
              key={index}
              className={`p-6 rounded-lg border-2 transition-all ${
                currentHost === host.url
                  ? 'bg-purple-500/20 border-purple-500/60'
                  : 'bg-black/40 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {host.status === 'active' ? (
                      <CheckCircleIcon className="h-6 w-6 text-green-400" />
                    ) : host.status === 'inactive' ? (
                      <XCircleIcon className="h-6 w-6 text-red-400" />
                    ) : (
                      <div className="h-6 w-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    <h3 className="text-white font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{host.url}</h3>
                    {isOwner(host) && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded" title="You own this host">
                        <CrownIcon className="h-4 w-4 text-yellow-400" />
                        <span className="text-xs text-yellow-400 font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>OWNER</span>
                      </div>
                    )}
                  </div>
                  {host.owner && (
                    <p className="text-sm text-gray-400 ml-9" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      Owner: <span className="text-green-400">{host.owner}</span>
                    </p>
                  )}
                  {host.status === 'inactive' && (
                    <p className="text-sm text-red-400 ml-9" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>Unable to connect</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentHost !== host.url && (
                    <button
                      onClick={() => selectHost(host.url)}
                      className="px-4 py-2 bg-blue-500/20 text-blue-400 border-2 border-blue-500/40 hover:bg-blue-500/30 rounded-lg transition-all font-bold text-sm"
                      style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                    >
                      SELECT
                    </button>
                  )}
                  {host.url !== DEFAULT_API_URL && (
                    <button
                      onClick={() => removeHost(host.url)}
                      className="px-4 py-2 bg-red-500/20 text-red-400 border-2 border-red-500/40 hover:bg-red-500/30 rounded-lg transition-all font-bold text-sm flex items-center gap-2"
                      style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                    >
                      <TrashIcon className="h-4 w-4" />
                      REMOVE
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}