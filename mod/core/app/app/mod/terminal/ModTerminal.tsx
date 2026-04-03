"use client";

import { useEffect, useRef, useState, useCallback } from 'react'
import { ModuleType } from '@/types'

interface ModTerminalProps {
  mod: ModuleType
  moduleColor?: string
}

export default function ModTerminal({ mod, moduleColor = '#ffffff' }: ModTerminalProps) {
  const termRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const sessionRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fitAddonRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiCall = useCallback(async (body: any) => {
    const res = await fetch('/api/terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  }, [])

  useEffect(() => {
    let destroyed = false

    async function init() {
      if (!termRef.current) return

      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')

      if (destroyed) return

      // Inject xterm CSS if not already present
      if (!document.getElementById('xterm-css')) {
        const link = document.createElement('link')
        link.id = 'xterm-css'
        link.rel = 'stylesheet'
        link.href = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5/css/xterm.min.css'
        document.head.appendChild(link)
        await new Promise((r) => { link.onload = r; setTimeout(r, 500) })
      }

      const fitAddon = new FitAddon()
      fitAddonRef.current = fitAddon

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
        theme: {
          background: '#0a0a0a',
          foreground: '#e0e0e0',
          cursor: moduleColor,
          selectionBackground: '#333333',
          black: '#0a0a0a',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#6272a4',
          magenta: '#ff79c6',
          cyan: '#8be9fd',
          white: '#e0e0e0',
          brightBlack: '#555555',
          brightRed: '#ff6e6e',
          brightGreen: '#69ff94',
          brightYellow: '#ffffa5',
          brightBlue: '#d6acff',
          brightMagenta: '#ff92df',
          brightCyan: '#a4ffff',
          brightWhite: '#ffffff',
        },
        allowProposedApi: true,
      })

      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(termRef.current)
      fitAddon.fit()
      xtermRef.current = term

      const modPath = mod.name?.replace(/\./g, '/')
      const basePath = process.env.NEXT_PUBLIC_MOD_PATH || '/Users/broski/mod/mod'
      const cwd = `${basePath}/orbit/${modPath}`

      try {
        const result = await apiCall({
          action: 'create',
          cwd,
          cols: term.cols,
          rows: term.rows,
        })

        if (result.error) {
          setError(result.error)
          term.writeln(`\r\n\x1b[31mError: ${result.error}\x1b[0m`)
          return
        }

        sessionRef.current = result.sessionId

        term.writeln(`\x1b[90m# ${mod.name} terminal — ${cwd}\x1b[0m`)
        term.writeln(`\x1b[33m# sandboxed: file edits restricted to this module folder\x1b[0m`)
        term.writeln('')

        if (result.output) {
          term.write(result.output)
        }

        setReady(true)

        // With a real PTY, send all input directly — the PTY handles
        // echoing, line editing, tab completion, arrow keys, etc.
        term.onData((data: string) => {
          if (!sessionRef.current) return

          if (data === '\x04') {
            // Ctrl+D — end session
            apiCall({
              action: 'destroy',
              sessionId: sessionRef.current,
            })
            term.writeln('\r\n\x1b[90m[session ended]\x1b[0m')
            sessionRef.current = null
            return
          }

          // Send raw input to the PTY
          apiCall({
            action: 'exec',
            sessionId: sessionRef.current,
            command: data,
          }).then((res: any) => {
            if (res?.blocked) {
              term.writeln(`\r\n\x1b[31m✗ ${res.reason}\x1b[0m`)
            } else if (res?.output) {
              term.write(res.output)
            }
          })
        })

        // Poll for async output (long-running commands, etc.)
        pollRef.current = setInterval(async () => {
          if (!sessionRef.current) return
          try {
            const res = await apiCall({
              action: 'poll',
              sessionId: sessionRef.current,
            })
            if (res.output) {
              term.write(res.output)
            }
          } catch {
            // Ignore poll errors
          }
        }, 300)
      } catch (err: any) {
        setError(err.message)
        term.writeln(`\r\n\x1b[31mFailed to start terminal: ${err.message}\x1b[0m`)
      }
    }

    init()

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        if (sessionRef.current && xtermRef.current) {
          apiCall({
            action: 'resize',
            sessionId: sessionRef.current,
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          })
        }
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      destroyed = true
      window.removeEventListener('resize', handleResize)
      if (pollRef.current) clearInterval(pollRef.current)
      if (sessionRef.current) {
        apiCall({ action: 'destroy', sessionId: sessionRef.current })
      }
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
      }
    }
  }, [mod.name, moduleColor, apiCall])

  return (
    <div className="w-full" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      <div
        className="w-full overflow-hidden"
        style={{
          border: '1px solid var(--border-color)',
          backgroundColor: '#0a0a0a',
          minHeight: '400px',
        }}
      >
        {/* Terminal header bar */}
        <div
          className="flex items-center justify-between px-3 py-1"
          style={{
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: moduleColor }}
            >
              terminal
            </span>
            <span
              className="text-[11px]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {mod.name}
            </span>
          </div>
          {ready && (
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5"
                style={{ color: '#f1fa8c', border: '1px solid #f1fa8c33', borderRadius: '3px' }}
              >
                sandboxed
              </span>
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                connected
              </span>
            </div>
          )}
        </div>

        {/* Terminal body */}
        <div
          ref={termRef}
          className="w-full"
          style={{
            height: 'calc(100vh - 200px)',
            minHeight: '350px',
            padding: '4px',
          }}
        />
      </div>
    </div>
  )
}
