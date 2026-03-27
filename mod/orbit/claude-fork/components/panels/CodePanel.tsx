"use client";

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Search,
  Copy,
  Check,
  Code,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  Hash
} from 'lucide-react'
import type { ModuleData } from '../UnifiedInterface'

interface CodePanelProps {
  mod: ModuleData
  client?: any
}

type FileNode = {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  cid?: string
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const iconMap: Record<string, any> = {
    ts: Code, tsx: Code, js: Code, jsx: Code, py: Code,
    json: FileText, css: FileText, html: FileText, md: FileText, txt: FileText,
    jpg: Image, jpeg: Image, png: Image, gif: Image, svg: Image,
    mp4: Film, avi: Film, mov: Film,
    mp3: Music, wav: Music,
    zip: Archive, tar: Archive, gz: Archive,
  }
  return iconMap[ext] || File
}

const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', json: 'json', css: 'css', html: 'html', md: 'markdown',
    rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
  }
  return langMap[ext] || 'text'
}

const formatFileSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`

const buildFileTree = (files: Record<string, string>): FileNode[] => {
  const root: FileNode = { name: '', path: '', type: 'folder', children: [] }

  Object.entries(files).forEach(([path, cid]) => {
    const parts = path.split('/').filter(Boolean)
    let current = root
    parts.forEach((part, idx) => {
      const isFile = idx === parts.length - 1
      const currentPath = parts.slice(0, idx + 1).join('/')
      let child = current.children!.find((c) => c.name === part)
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
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
    nodes.forEach((n) => sortNodes(n.children))
  }
  sortNodes(root.children)
  return root.children || []
}

function FileTreeItem({
  node,
  level,
  onSelect,
  expandedFolders,
  toggleFolder,
  selectedPath,
  searchTerm,
}: {
  node: FileNode
  level: number
  onSelect: (n: FileNode) => void
  expandedFolders: Set<string>
  toggleFolder: (p: string) => void
  selectedPath?: string
  searchTerm?: string
}) {
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = selectedPath === node.path
  const FileIcon = node.type === 'file' ? getFileIcon(node.name) : (isExpanded ? FolderOpen : Folder)

  const matchesSearch = searchTerm
    ? node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.path.toLowerCase().includes(searchTerm.toLowerCase())
    : true

  const handleClick = () => (node.type === 'folder' ? toggleFolder(node.path) : onSelect(node))
  if (!matchesSearch && node.type === 'file') return null

  return (
    <div>
      <div
        className="group flex cursor-pointer items-center px-2 py-2 text-[11px] transition-all duration-150 mx-0.5"
        style={{
          paddingLeft: `${level * 12 + 8}px`,
          backgroundColor: isSelected ? 'var(--bg-input)' : 'transparent',
          border: isSelected ? '1px solid var(--border-color)' : '1px solid transparent',
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
        onClick={handleClick}
        title={node.path}
      >
        {node.type === 'folder' ? (
          isExpanded
            ? <ChevronDown className="mr-1.5 h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
            : <ChevronRight className="mr-1.5 h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
        ) : null}
        <FileIcon className="mr-2 h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        <span className="flex-1 truncate font-mono font-medium">
          {node.name}
        </span>
      </div>
      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              selectedPath={selectedPath}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CodePanel({ mod, client }: CodePanelProps) {
  const files = typeof mod.content === 'object' && mod.content !== null ? mod.content : {}
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  const handleFileSelect = async (node: FileNode) => {
    if (node.type !== 'file') return
    setSelectedFile(node.path)
    if (node.cid && client && !fileContents[node.path]) {
      try {
        const res = await client.call('get', { cid: node.cid })
        setFileContents(prev => ({ ...prev, [node.path]: res }))
      } catch (err) {
        console.error('Failed to fetch content for', node.path, err)
      }
    }
  }

  useEffect(() => {
    const tree = buildFileTree(files)
    setFileTree(tree)

    // Auto-select first file
    if (!selectedFile && tree.length > 0) {
      const firstFile = tree.find(n => n.type === 'file') || tree[0]
      if (firstFile.type === 'file') {
        handleFileSelect(firstFile)
      }
    }
  }, [files])

  useEffect(() => {
    if (!searchTerm) return
    const folders = new Set<string>()
    const check = (n: FileNode, parent = '') => {
      const cp = parent ? `${parent}/${n.name}` : n.name
      if (n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.path.toLowerCase().includes(searchTerm.toLowerCase())) {
        const parts = cp.split('/').filter(Boolean)
        for (let i = 0; i < parts.length - 1; i++) folders.add(parts.slice(0, i + 1).join('/'))
      }
      n.children?.forEach((c) => check(c, cp))
    }
    fileTree.forEach((n) => check(n))
    setExpandedFolders((prev) => {
      const newSet = new Set(prev)
      folders.forEach(folder => newSet.add(folder))
      return newSet
    })
  }, [searchTerm, fileTree])

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const n = new Set(prev)
      n.has(path) ? n.delete(path) : n.add(path)
      return n
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const stats = useMemo(() => {
    const fileCount = Object.keys(files).length
    const totalLines = Object.values(fileContents).reduce((sum, content) => {
      return sum + (typeof content === 'string' ? content.split('\n').length : 0)
    }, 0)
    const totalSize = Object.values(fileContents).reduce((sum, content) => {
      return sum + (typeof content === 'string' ? content.length : 0)
    }, 0)
    return { fileCount, totalLines, totalSize: formatFileSize(totalSize) }
  }, [files, fileContents])

  const selectedFileContent = selectedFile ? fileContents[selectedFile] : null
  const selectedFileNode = useMemo(() => {
    const find = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.path === selectedFile) return node
        if (node.children) {
          const found = find(node.children)
          if (found) return found
        }
      }
      return null
    }
    return find(fileTree)
  }, [fileTree, selectedFile])

  const renderCode = (content: string, language: string) => {
    const lines = content.split('\n')
    return (
      <div className="flex overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Line numbers */}
        <div className="select-none pr-3 pl-4 py-4 font-mono text-[12px]" style={{
          color: 'var(--text-tertiary)',
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-color)'
        }}>
          {lines.map((_, i) => (
            <div key={i} className="text-right leading-relaxed">
              {i + 1}
            </div>
          ))}
        </div>
        {/* Code content */}
        <pre className="code-scroll flex-1 overflow-x-auto p-4">
          <code className="font-mono text-[12px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {lines.map((line, i) => (
              <div key={i}>{line || ' '}</div>
            ))}
          </code>
        </pre>
      </div>
    )
  }

  return (
    <div className="overflow-hidden font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Header bar */}
      <div className="px-4 py-2.5 flex items-center gap-4 mb-4" style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
      }}>
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[11px] font-mono outline-none transition-all"
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
          <span>{stats.fileCount} files</span>
          <span>·</span>
          <span>{stats.totalLines} lines</span>
          <span>·</span>
          <span>{stats.totalSize}</span>
        </div>
      </div>

      <div className="flex gap-0">
        {/* File tree sidebar */}
        <div className="code-scroll-y w-64 max-h-[600px] overflow-y-auto py-3" style={{
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-color)',
          border: '1px solid var(--border-color)',
        }}>
          <div className="mb-2 px-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold tracking-wider uppercase font-mono" style={{ color: 'var(--text-tertiary)' }}>
                Files
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    const all = new Set<string>()
                    const collect = (nodes: FileNode[]) => nodes.forEach((n) => {
                      if (n.type === 'folder') {
                        all.add(n.path)
                        n.children && collect(n.children)
                      }
                    })
                    collect(fileTree)
                    setExpandedFolders(all)
                  }}
                  className="p-1 transition-all"
                  title="Expand all"
                >
                  <ChevronDown className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                </button>
                <button
                  onClick={() => setExpandedFolders(new Set())}
                  className="p-1 transition-all"
                  title="Collapse all"
                >
                  <ChevronRight className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-0">
            {fileTree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                level={0}
                onSelect={handleFileSelect}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                selectedPath={selectedFile || undefined}
                searchTerm={searchTerm}
              />
            ))}
          </div>
        </div>

        {/* Code panel */}
        <div className="code-scroll-y max-h-[600px] flex-1 overflow-y-auto" style={{
          border: '1px solid var(--border-color)',
          borderLeft: 'none',
        }}>
          {selectedFile && selectedFileNode ? (
            <div className="overflow-hidden">
              {/* File header */}
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderBottom: '1px solid var(--border-color)'
                }}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {(() => {
                    const Icon = getFileIcon(selectedFileNode.name)
                    return <Icon className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  })()}
                  <span className="font-mono text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {selectedFile}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5" style={{
                    color: 'var(--text-tertiary)',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                  }}>
                    {getLanguageFromPath(selectedFile)}
                  </span>
                  {selectedFileNode.cid && (
                    <span
                      className="text-[9px] font-mono px-1.5 py-0.5 flex items-center gap-1"
                      style={{
                        color: 'var(--text-tertiary)',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                      }}
                      title={selectedFileNode.cid}
                    >
                      <Hash className="h-2.5 w-2.5" />
                      {selectedFileNode.cid.slice(0, 8)}...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {selectedFileContent && (
                    <>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                        {formatFileSize(selectedFileContent.length)}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                        {selectedFileContent.split('\n').length} ln
                      </span>
                    </>
                  )}
                  <button
                    onClick={() => selectedFileContent && copyToClipboard(selectedFileContent)}
                    className="p-1"
                    title="Copy file content"
                  >
                    {copied ?
                      <Check className="h-3.5 w-3.5 text-green-400" /> :
                      <Copy className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                    }
                  </button>
                </div>
              </div>

              {/* Code content */}
              {selectedFileContent ? (
                renderCode(selectedFileContent, getLanguageFromPath(selectedFile))
              ) : (
                <div className="flex items-center justify-center py-12 text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  Loading...
                </div>
              )}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center h-full min-h-[400px]"
              style={{
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <Code className="w-8 h-8 mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-[12px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                Select a file to view
              </span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .code-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--scrollbar-thumb) transparent;
        }
        .code-scroll::-webkit-scrollbar {
          height: 6px;
          background: transparent;
        }
        .code-scroll::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 3px;
        }
        .code-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .code-scroll-y {
          scrollbar-width: thin;
          scrollbar-color: var(--scrollbar-thumb) transparent;
        }
        .code-scroll-y::-webkit-scrollbar {
          width: 6px;
          background: transparent;
        }
        .code-scroll-y::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 3px;
        }
        .code-scroll-y::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  )
}
