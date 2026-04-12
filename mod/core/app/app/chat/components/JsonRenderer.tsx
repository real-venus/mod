"use client";

import { useState, useCallback } from 'react'
import { CopyButton } from '@/ui/CopyButton'

interface JsonRendererProps {
  content: string
  maxCollapsedLines?: number
}

interface JsonNodeProps {
  data: any
  keyName?: string
  depth?: number
  isLast?: boolean
}

function JsonNode({ data, keyName, depth = 0, isLast = true }: JsonNodeProps) {
  const [collapsed, setCollapsed] = useState(depth > 2)
  const indent = depth * 16

  if (data === null) return (
    <span>
      {keyName !== undefined && <span style={{ color: 'var(--accent-primary)' }}>"{keyName}"</span>}
      {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>: </span>}
      <span style={{ color: 'var(--text-tertiary)' }}>null</span>
      {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
    </span>
  )

  if (typeof data === 'boolean') return (
    <span>
      {keyName !== undefined && <span style={{ color: 'var(--accent-primary)' }}>"{keyName}"</span>}
      {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>: </span>}
      <span style={{ color: 'var(--accent-warning, #ffcc00)' }}>{data.toString()}</span>
      {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
    </span>
  )

  if (typeof data === 'number') return (
    <span>
      {keyName !== undefined && <span style={{ color: 'var(--accent-primary)' }}>"{keyName}"</span>}
      {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>: </span>}
      <span style={{ color: 'var(--accent-warning, #ffcc00)' }}>{data}</span>
      {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
    </span>
  )

  if (typeof data === 'string') {
    const isLong = data.length > 120
    const display = isLong ? data.slice(0, 120) + '...' : data
    return (
      <span>
        {keyName !== undefined && <span style={{ color: 'var(--accent-primary)' }}>"{keyName}"</span>}
        {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>: </span>}
        <span style={{ color: 'var(--accent-success, #00ff88)' }}>"{display}"</span>
        {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
      </span>
    )
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return (
      <span>
        {keyName !== undefined && <span style={{ color: 'var(--accent-primary)' }}>"{keyName}"</span>}
        {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>: </span>}
        <span style={{ color: 'var(--text-secondary)' }}>[]</span>
        {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
      </span>
    )

    return (
      <span>
        {keyName !== undefined && <span style={{ color: 'var(--accent-primary)' }}>"{keyName}"</span>}
        {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>: </span>}
        <span
          onClick={() => setCollapsed(!collapsed)}
          className="cursor-pointer select-none"
          style={{ color: 'var(--text-secondary)' }}
        >
          {collapsed ? (
            <span>[<span className="text-xs px-1 py-0.5 mx-1 border" style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-tertiary)',
            }}>{data.length} items</span>]{!isLast && ','}</span>
          ) : '['}
        </span>
        {!collapsed && (
          <>
            {data.map((item, i) => (
              <div key={i} style={{ paddingLeft: indent + 16 }}>
                <JsonNode data={item} depth={depth + 1} isLast={i === data.length - 1} />
              </div>
            ))}
            <span style={{ paddingLeft: indent }}>
              <span style={{ color: 'var(--text-secondary)' }}>]</span>
              {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
            </span>
          </>
        )}
      </span>
    )
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data)
    if (keys.length === 0) return (
      <span>
        {keyName !== undefined && <span style={{ color: 'var(--accent-primary)' }}>"{keyName}"</span>}
        {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>: </span>}
        <span style={{ color: 'var(--text-secondary)' }}>{'{}'}</span>
        {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
      </span>
    )

    return (
      <span>
        {keyName !== undefined && <span style={{ color: 'var(--accent-primary)' }}>"{keyName}"</span>}
        {keyName !== undefined && <span style={{ color: 'var(--text-tertiary)' }}>: </span>}
        <span
          onClick={() => setCollapsed(!collapsed)}
          className="cursor-pointer select-none"
          style={{ color: 'var(--text-secondary)' }}
        >
          {collapsed ? (
            <span>{'{'}<span className="text-xs px-1 py-0.5 mx-1 border" style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-tertiary)',
            }}>{keys.length} keys</span>{'}'}{!isLast && ','}</span>
          ) : '{'}
        </span>
        {!collapsed && (
          <>
            {keys.map((key, i) => (
              <div key={key} style={{ paddingLeft: indent + 16 }}>
                <JsonNode data={data[key]} keyName={key} depth={depth + 1} isLast={i === keys.length - 1} />
              </div>
            ))}
            <span style={{ paddingLeft: indent }}>
              <span style={{ color: 'var(--text-secondary)' }}>{'}'}</span>
              {!isLast && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
            </span>
          </>
        )}
      </span>
    )
  }

  return <span style={{ color: 'var(--text-primary)' }}>{String(data)}</span>
}

function tryParseJson(content: string): { isJson: boolean; data?: any } {
  const trimmed = content.trim()
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return { isJson: true, data: JSON.parse(trimmed) }
    } catch {
      return { isJson: false }
    }
  }
  return { isJson: false }
}

export function JsonRenderer({ content }: JsonRendererProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree')
  const { isJson, data } = tryParseJson(content)

  if (!isJson) {
    return (
      <pre
        className="text-xl leading-relaxed whitespace-pre-wrap break-words"
        style={{
          fontFamily: 'var(--font-digital), "JetBrains Mono", monospace',
          color: 'var(--text-primary)',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </pre>
    )
  }

  return (
    <div className="space-y-2">
      {/* Toggle bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('tree')}
            className="px-2 py-0.5 text-sm font-digital font-bold border transition-all uppercase"
            style={{
              backgroundColor: viewMode === 'tree' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'tree' ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              borderColor: viewMode === 'tree' ? 'var(--accent-primary)' : 'var(--border-color)',
            }}
          >
            TREE
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className="px-2 py-0.5 text-sm font-digital font-bold border transition-all uppercase"
            style={{
              backgroundColor: viewMode === 'raw' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'raw' ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              borderColor: viewMode === 'raw' ? 'var(--accent-primary)' : 'var(--border-color)',
            }}
          >
            RAW
          </button>
        </div>
        <CopyButton text={content} size="sm" />
      </div>

      {/* Content */}
      {viewMode === 'tree' ? (
        <div
          className="text-lg leading-relaxed overflow-x-auto"
          style={{ fontFamily: 'var(--font-digital), "JetBrains Mono", monospace' }}
        >
          <JsonNode data={data} />
        </div>
      ) : (
        <pre
          className="text-lg leading-relaxed whitespace-pre-wrap break-words overflow-x-auto"
          style={{
            fontFamily: 'var(--font-digital), "JetBrains Mono", monospace',
            color: 'var(--text-primary)',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
