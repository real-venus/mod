'use client'

import { useState, useEffect, useCallback } from 'react'
import { API_URL } from './config'

type DocMeta = {
  name: string
  folder?: string | null
  tags?: string[]
  updated_at?: number
  created_at?: number
  size?: number
  snippet?: string
}

const TEMPLATE = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath, amssymb, amsthm}
\\usepackage{geometry}
\\geometry{margin=1in}

\\title{Untitled Document}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}

Your content here.

\\end{document}
`

export default function Home() {
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [name, setName] = useState('')
  const [folder, setFolder] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState(TEMPLATE)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [activeDoc, setActiveDoc] = useState<string | null>(null)
  const [view, setView] = useState<'editor' | 'list'>('list')
  const [compileLog, setCompileLog] = useState<string>('')
  const [online, setOnline] = useState(false)

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/docs`)
      const data = await res.json()
      setDocs(data.docs || [])
      setOnline(true)
    } catch {
      setOnline(false)
      setStatus('API offline')
    }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const save = async () => {
    if (!name.trim()) { setStatus('Name required'); return }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          content,
          folder: folder.trim() || null,
          tags: tags.trim() ? tags.split(',').map(t => t.trim()) : null,
        }),
      })
      const data = await res.json()
      if (data.status === 'saved') {
        setStatus(`Saved: ${name}`)
        setActiveDoc(name)
        fetchDocs()
      } else {
        setStatus(`Error: ${data.detail || 'save failed'}`)
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    }
    setLoading(false)
  }

  const loadDoc = async (docName: string, docFolder?: string | null) => {
    setLoading(true)
    try {
      const params = docFolder ? `?folder=${encodeURIComponent(docFolder)}` : ''
      const res = await fetch(`${API_URL}/docs/${encodeURIComponent(docName)}${params}`)
      const data = await res.json()
      if (data.content !== undefined) {
        setName(docName)
        setContent(data.content)
        setFolder(data.meta?.folder || '')
        setTags((data.meta?.tags || []).join(', '))
        setActiveDoc(docName)
        setView('editor')
        setStatus(`Loaded: ${docName}`)
      } else {
        setStatus(`Error: ${data.detail || 'load failed'}`)
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    }
    setLoading(false)
  }

  const deleteDoc = async (docName: string, docFolder?: string | null) => {
    if (!confirm(`Delete "${docName}"?`)) return
    try {
      const params = docFolder ? `?folder=${encodeURIComponent(docFolder)}` : ''
      await fetch(`${API_URL}/docs/${encodeURIComponent(docName)}${params}`, { method: 'DELETE' })
      setStatus(`Deleted: ${docName}`)
      if (activeDoc === docName) {
        newDoc()
      }
      fetchDocs()
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    }
  }

  const compile = async () => {
    if (!activeDoc) { setStatus('Save first'); return }
    setLoading(true)
    setCompileLog('')
    try {
      const params = folder.trim() ? `?folder=${encodeURIComponent(folder)}` : ''
      const res = await fetch(`${API_URL}/docs/${encodeURIComponent(activeDoc)}/compile${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: 'pdflatex' }),
      })
      const data = await res.json()
      if (data.status === 'compiled') {
        setStatus(`Compiled: ${activeDoc}`)
        setCompileLog('PDF ready')
      } else {
        setStatus('Compilation failed')
        setCompileLog(data.stderr || data.stdout || data.detail || 'Unknown error')
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    }
    setLoading(false)
  }

  const downloadPdf = () => {
    if (!activeDoc) return
    const params = folder.trim() ? `?folder=${encodeURIComponent(folder)}` : ''
    window.open(`${API_URL}/docs/${encodeURIComponent(activeDoc)}/pdf${params}`, '_blank')
  }

  const searchDocs = async () => {
    if (!search.trim()) { fetchDocs(); return }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(search.trim())}`)
      const data = await res.json()
      setDocs(data.results || [])
      setStatus(`Found ${data.count} result(s)`)
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    }
    setLoading(false)
  }

  const newDoc = () => {
    setName('')
    setFolder('')
    setTags('')
    setContent(TEMPLATE)
    setActiveDoc(null)
    setCompileLog('')
    setView('editor')
  }

  const fmtDate = (ts?: number) => {
    if (!ts) return ''
    return new Date(ts * 1000).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-[var(--accent)]">latex</span>hub
          </h1>
          <span className={`text-xs px-2 py-0.5 rounded ${online ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
            {online ? 'online' : 'offline'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); fetchDocs() }}
            className={`text-sm px-3 py-1.5 rounded ${view === 'list' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--surface)] text-[var(--fg)]'}`}>
            docs
          </button>
          <button onClick={newDoc}
            className="text-sm px-3 py-1.5 rounded bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--border)]">
            + new
          </button>
        </div>
      </header>

      {status && (
        <div className="px-6 py-2 text-xs text-[var(--muted)] bg-[var(--surface)] border-b border-[var(--border)]">
          {status}
        </div>
      )}

      {/* list view */}
      {view === 'list' && (
        <div className="flex-1 p-6">
          <div className="flex gap-2 mb-6">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchDocs()}
              placeholder="search docs..."
              className="flex-1 px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button onClick={searchDocs}
              className="px-4 py-2 rounded bg-[var(--surface)] text-sm hover:bg-[var(--border)]">
              search
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="text-center text-[var(--muted)] py-20">
              <p className="text-lg mb-2">No documents yet</p>
              <p className="text-sm">Click "+ new" to create your first LaTeX document</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {docs.map(doc => (
                <div key={`${doc.folder || ''}-${doc.name}`}
                  className="flex items-center justify-between p-4 rounded bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer group"
                  onClick={() => loadDoc(doc.name, doc.folder)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{doc.name}</span>
                      {doc.folder && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--border)] text-[var(--muted)]">
                          {doc.folder}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted)]">
                      <span>{fmtDate(doc.updated_at)}</span>
                      {doc.size && <span>{doc.size} chars</span>}
                      {doc.tags && doc.tags.length > 0 && (
                        <span>{doc.tags.join(', ')}</span>
                      )}
                    </div>
                    {doc.snippet && (
                      <p className="mt-1 text-xs text-[var(--muted)] truncate">{doc.snippet}</p>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteDoc(doc.name, doc.folder) }}
                    className="text-xs text-[var(--muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 ml-4">
                    delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* editor view */}
      {view === 'editor' && (
        <div className="flex-1 flex flex-col p-6 gap-4">
          {/* toolbar */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-[var(--muted)] mb-1 block">name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="document-name"
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="w-40">
              <label className="text-xs text-[var(--muted)] mb-1 block">folder</label>
              <input value={folder} onChange={e => setFolder(e.target.value)}
                placeholder="optional"
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="w-48">
              <label className="text-xs text-[var(--muted)] mb-1 block">tags (comma sep)</label>
              <input value={tags} onChange={e => setTags(e.target.value)}
                placeholder="math, notes"
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={loading}
                className="px-4 py-2 rounded bg-[var(--accent)] text-black text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {loading ? '...' : 'save'}
              </button>
              <button onClick={compile} disabled={loading || !activeDoc}
                className="px-4 py-2 rounded bg-[var(--surface)] text-sm border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50">
                compile
              </button>
              {activeDoc && (
                <button onClick={downloadPdf}
                  className="px-4 py-2 rounded bg-[var(--surface)] text-sm border border-[var(--border)] hover:border-[var(--accent)]">
                  pdf
                </button>
              )}
            </div>
          </div>

          {/* editor */}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Tab') {
                e.preventDefault()
                const start = e.currentTarget.selectionStart
                const end = e.currentTarget.selectionEnd
                setContent(content.substring(0, start) + '  ' + content.substring(end))
                setTimeout(() => {
                  e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2
                }, 0)
              }
              if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                save()
              }
            }}
            className="tex-editor flex-1 w-full rounded p-4 min-h-[400px]"
            spellCheck={false}
          />

          {/* compile log */}
          {compileLog && (
            <div className="text-xs p-3 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] max-h-32 overflow-auto whitespace-pre-wrap">
              {compileLog}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
