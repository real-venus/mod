"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { userContext } from '@/context'
import { ModuleType } from '@/types'
import { CopyButton } from '@/ui/CopyButton'
import {
  Search, Clock, ChevronDown, ChevronUp, ChevronRight, RefreshCw, X, Play, Copy, Zap,
  FileCode, Folder, FolderOpen, File, Hash, ClipboardCopy,
} from 'lucide-react'

interface ModCodeProps {
  mod: ModuleType
  moduleColor?: string
}

interface Task {
  fn: string
  params: any
  status: string
  time: string
  key: string
  signature?: string
  result?: any
  cid?: string
  hash?: string
  delta?: number
  cost?: number
  module?: string
  owner?: string
}

type FileNode = {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  language?: string
  cid?: string
}

const LANG_MAP: Record<string, string> = {
  py: 'python', js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  rs: 'rust', go: 'go', json: 'json', css: 'css', html: 'html', md: 'markdown',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', sh: 'bash', sol: 'solidity',
}

function getLang(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return LANG_MAP[ext] || 'text'
}

function buildFileTree(files: Record<string, string>): FileNode[] {
  const root: FileNode = { name: '', path: '', type: 'folder', children: [] }
  Object.entries(files).forEach(([path, cid]) => {
    const parts = path.split('/').filter(Boolean)
    let current = root
    parts.forEach((part, idx) => {
      const isFile = idx === parts.length - 1
      const currentPath = parts.slice(0, idx + 1).join('/')
      let child = current.children!.find(c => c.name === part)
      if (!child) {
        child = {
          name: part, path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          language: isFile ? getLang(part) : undefined,
          cid: isFile ? cid : undefined,
        }
        current.children!.push(child)
      }
      if (!isFile) current = child
    })
  })
  const sortNodes = (nodes?: FileNode[]) => {
    if (!nodes) return
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
    nodes.forEach(n => sortNodes(n.children))
  }
  sortNodes(root.children)
  return root.children || []
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`
}

export default function ModCode({ mod, moduleColor = '#ffffff' }: ModCodeProps) {
  const { client } = userContext()
  const files = typeof mod.content === 'object' && mod.content !== null ? mod.content : {}

  // File tree state
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [fileSearch, setFileSearch] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)

  // Tasks sidebar state
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [expandedTask, setExpandedTask] = useState<number | null>(null)
  const [tasksSidebarOpen, setTasksSidebarOpen] = useState(true)

  const codeRef = useRef<HTMLDivElement>(null)

  // Build file tree
  useEffect(() => {
    const tree = buildFileTree(files)
    setFileTree(tree)
    // Auto-select first file
    if (!selectedFile && tree.length > 0) {
      const firstFile = findFirstFile(tree)
      if (firstFile) handleFileSelect(firstFile)
    }
  }, [files])

  function findFirstFile(nodes: FileNode[]): FileNode | null {
    for (const n of nodes) {
      if (n.type === 'file') return n
      if (n.children) {
        const found = findFirstFile(n.children)
        if (found) return found
      }
    }
    return null
  }

  const handleFileSelect = async (node: FileNode) => {
    if (node.type !== 'file') return
    setSelectedFile(node.path)
    if (node.cid && client && !fileContents[node.path]) {
      setLoadingFile(true)
      try {
        const res = await client.call('get', { cid: node.cid })
        setFileContents(prev => ({ ...prev, [node.path]: typeof res === 'string' ? res : JSON.stringify(res, null, 2) }))
      } catch (err) {
        console.error('Failed to fetch content for', node.path, err)
      } finally {
        setLoadingFile(false)
      }
    }
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const n = new Set(prev)
      n.has(path) ? n.delete(path) : n.add(path)
      return n
    })
  }

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!client) return
    setTasksLoading(true)
    try {
      const result = await client.call('txs', { df: 0, n: 50, page: 0 })
      const txs = Array.isArray(result) ? result : []
      const modTasks = txs.filter((tx: Task) => {
        if (!tx.fn) return false
        return tx.fn.split('/')[0].toLowerCase() === mod.name.toLowerCase()
      })
      setTasks(modTasks)
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setTasksLoading(false)
    }
  }, [client, mod.name])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // Filter file tree by search
  const filteredTree = useMemo(() => {
    if (!fileSearch) return fileTree
    const matches = (n: FileNode): boolean => {
      if (n.name.toLowerCase().includes(fileSearch.toLowerCase()) ||
          n.path.toLowerCase().includes(fileSearch.toLowerCase())) return true
      if (n.type === 'folder' && n.children) return n.children.some(matches)
      return false
    }
    return fileTree.filter(matches)
  }, [fileTree, fileSearch])

  // Auto-expand folders matching search
  useEffect(() => {
    if (!fileSearch) return
    const folders = new Set<string>()
    const check = (n: FileNode) => {
      if (n.name.toLowerCase().includes(fileSearch.toLowerCase())) {
        const parts = n.path.split('/').filter(Boolean)
        for (let i = 0; i < parts.length - 1; i++) folders.add(parts.slice(0, i + 1).join('/'))
      }
      n.children?.forEach(check)
    }
    fileTree.forEach(check)
    setExpandedFolders(prev => { const s = new Set(prev); folders.forEach(f => s.add(f)); return s })
  }, [fileSearch, fileTree])

  const selectedContent = selectedFile ? fileContents[selectedFile] || '' : ''
  const selectedLang = selectedFile ? getLang(selectedFile) : 'text'
  const selectedFileName = selectedFile?.split('/').pop() || ''
  const lineCount = selectedContent ? selectedContent.split('\n').length : 0

  const getStatusColor = (status: string) => {
    if (status === 'success' || status === 'finished' || status === 'complete') return '#22c55e'
    if (status === 'error' || status === 'failed') return '#ef4444'
    if (status === 'cancelled') return '#f97316'
    if (status === 'pending' || status === 'running') return '#eab308'
    return 'var(--text-tertiary)'
  }

  const getStatusLabel = (status: string) => {
    if (status === 'success' || status === 'finished' || status === 'complete') return '\u2713'
    if (status === 'error' || status === 'failed') return '\u2717'
    if (status === 'cancelled') return '\u2298'
    if (status === 'pending' || status === 'running') return '\u25C9'
    return '?'
  }

  const formatTime = (time: string) => {
    const ts = parseInt(time)
    if (!ts) return time
    const d = new Date(ts * 1000)
    return d.toLocaleString()
  }

  const fileCount = Object.keys(files).length

  return (
    <div className="font-mono flex" style={{ fontFamily: 'JetBrains Mono, monospace', height: 'calc(100vh - 320px)', minHeight: '500px' }}>
      {/* Left: File Tree */}
      <div className="flex flex-col shrink-0" style={{
        width: '240px',
        borderRight: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
      }}>
        {/* Search */}
        <div className="p-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              value={fileSearch}
              onChange={e => setFileSearch(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-8 pr-3 py-1.5 text-[11px] font-mono focus:outline-none"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{fileCount} files</span>
            <div className="flex gap-1">
              <button onClick={() => {
                const all = new Set<string>()
                const collect = (nodes: FileNode[]) => nodes.forEach(n => { if (n.type === 'folder') { all.add(n.path); n.children && collect(n.children) } })
                collect(fileTree)
                setExpandedFolders(all)
              }} className="p-0.5" title="Expand all">
                <ChevronDown className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
              </button>
              <button onClick={() => setExpandedFolders(new Set())} className="p-0.5" title="Collapse all">
                <ChevronRight className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto mod-scroll py-1">
          {filteredTree.map(node => (
            <TreeNode
              key={node.path}
              node={node}
              level={0}
              onSelect={handleFileSelect}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              selectedPath={selectedFile || undefined}
              fileContents={fileContents}
            />
          ))}
          {filteredTree.length === 0 && (
            <div className="text-center py-8 text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {fileCount === 0 ? 'No files' : 'No matches'}
            </div>
          )}
        </div>
      </div>

      {/* Center: Code Viewer */}
      <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {selectedFile ? (
          <>
            {/* File header */}
            <div className="flex items-center justify-between px-4 py-2" style={{
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
            }}>
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-[12px] font-mono font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {selectedFile}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 shrink-0" style={{
                  color: 'var(--text-tertiary)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                }}>
                  {selectedLang}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                {selectedContent && <span>{formatSize(selectedContent.length)}</span>}
                <span>{lineCount} ln</span>
                {selectedContent && <CopyButton text={selectedContent} />}
              </div>
            </div>

            {/* Code content */}
            <div ref={codeRef} className="flex-1 overflow-auto mod-scroll">
              {loadingFile && !fileContents[selectedFile] ? (
                <div className="flex items-center justify-center h-full">
                  <span className="animate-pulse text-lg font-bold" style={{ color: 'var(--text-tertiary)' }}>_</span>
                </div>
              ) : (
                <div className="flex">
                  {/* Line numbers */}
                  <div className="select-none pr-3 pl-3 pt-4 text-right font-mono text-[12px] leading-relaxed shrink-0"
                    style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
                    {selectedContent.split('\n').map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  {/* Code */}
                  <pre className="flex-1 overflow-x-auto p-4">
                    <code className="font-mono text-[12px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      {selectedContent.split('\n').map((line, i) => (
                        <div key={i}>{line || ' '}</div>
                      ))}
                    </code>
                  </pre>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--bg-input)' }}>
            <FileCode className="w-6 h-6 mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <span className="text-[12px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {fileCount === 0 ? 'No source files available' : 'Select a file to view'}
            </span>
          </div>
        )}
      </div>

      {/* Right: Tasks Sidebar */}
      <div className="flex flex-col shrink-0" style={{
        width: tasksSidebarOpen ? '320px' : '40px',
        borderLeft: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
        transition: 'width 150ms ease',
      }}>
        {/* Sidebar header */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer"
          style={{ borderBottom: '1px solid var(--border-color)' }}
          onClick={() => setTasksSidebarOpen(!tasksSidebarOpen)}
        >
          {tasksSidebarOpen ? (
            <>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3" style={{ color: moduleColor }} />
                <span className="text-[11px] font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-secondary)' }}>
                  Tasks ({tasks.length})
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); fetchTasks() }}
                  disabled={tasksLoading}
                  className="p-1 transition-all"
                  style={{ color: 'var(--text-tertiary)' }}
                  title="Refresh"
                >
                  <RefreshCw className={`w-3 h-3 ${tasksLoading ? 'animate-spin' : ''}`} />
                </button>
                <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center w-full gap-1">
              <Zap className="w-3 h-3" style={{ color: moduleColor }} />
              <span className="text-[9px] font-bold font-mono" style={{ color: 'var(--text-tertiary)', writingMode: 'vertical-rl' }}>
                TASKS
              </span>
            </div>
          )}
        </div>

        {/* Tasks list */}
        {tasksSidebarOpen && (
          <div className="flex-1 overflow-y-auto mod-scroll">
            {tasksLoading && tasks.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <span className="animate-pulse text-lg font-bold" style={{ color: 'var(--text-tertiary)' }}>_</span>
              </div>
            )}

            {!tasksLoading && tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Clock className="w-4 h-4 mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-[11px] font-mono text-center" style={{ color: 'var(--text-tertiary)' }}>
                  No tasks yet
                </span>
              </div>
            )}

            <div className="space-y-0">
              {tasks.map((task, idx) => {
                const isExpanded = expandedTask === idx
                const fnName = task.fn?.split('/').slice(1).join('/') || task.fn
                const hasResult = task.result !== undefined && task.result !== null
                return (
                  <div key={task.cid || task.hash || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div
                      className="w-full text-left px-3 py-2 flex items-center gap-2 transition-all cursor-pointer"
                      onClick={() => setExpandedTask(isExpanded ? null : idx)}
                      style={{ backgroundColor: isExpanded ? 'var(--bg-input)' : 'transparent' }}
                    >
                      <span className="text-[11px] font-bold shrink-0" style={{ color: getStatusColor(task.status) }}>
                        {getStatusLabel(task.status)}
                      </span>
                      <span className="text-[11px] font-mono font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                        {fnName}
                      </span>
                      {task.delta !== undefined && (
                        <span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                          {task.delta.toFixed(1)}s
                        </span>
                      )}
                      {isExpanded
                        ? <ChevronUp className="w-3 h-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                        : <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      }
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                        <div className="text-[9px] font-mono pt-2" style={{ color: 'var(--text-tertiary)' }}>
                          {formatTime(task.time)}
                        </div>
                        {task.params && Object.keys(task.params).length > 0 && (
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Params</span>
                            <pre className="text-[10px] font-mono p-2 overflow-x-auto max-h-32 overflow-y-auto" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                              <code>{JSON.stringify(task.params, null, 2)}</code>
                            </pre>
                          </div>
                        )}
                        {hasResult && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Result</span>
                              <CopyButton text={JSON.stringify(task.result, null, 2)} />
                            </div>
                            <pre className="text-[10px] font-mono p-2 overflow-x-auto max-h-40 overflow-y-auto" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                              <code>{JSON.stringify(task.result, null, 2)}</code>
                            </pre>
                          </div>
                        )}
                        {task.cid && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>cid:</span>
                            <code className="text-[9px] font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{task.cid}</code>
                            <CopyButton text={task.cid} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .mod-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--scrollbar-thumb) transparent;
        }
        .mod-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .mod-scroll::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 3px;
        }
        .mod-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  )
}

function TreeNode({
  node, level, onSelect, expandedFolders, toggleFolder, selectedPath, fileContents,
}: {
  node: FileNode; level: number; onSelect: (n: FileNode) => void;
  expandedFolders: Set<string>; toggleFolder: (p: string) => void; selectedPath?: string;
  fileContents?: Record<string, string>;
}) {
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = selectedPath === node.path

  const handleClick = () => node.type === 'folder' ? toggleFolder(node.path) : onSelect(node)

  const Icon = node.type === 'folder'
    ? (isExpanded ? FolderOpen : Folder)
    : File

  return (
    <div>
      <div
        className="group flex cursor-pointer items-center px-2 py-1.5 text-[11px] transition-all duration-100"
        style={{
          paddingLeft: `${level * 12 + 8}px`,
          backgroundColor: isSelected ? 'var(--bg-input)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
        onClick={handleClick}
        title={node.path}
      >
        {node.type === 'folder' && (
          isExpanded
            ? <ChevronDown className="mr-1 h-2.5 w-2.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            : <ChevronRight className="mr-1 h-2.5 w-2.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        )}
        <Icon className="mr-1.5 h-3 w-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        <span className="flex-1 truncate font-mono font-medium">{node.name}</span>
        {node.type === 'file' && fileContents?.[node.path] && (
          <span className="ml-1 text-[9px] font-mono shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {formatSize(fileContents[node.path].length)}
          </span>
        )}
      </div>
      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              selectedPath={selectedPath}
              fileContents={fileContents}
            />
          ))}
        </div>
      )}
    </div>
  )
}
