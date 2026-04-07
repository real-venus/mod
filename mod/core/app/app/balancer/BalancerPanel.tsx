"use client";

import { useEffect, useState, useCallback } from 'react'
import { userContext } from '@/context'
import { getFreshToken } from '@/utils/tokenUtils'

interface ReplicaInfo {
  name: string
  address: string
  live: boolean
  age: number
  ttl_remaining: number
}

interface GroupStatus {
  mod: string
  config: {
    worker_ttl: number
    min_replicas: number
    max_replicas: number
    user_threshold: number
    users_per_worker: number
    session_window: number
    max_users: number
  }
  replicas: ReplicaInfo[]
  replica_count: number
  active_users: string[]
  active_user_count: number
  max_users: number
  deployed_at: number
  strategy: string
}

type StatusMap = Record<string, GroupStatus>

export default function BalancerPanel() {
  const { client, user } = userContext()
  const [status, setStatus] = useState<StatusMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(true)

  // Config form state
  const [configMod, setConfigMod] = useState('')
  const [configTTL, setConfigTTL] = useState(60)
  const [configMinR, setConfigMinR] = useState(1)
  const [configMaxR, setConfigMaxR] = useState(5000)
  const [configThreshold, setConfigThreshold] = useState(2)
  const [configPerWorker, setConfigPerWorker] = useState(2)
  const [configMaxUsers, setConfigMaxUsers] = useState(10000)

  // Scale form
  const [scaleMod, setScaleMod] = useState('')
  const [scaleN, setScaleN] = useState(1)

  const fetchStatus = useCallback(async () => {
    if (!client) return
    try {
      const token = await getFreshToken(user?.key, user?.wallet_mode)
      const result = await client.call('balancer/status', { token })
      if (result && typeof result === 'object') {
        setStatus(result as StatusMap)
      }
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }, [client, user])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (!polling) return
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [polling, fetchStatus])

  const handleScale = async () => {
    if (!client || !scaleMod) return
    try {
      const token = await getFreshToken(user?.key, user?.wallet_mode)
      await client.call('balancer/scale', { mod: scaleMod, n: scaleN, token })
      fetchStatus()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleConfigure = async () => {
    if (!client || !configMod) return
    try {
      const token = await getFreshToken(user?.key, user?.wallet_mode)
      await client.call('balancer/configure', {
        mod: configMod,
        worker_ttl: configTTL,
        min_replicas: configMinR,
        max_replicas: configMaxR,
        user_threshold: configThreshold,
        users_per_worker: configPerWorker,
        max_users: configMaxUsers,
        token,
      })
      fetchStatus()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleTeardown = async (mod: string) => {
    if (!client) return
    try {
      const token = await getFreshToken(user?.key, user?.wallet_mode)
      await client.call('balancer/teardown', { mod, token })
      fetchStatus()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const groups = Object.entries(status)

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    padding: '6px 10px',
    fontFamily: 'var(--font-digital), monospace',
    fontSize: '13px',
    borderRadius: '4px',
    width: '100%',
  }

  const btnStyle: React.CSSProperties = {
    backgroundColor: 'var(--accent-primary)',
    color: '#000',
    border: 'none',
    padding: '8px 16px',
    fontFamily: 'var(--font-digital), monospace',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '16px',
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-digital), monospace',
      minHeight: '100vh',
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
            Balancer
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '4px' }}>
            TTL Workers / Auto-Scale / 10k Users
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: polling ? '#00ff88' : 'var(--text-tertiary)', fontSize: '12px' }}>
            {polling ? 'LIVE' : 'PAUSED'}
          </span>
          <button
            onClick={() => setPolling(!polling)}
            style={{ ...btnStyle, backgroundColor: polling ? '#333' : 'var(--accent-primary)', color: polling ? '#aaa' : '#000', fontSize: '11px', padding: '6px 12px' }}
          >
            {polling ? 'Pause' : 'Resume'}
          </button>
          <button onClick={fetchStatus} style={{ ...btnStyle, fontSize: '11px', padding: '6px 12px' }}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ ...cardStyle, borderColor: '#ff4444', marginBottom: '16px', color: '#ff4444', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: 'var(--text-tertiary)' }}>Loading...</p>}

      {/* Worker Groups */}
      {groups.length === 0 && !loading && (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: '40px' }}>
          No active worker groups. Deploy a module to get started.
        </div>
      )}

      {groups.map(([modName, group]) => (
        <div key={modName} style={{ ...cardStyle, marginBottom: '16px' }}>
          {/* Group Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#00ff88' }}>
                {modName}
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                {group.strategy} / TTL {group.config.worker_ttl}s / {group.replica_count} workers
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {group.active_user_count} / {group.max_users} users
              </span>
              <button
                onClick={() => handleTeardown(modName)}
                style={{ ...btnStyle, backgroundColor: '#ff4444', color: '#fff', fontSize: '11px', padding: '4px 10px' }}
              >
                Teardown
              </button>
            </div>
          </div>

          {/* User/Scale Metrics Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '8px',
            marginBottom: '16px',
          }}>
            {[
              { label: 'Workers', value: group.replica_count, color: '#00ff88' },
              { label: 'Active Users', value: group.active_user_count, color: '#00aaff' },
              { label: 'TTL', value: `${group.config.worker_ttl}s`, color: '#ffaa00' },
              { label: 'Threshold', value: `M=${group.config.user_threshold}`, color: '#ff66aa' },
              { label: 'Per Worker', value: `${group.config.users_per_worker}:1`, color: '#aa66ff' },
              { label: 'Max Replicas', value: group.config.max_replicas, color: '#66ffaa' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '10px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Replica Cards */}
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>
              Workers
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
              {group.replicas.map((r) => (
                <div key={r.name} style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: `1px solid ${r.live ? '#00ff8844' : '#ff444444'}`,
                  borderRadius: '4px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {r.address}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: r.live ? '#00ff88' : '#ff4444',
                    }}>
                      {r.live ? 'LIVE' : 'DOWN'}
                    </div>
                    <div style={{ fontSize: '11px', color: r.ttl_remaining > 15 ? '#ffaa00' : '#ff4444', marginTop: '2px' }}>
                      {r.ttl_remaining.toFixed(0)}s left
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                      age {r.age.toFixed(0)}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Users */}
          {group.active_users.length > 0 && (
            <div>
              <h3 style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>
                Active Sessions ({group.active_user_count})
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {group.active_users.map((u) => (
                  <span key={u} style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: '#00aaff',
                    fontFamily: 'monospace',
                  }}>
                    {u.length > 12 ? `${u.slice(0, 6)}...${u.slice(-4)}` : u}
                  </span>
                ))}
              </div>
            </div>
          )}
          {group.active_user_count > 100 && (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              {group.active_user_count} active users (list hidden at scale)
            </div>
          )}
        </div>
      ))}

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
        {/* Scale Control */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Scale
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              value={scaleMod}
              onChange={(e) => setScaleMod(e.target.value)}
              placeholder="module name"
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                value={scaleN}
                onChange={(e) => setScaleN(parseInt(e.target.value) || 1)}
                min={1}
                style={{ ...inputStyle, width: '80px' }}
              />
              <button onClick={handleScale} style={btnStyle}>Scale</button>
            </div>
          </div>
        </div>

        {/* Config Control */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Configure
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              value={configMod}
              onChange={(e) => setConfigMod(e.target.value)}
              placeholder="module name"
              style={inputStyle}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {[
                { label: 'TTL (s)', value: configTTL, set: setConfigTTL },
                { label: 'Min R', value: configMinR, set: setConfigMinR },
                { label: 'Max R', value: configMaxR, set: setConfigMaxR },
                { label: 'Threshold', value: configThreshold, set: setConfigThreshold },
                { label: 'Per Worker', value: configPerWorker, set: setConfigPerWorker },
                { label: 'Max Users', value: configMaxUsers, set: setConfigMaxUsers },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{label}</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => set(parseInt(e.target.value) || 0)}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            <button onClick={handleConfigure} style={btnStyle}>Apply Config</button>
          </div>
        </div>
      </div>
    </div>
  )
}
