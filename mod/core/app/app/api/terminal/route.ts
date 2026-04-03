import { NextRequest, NextResponse } from 'next/server'
import { resolve } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const MOD_PATH = process.env.MOD_PATH || '/Users/broski/mod/mod'
const ORBIT_PATH = resolve(MOD_PATH, 'orbit')
const CORE_PATH = resolve(MOD_PATH, 'core')

// node-pty is a native module — require at runtime
let pty: any = null
function getPty() {
  if (!pty) {
    pty = require('node-pty')
  }
  return pty
}

interface Session {
  proc: any // IPty
  buffer: string
  cwd: string
  modRoot: string
  lastAccess: number
  lineBuffer: string // accumulate typed chars for sandbox validation
}

const sessions: Map<string, Session> = new Map()

// Clean up stale sessions every 5 minutes
const TIMEOUT = 5 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.lastAccess > TIMEOUT) {
      session.proc.kill()
      sessions.delete(id)
    }
  }
}, 60_000)

// ── Sandbox helpers ──────────────────────────────────────────────────

function isAllowedPath(dir: string): boolean {
  const resolved = resolve(dir)
  return resolved.startsWith(ORBIT_PATH + '/') || resolved === ORBIT_PATH
    || resolved.startsWith(CORE_PATH + '/') || resolved === CORE_PATH
    || resolved.startsWith(MOD_PATH + '/') || resolved === MOD_PATH
}

function getModRoot(dir: string): string {
  const resolved = resolve(dir)
  if (resolved.startsWith(ORBIT_PATH + '/')) {
    const rel = resolved.slice(ORBIT_PATH.length + 1)
    const topLevel = rel.split('/')[0]
    return resolve(ORBIT_PATH, topLevel)
  }
  return resolved
}

function validateCommand(command: string, modRoot: string): { ok: boolean; reason?: string } {
  const trimmed = command.trim()
  if (!trimmed) return { ok: true }

  const blocked = [
    /\brm\s+(-[a-zA-Z]*)?.*\.\.\//,
    /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f.*\//,
    /\bsudo\b/,
    /\bchmod\b.*\.\.\//,
    /\bchown\b.*\.\.\//,
    /\bmkfs\b/,
    /\bdd\s+/,
    /\b(>\s*|>>)\s*\/(?!dev\/null)/,
  ]
  for (const pat of blocked) {
    if (pat.test(trimmed)) {
      return { ok: false, reason: 'blocked: potentially dangerous command' }
    }
  }

  const writeCommands = /^(nano|vim?|nvim|emacs|code|sed\s+-i|mv|cp|rm|rmdir|tee|chmod|chown|install|ln|mkdir|touch)\b/
  const hasRedirect = /(?:>{1,2}|<)\s*\S/

  const isWrite = writeCommands.test(trimmed)
  const isRedirect = hasRedirect.test(trimmed)

  if (!isWrite && !isRedirect) {
    return { ok: true }
  }

  const segments = trimmed.split(/\s*\|\s*/)
  for (const seg of segments) {
    const redirectMatch = seg.match(/>{1,2}\s*(\S+)/)
    if (redirectMatch) {
      const target = redirectMatch[1]
      if (target.startsWith('/') && !resolve(target).startsWith(modRoot + '/') && resolve(target) !== modRoot) {
        return { ok: false, reason: `sandboxed: cannot write to ${target} (outside module folder)` }
      }
      if (target.includes('..')) {
        const resolved = resolve(modRoot, target)
        if (!resolved.startsWith(modRoot + '/')) {
          return { ok: false, reason: `sandboxed: cannot write outside module folder via ${target}` }
        }
      }
    }

    if (writeCommands.test(seg.trim())) {
      const args = seg.trim().split(/\s+/).slice(1).filter(a => !a.startsWith('-'))
      for (const arg of args) {
        if (arg.startsWith('/')) {
          const resolved = resolve(arg)
          if (!resolved.startsWith(modRoot + '/') && resolved !== modRoot) {
            return { ok: false, reason: `sandboxed: cannot write to ${arg} (outside module folder)` }
          }
        }
        if (arg.includes('..')) {
          const resolved = resolve(modRoot, arg)
          if (!resolved.startsWith(modRoot + '/') && resolved !== modRoot) {
            return { ok: false, reason: `sandboxed: path ${arg} escapes module folder` }
          }
        }
      }
    }
  }

  return { ok: true }
}

// ── Session management ───────────────────────────────────────────────

function getOrCreateSession(id: string, cwd: string, cols?: number, rows?: number): Session | { error: string } {
  let session = sessions.get(id)
  if (session && !session.proc.killed) {
    session.lastAccess = Date.now()
    return session
  }

  let resolvedCwd = resolve(cwd)
  if (!existsSync(resolvedCwd)) {
    const modName = resolvedCwd.split('/').pop() || ''
    const candidates = [
      resolve(ORBIT_PATH, modName),
      resolve(CORE_PATH, 'app', modName),
      resolve(CORE_PATH, modName),
      resolve(MOD_PATH, modName),
    ]
    const found = candidates.find(c => existsSync(c))
    if (found) {
      resolvedCwd = found
    } else {
      return { error: `module directory not found: ${modName}` }
    }
  }

  if (!isAllowedPath(resolvedCwd)) {
    return { error: `cwd must be inside mod directory` }
  }

  const modRoot = getModRoot(resolvedCwd)
  const nodePty = getPty()

  const c = cols || 80
  const r = rows || 24

  const proc = nodePty.spawn('/bin/bash', ['--norc', '--noprofile'], {
    name: 'xterm-256color',
    cols: c,
    rows: r,
    cwd: resolvedCwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      PS1: '\\w $ ',
      BASH_SILENCE_DEPRECATION_WARNING: '1',
      MOD_SANDBOX: modRoot,
    },
  })

  const newSession: Session = {
    proc,
    buffer: '',
    cwd: resolvedCwd,
    modRoot,
    lastAccess: Date.now(),
    lineBuffer: '',
  }

  proc.onData((data: string) => {
    newSession.buffer += data
  })

  proc.onExit(() => {
    sessions.delete(id)
  })

  sessions.set(id, newSession)

  return newSession
}

export async function POST(request: NextRequest) {
  try {
    const { action, sessionId, cwd, command, cols, rows } = await request.json()

    if (action === 'create') {
      if (!cwd) {
        return NextResponse.json({ error: 'cwd is required' }, { status: 400 })
      }
      const id = sessionId || crypto.randomUUID()
      const result = getOrCreateSession(id, cwd, cols, rows)
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 403 })
      }
      // Give shell a moment to initialize and discard startup noise
      await new Promise((r) => setTimeout(r, 300))
      result.buffer = ''
      return NextResponse.json({ sessionId: id, output: '' })
    }

    if (action === 'exec') {
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
      }
      const session = sessions.get(sessionId)
      if (!session) {
        return NextResponse.json({ error: 'session not found' }, { status: 404 })
      }
      session.lastAccess = Date.now()

      // Raw input from xterm — could be a single char, paste, or control sequence
      const data = command || ''

      // Track line buffer for sandbox validation
      if (data === '\r') {
        // Enter pressed — validate the accumulated command
        const check = validateCommand(session.lineBuffer, session.modRoot)
        session.lineBuffer = ''
        if (!check.ok) {
          return NextResponse.json({ blocked: true, reason: check.reason })
        }
        // Send Enter to PTY
        session.proc.write('\r')
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        session.lineBuffer = session.lineBuffer.slice(0, -1)
        session.proc.write(data)
      } else if (data === '\x03') {
        // Ctrl+C — clear line buffer
        session.lineBuffer = ''
        session.proc.write(data)
      } else if (data === '\x15') {
        // Ctrl+U — clear line
        session.lineBuffer = ''
        session.proc.write(data)
      } else if (data.length > 1 && data.includes('\r')) {
        // Pasted text with newlines — validate each line
        const lines = data.split('\r')
        for (let i = 0; i < lines.length; i++) {
          session.lineBuffer += lines[i]
          if (i < lines.length - 1) {
            const check = validateCommand(session.lineBuffer, session.modRoot)
            if (!check.ok) {
              return NextResponse.json({ blocked: true, reason: check.reason })
            }
            session.lineBuffer = ''
          }
        }
        session.proc.write(data)
      } else {
        // Regular chars or control sequences (arrows, etc.)
        if (data >= ' ' && data.length === 1) {
          session.lineBuffer += data
        }
        session.proc.write(data)
      }

      // Wait for output
      await new Promise((r) => setTimeout(r, 50))
      const output = session.buffer
      session.buffer = ''
      return NextResponse.json({ output })
    }

    if (action === 'poll') {
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
      }
      const session = sessions.get(sessionId)
      if (!session) {
        return NextResponse.json({ error: 'session not found' }, { status: 404 })
      }
      session.lastAccess = Date.now()
      const output = session.buffer
      session.buffer = ''
      return NextResponse.json({ output })
    }

    if (action === 'resize') {
      const session = sessions.get(sessionId)
      if (session && cols && rows) {
        session.proc.resize(cols, rows)
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'destroy') {
      const session = sessions.get(sessionId)
      if (session) {
        session.proc.kill()
        sessions.delete(sessionId)
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Terminal API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
