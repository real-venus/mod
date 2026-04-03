"use client";

import { useState } from 'react'
import { ModuleType } from '@/types'
import { CopyButton } from '@/ui/CopyButton'

interface ModConfigProps {
  mod: ModuleType
}

function JsonNode({ data, keyName, depth = 0, isLast = true, allCollapsed, allExpanded }: {
  data: any
  keyName?: string
  depth?: number
  isLast?: boolean
  allCollapsed?: boolean
  allExpanded?: boolean
}) {
  const [collapsed, setCollapsed] = useState(depth > 1)

  // React to global collapse/expand
  const isCollapsed = allCollapsed ? true : allExpanded ? false : collapsed
  const indent = depth * 16

  if (data === null || data === undefined) return (
    <div style={{ paddingLeft: indent }}>
      {keyName !== undefined && <span style={{ color: 'var(--accent-primary, #a78bfa)' }}>"{keyName}"</span>}
      {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>:</span>}
      <span style={{ color: 'var(--text-tertiary)' }}>null</span>
      {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
    </div>
  )

  if (typeof data === 'boolean') return (
    <div style={{ paddingLeft: indent }}>
      {keyName !== undefined && <span style={{ color: 'var(--accent-primary, #a78bfa)' }}>"{keyName}"</span>}
      {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>:</span>}
      <span style={{ color: '#ffcc00' }}>{data.toString()}</span>
      {' '}<span className="text-[10px] px-1 py-0.5 font-mono" style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>bool</span>
      {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
    </div>
  )

  if (typeof data === 'number') return (
    <div style={{ paddingLeft: indent }}>
      {keyName !== undefined && <span style={{ color: 'var(--accent-primary, #a78bfa)' }}>"{keyName}"</span>}
      {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>:</span>}
      <span style={{ color: '#ffcc00' }}>{data}</span>
      {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
    </div>
  )

  if (typeof data === 'string') {
    const isLong = data.length > 100
    const display = isLong ? data.slice(0, 100) + '...' : data
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span style={{ color: 'var(--accent-primary, #a78bfa)' }}>"{keyName}"</span>}
        {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>:</span>}
        <span style={{ color: 'var(--accent-success, #22c55e)' }}>"{display}"</span>
        {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
      </div>
    )
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span style={{ color: 'var(--accent-primary, #a78bfa)' }}>"{keyName}"</span>}
        {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>:</span>}
        <span style={{ color: 'var(--text-secondary)' }}>[]</span>
        {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
      </div>
    )

    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span style={{ color: 'var(--accent-primary, #a78bfa)' }}>"{keyName}"</span>}
        {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>:</span>}
        <span
          onClick={() => setCollapsed(!collapsed)}
          className="cursor-pointer select-none"
          style={{ color: 'var(--text-secondary)' }}
        >
          {isCollapsed ? (
            <span>{'['}<span className="text-[10px] px-1 py-0.5 mx-1" style={{ border: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>{data.length} items</span>{']'}{!isLast && ','}</span>
          ) : '['}
        </span>
        {!isCollapsed && (
          <>
            {data.map((item, i) => (
              <JsonNode key={i} data={item} depth={depth + 1} isLast={i === data.length - 1} allCollapsed={allCollapsed} allExpanded={allExpanded} />
            ))}
            <div style={{ paddingLeft: indent }}>
              <span style={{ color: 'var(--text-secondary)' }}>]</span>
              {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
            </div>
          </>
        )}
      </div>
    )
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data)
    if (keys.length === 0) return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span style={{ color: 'var(--accent-primary, #a78bfa)' }}>"{keyName}"</span>}
        {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>:</span>}
        <span style={{ color: 'var(--text-secondary)' }}>{'{}'}</span>
        {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
      </div>
    )

    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span style={{ color: 'var(--accent-primary, #a78bfa)' }}>"{keyName}"</span>}
        {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>:</span>}
        <span
          onClick={() => setCollapsed(!collapsed)}
          className="cursor-pointer select-none"
          style={{ color: 'var(--text-secondary)' }}
        >
          {isCollapsed ? (
            <span>{'{'}<span className="text-[10px] px-1 py-0.5 mx-1" style={{ border: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>{keys.length} keys</span>{'}'}{!isLast && ','}</span>
          ) : '{'}
        </span>
        {!isCollapsed && (
          <>
            {keys.map((key, i) => (
              <JsonNode key={key} data={data[key]} keyName={key} depth={depth + 1} isLast={i === keys.length - 1} allCollapsed={allCollapsed} allExpanded={allExpanded} />
            ))}
            <div style={{ paddingLeft: indent }}>
              <span style={{ color: 'var(--text-secondary)' }}>{'}'}</span>
              {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ paddingLeft: indent }}>
      <span style={{ color: 'var(--text-primary)' }}>{String(data)}</span>
    </div>
  )
}

export default function ModConfig({ mod }: ModConfigProps) {
  const [globalState, setGlobalState] = useState<'default' | 'collapsed' | 'expanded'>('default')

  // Build module config object from the mod data (excluding large content/schema)
  const moduleConfig: Record<string, any> = {}

  // Core identity
  if (mod.name) moduleConfig.name = mod.name
  if (mod.key) moduleConfig.key = mod.key
  if (mod.id !== undefined) moduleConfig.id = mod.id
  if (mod.desc) moduleConfig.desc = mod.desc

  // Network & deployment
  if (mod.url) moduleConfig.url = mod.url
  if (mod.url_app) moduleConfig.url_app = mod.url_app
  if (mod.network) moduleConfig.network = mod.network
  if (mod.chain_id) moduleConfig.chain_id = mod.chain_id

  // Content & versioning
  if (mod.cid) moduleConfig.cid = mod.cid
  if (mod.created) moduleConfig.created = mod.created
  if (mod.updated) moduleConfig.updated = mod.updated

  // Access control
  if (mod.public !== undefined) moduleConfig.public = mod.public
  if (mod.allowed_users && mod.allowed_users.length > 0) moduleConfig.allowed_users = mod.allowed_users
  if (mod.take !== undefined) moduleConfig.take = mod.take
  if (mod.collateral !== undefined) moduleConfig.collateral = mod.collateral

  // Schema summary (function names only, not full schema)
  if (mod.schema && typeof mod.schema === 'object') {
    const fns = Object.keys(mod.schema)
    if (fns.length > 0) {
      moduleConfig.endpoints = {}
      for (const fn of fns) {
        const fnSchema = (mod.schema as Record<string, any>)[fn]
        const entry: Record<string, any> = {}
        if (fnSchema?.auth !== undefined) entry.auth = fnSchema.auth
        if (fnSchema?.docs) entry.docs = fnSchema.docs
        if (fnSchema?.input) {
          if (Array.isArray(fnSchema.input)) {
            entry.input = fnSchema.input.map((p: any) => ({
              name: p.name,
              type: p.type,
            }))
          } else {
            entry.input = Object.entries(fnSchema.input)
              .filter(([k]) => k !== 'self' && k !== 'cls' && k !== 'kwargs')
              .map(([name, v]: [string, any]) => ({
                name,
                type: v?.type || 'any',
              }))
          }
        }
        if (fnSchema?.output) entry.output = fnSchema.output
        moduleConfig.endpoints[fn] = entry
      }
    }
  }

  const configJson = JSON.stringify(moduleConfig, null, 2)

  return (
    <div className="font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      <div style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            CONFIG
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setGlobalState('collapsed')}
              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                color: globalState === 'collapsed' ? 'var(--bg-primary)' : 'var(--text-tertiary)',
                backgroundColor: globalState === 'collapsed' ? 'var(--text-primary)' : 'transparent',
                border: '1px solid var(--border-color)',
              }}
            >
              COLLAPSE
            </button>
            <button
              onClick={() => setGlobalState('expanded')}
              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                color: globalState === 'expanded' ? 'var(--bg-primary)' : 'var(--text-tertiary)',
                backgroundColor: globalState === 'expanded' ? 'var(--text-primary)' : 'transparent',
                border: '1px solid var(--border-color)',
              }}
            >
              EXPAND
            </button>
            <CopyButton text={configJson} />
          </div>
        </div>

        {/* JSON tree */}
        <div
          className="p-4 overflow-auto text-[13px] leading-relaxed"
          style={{
            maxHeight: 'calc(100vh - 250px)',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          <JsonNode
            data={moduleConfig}
            allCollapsed={globalState === 'collapsed'}
            allExpanded={globalState === 'expanded'}
          />
        </div>
      </div>
    </div>
  )
}
