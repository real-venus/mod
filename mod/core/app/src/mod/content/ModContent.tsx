"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { CopyButton } from '@/ui/CopyButton';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentIcon,
  FolderIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  CodeBracketIcon,
  DocumentChartBarIcon,
  DocumentTextIcon,
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  HashtagIcon
} from '@heroicons/react/24/outline';
import { ModuleType } from '@/types';
import { userContext } from '@/context';
import { useTheme } from '@/context/ThemeContext';


export interface ModContentProps {
  mod: {
    content: Record<string, string> | undefined | string;
  };
}

export type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
  hash?: string;
  lineCount?: number;
  size?: string;
  cid?: string;
};

export const ui = {
  dark: {
    panel: '#0d0d0d',
    panelAlt: '#000000',
    panelAlt2: '#06060a',
    border: 'rgba(96, 165, 250, 0.3)',
    borderDim: 'rgba(96, 165, 250, 0.15)',
    text: '#e7e7e7',
    textDim: 'rgba(255, 255, 255, 0.5)',
    textHighlight: '#60a5fa',
    accent: '#60a5fa',
    accentDim: 'rgba(96, 165, 250, 0.6)',
    bgAccent: 'rgba(96, 165, 250, 0.1)',
    green: '#22c55e',
    yellow: '#facc15',
    glow: 'rgba(96, 165, 250, 0.15)',
  },
  light: {
    panel: '#ffffff',
    panelAlt: '#f9fafb',
    panelAlt2: '#f3f4f6',
    border: 'rgba(59, 130, 246, 0.3)',
    borderDim: 'rgba(59, 130, 246, 0.15)',
    text: '#1f2937',
    textDim: 'rgba(0, 0, 0, 0.6)',
    textHighlight: '#2563eb',
    accent: '#3b82f6',
    accentDim: 'rgba(59, 130, 246, 0.7)',
    bgAccent: 'rgba(59, 130, 246, 0.1)',
    green: '#22c55e',
    yellow: '#facc15',
    glow: 'rgba(59, 130, 246, 0.15)',
  },
};

export const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, any> = {
    ts: CodeBracketIcon, tsx: CodeBracketIcon, js: CodeBracketIcon, jsx: CodeBracketIcon, py: CodeBracketIcon,
    json: DocumentChartBarIcon, css: DocumentTextIcon, html: DocumentTextIcon, md: DocumentTextIcon, txt: DocumentTextIcon,
    jpg: PhotoIcon, jpeg: PhotoIcon, png: PhotoIcon, gif: PhotoIcon, svg: PhotoIcon,
    mp4: FilmIcon, avi: FilmIcon, mov: FilmIcon, mp3: MusicalNoteIcon, wav: MusicalNoteIcon, zip: ArchiveBoxIcon, tar: ArchiveBoxIcon, gz: ArchiveBoxIcon,
  };
  return iconMap[ext] || DocumentIcon;
};

export const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', json: 'json', css: 'css', html: 'html', md: 'markdown',
  };
  return langMap[ext] || 'text';
};

export const languageColors: Record<string, string> = {
  typescript: 'text-blue-400', javascript: 'text-yellow-400', python: 'text-green-400',
  json: 'text-orange-400', css: 'text-pink-400', html: 'text-red-400',
  markdown: 'text-gray-400', text: 'text-gray-300',
};

export const formatFileSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

export const buildFileTree = (files: Record<string, string>): FileNode[] => {
  const root: FileNode = { name: '', path: '', type: 'folder', children: [] };

  Object.entries(files).forEach(([path, content]) => {
    const parts = path.split('/').filter(Boolean);
    let current = root;
    parts.forEach((part, idx) => {
      const isFile = idx === parts.length - 1;
      const currentPath = parts.slice(0, idx + 1).join('/');
      let child = current.children!.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          content: isFile ? content : undefined,
          language: isFile ? getLanguageFromPath(part) : undefined,
          cid: isFile ? content : undefined,
          lineCount: isFile ? content.split('\n').length : undefined,
          size: isFile ? formatFileSize(content.length) : undefined,
        };
        current.children!.push(child);
      }
      if (!isFile) current = child;
    });
  });

  const sortNodes = (nodes?: FileNode[]) => {
    if (!nodes) return;
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(root.children);
  return root.children || [];
};

export const highlightSearchTerm = (text: string, term: string) => {
  if (!term) return text;
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safe})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="bg-yellow-400/30 text-yellow-300 font-bold">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
};


export function FileTreeItem({
  node, level, onSelect, expandedFolders, toggleFolder, selectedPath, onCopy, searchTerm, isLight, theme,
}: {
  node: FileNode; level: number; onSelect: (n: FileNode) => void;
  expandedFolders: Set<string>; toggleFolder: (p: string) => void; selectedPath?: string;
  onCopy: (n: FileNode) => void; searchTerm?: string; isLight: boolean; theme: typeof ui.dark;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedPath === node.path;
  const FileIcon = node.type === 'file' ? getFileIcon(node.name) : (isExpanded ? FolderOpenIcon : FolderIcon);
  const [showCid, setShowCid] = useState(false);

  const matchesSearch = searchTerm
    ? node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.path.toLowerCase().includes(searchTerm.toLowerCase())
    : true;

  const handleClick = () => (node.type === 'folder' ? toggleFolder(node.path) : onSelect(node));
  if (!matchesSearch && node.type === 'file') return null;

  return (
    <div>
      <div
        className={`group micro-row flex cursor-pointer items-center px-3 py-2.5 text-[11px] transition-all duration-200 mx-1
        ${isSelected
          ? `${isLight ? 'text-gray-900' : 'text-white'}`
          : `${isLight ? 'text-gray-600 hover:bg-black/5' : 'text-gray-400 hover:bg-white/5'}`}
        ${matchesSearch && searchTerm ? 'ring-1 ring-yellow-400/40 bg-yellow-400/5' : ''}`}
        style={{
          paddingLeft: `${level * 12 + 12}px`,
          backgroundColor: isSelected ? (isLight ? 'rgba(59, 130, 246, 0.1)' : 'rgba(96, 165, 250, 0.1)') : 'transparent',
          border: isSelected ? `1px solid ${isLight ? 'rgba(59, 130, 246, 0.3)' : 'rgba(96, 165, 250, 0.3)'}` : '1px solid transparent',
          boxShadow: isSelected ? (isLight ? '0 0 15px rgba(59, 130, 246, 0.2)' : '0 0 15px rgba(96, 165, 250, 0.2)') : 'none'
        }}
        onClick={handleClick}
        title={node.path}
      >
        {node.type === 'folder' ? (
          isExpanded ? <ChevronDownIcon className="mr-1.5 h-3.5 w-3.5" style={{ color: theme.accent }} /> : <ChevronRightIcon className="mr-1.5 h-3.5 w-3.5" style={{ color: theme.accent }} />
        ) : null}
        <FileIcon className="mr-2.5 h-4 w-4 flex-shrink-0" style={{
          color: theme.accent,
          filter: `drop-shadow(0 0 4px ${theme.glow})`
        }} />
        <span className="flex-1 truncate font-mono font-medium">
          {searchTerm ? highlightSearchTerm(node.name, searchTerm) : node.name}
        </span>
        {node.type === 'file' ? (
          <>
            <span className="ml-2 text-[10px] opacity-50 font-mono">{node.size}</span>
            <div
              className="relative ml-1.5"
              onMouseEnter={() => setShowCid(true)}
              onMouseLeave={() => setShowCid(false)}
            >
              <HashtagIcon className="h-3.5 w-3.5 transition-colors" style={{ color: theme.accentDim }} />
              {showCid && node.cid && (
                <div
                  className="absolute right-0 top-6 z-50 border px-3 py-2 text-[10px] font-mono whitespace-nowrap shadow-xl"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.panel,
                    color: theme.textHighlight
                  }}
                >
                  {node.cid.length > 46 ? `${node.cid.slice(0, 46)}...` : node.cid}
                </div>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onCopy(node); }}
              className={`ml-1.5 opacity-0 transition-all group-hover:opacity-100 p-1.5 rounded-md ${isLight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`}
              title="Copy file content"
            >
              <ClipboardDocumentIcon className={`h-3.5 w-3.5 ${isLight ? 'text-black/40 hover:text-black' : 'text-gray-400 hover:text-white'}`} />
            </button>
          </>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(node); }}
            className={`ml-1.5 opacity-0 transition-all group-hover:opacity-100 p-1.5 rounded-md ${isLight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`}
            title="Copy folder contents"
          >
            <ClipboardDocumentIcon className={`h-3.5 w-3.5 ${isLight ? 'text-black/40 hover:text-black' : 'text-gray-400 hover:text-white'}`} />
          </button>
        )}
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
              onCopy={onCopy}
              searchTerm={searchTerm}
              isLight={isLight}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
}


export default function ModContent({ mod }: { mod: ModuleType }) {
  const files = typeof mod.content === 'object' && mod.content !== null ? mod.content : {};
  const { client } = userContext();
  const { effectiveTheme } = useTheme();
  const isLight = effectiveTheme === 'light';
  const theme = isLight ? ui.light : ui.dark;
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [selectedVersion, setSelectedVersion] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<string | null>(mod.content && typeof mod.content === 'object' ? Object.keys(mod.content)[0] : null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<{ path: string; lineNumbers: number[] }[]>([]);
  const codeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [fileContents, setFileContents] = useState<Record<string, string>>({});


  const handleFileSelect = async (node: FileNode) => {
    if (node.type !== 'file') return;
    setSelectedFile(node.path);
    if (node.cid && client && !fileContents[node.path]) {
      try {
        const res = await client.call('get', { cid: node.cid });
        setFileContents(prev => ({ ...prev, [node.path]: res }));
      } catch (err) {
        console.error('Failed to fetch content for', node.path, err);
      }
    }
    const el = codeRefs.current[node.path];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const tree = buildFileTree(files);
    setFileTree(tree);
    if (!selectedFile) {
       for (let n of tree) {
          handleFileSelect(n).then(() => {});
          break;
       }
      }

    // Start with all folders collapsed by default
    setExpandedFolders(new Set());
    if (tree.length > 0 && tree[0].type === 'file') setSelectedFile(tree[0].path);
  }, [files, selectedFile]);

  useEffect(() => {
    if (!searchTerm) return;
    const folders = new Set<string>();
    const check = (n: FileNode, parent = '') => {
      const cp = parent ? `${parent}/${n.name}` : n.name;
      if (n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.path.toLowerCase().includes(searchTerm.toLowerCase())) {
        const parts = cp.split('/').filter(Boolean);
        for (let i = 0; i < parts.length - 1; i++) folders.add(parts.slice(0, i + 1).join('/'));
      }
      n.children?.forEach((c) => check(c, cp));
    };
    fileTree.forEach((n) => check(n));
    setExpandedFolders((prev) => { const newSet = new Set(prev); folders.forEach(folder => newSet.add(folder)); return newSet; });
  }, [searchTerm, fileTree]);

  useEffect(() => {
    if (!searchTerm) { setSearchResults([]); return; }
    const results: { path: string; lineNumbers: number[] }[] = [];
    Object.entries(files).forEach(([path, content]) => {
      if (typeof content !== 'string') return;
      const lines = content.split('\n');
      const matchLines: number[] = [];
      const q = searchTerm.toLowerCase();
      lines.forEach((line, idx) => { if (line.toLowerCase().includes(q)) matchLines.push(idx + 1); });
      if (matchLines.length) results.push({ path, lineNumbers: matchLines });
    });
    setSearchResults(results);
    setCollapsedFiles(new Set());
  }, [searchTerm, files]);

  const fileSections = useMemo(() =>
    Object.entries(files)
      .map(([path, content]) => {
        if (typeof content !== 'string') return null;
        return {
          path,
          name: path.split('/').pop() || path,
          content,
          language: getLanguageFromPath(path),
          cid: content,
          lineCount: content.split('\n').length,
          size: formatFileSize(content.length),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null),
    [files]
  );

  const filteredSections = useMemo(() => {
    if (!searchTerm) return fileSections;
    const q = searchTerm.toLowerCase();
    return fileSections.filter((s) => s && (s.path.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)));
  }, [fileSections, searchTerm]);

  const filteredTree = useMemo(() => {
    if (!searchTerm) return fileTree;
    const matchesSearch = (n: FileNode): boolean => {
      if (n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.path.toLowerCase().includes(searchTerm.toLowerCase())) return true;
      if (n.type === 'folder' && n.children) {
        return n.children.some(matchesSearch);
      }
      return false;
    };
    return fileTree.filter(matchesSearch);
  }, [fileTree, searchTerm]);

  const stats = useMemo(() => {
    const totalLines = filteredSections.reduce((sum, s) => sum + s.lineCount, 0);
    const totalSize = filteredSections.reduce((sum, s) => sum + s.content.length, 0);
    return { fileCount: filteredSections.length, totalLines, totalSize: formatFileSize(totalSize) };
  }, [filteredSections]);

  const toggleFile = (path: string) => setCollapsedFiles((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  const toggleFolder = (path: string) => setExpandedFolders((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });

  const copyFileContent = (node: FileNode) => {
    if (node.type === 'file' && node.content) {
      navigator.clipboard.writeText(node.content);
      return;
    }
    if (node.type === 'folder') {
      const buffer: string[] = [];
      const walk = (n: FileNode) => {
        if (n.type === 'file' && n.content) buffer.push(`// ${n.path}\n${n.content}`);
        n.children?.forEach(walk);
      };
      walk(node);
      navigator.clipboard.writeText(buffer.join('\n\n'));
    }
  };

  const renderLineNumbers = (content: string, startLine: number, path: string) => {
    const lines = content.split('\n');
    const matches = searchResults.find((r) => r.path === path)?.lineNumbers || [];
    return (
      <div className="select-none pr-3 font-mono text-[14px]" style={{ color: theme.textDim }}>
        {lines.map((_, i) => {
          const ln = startLine + i;
          const isMatch = matches.includes(ln);
          return (
            <div key={i} className={`text-right ${isMatch ? 'bg-yellow-400/20 text-yellow-400' : ''}`}>
              {ln}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCode = (content: string, language: string, path: string) => {
    const lines = content.split('\n');
    const matches = searchResults.find((r) => r.path === path)?.lineNumbers || [];
    return (
      <pre className="micro-scroll micro-edge-x flex-1 overflow-x-auto">
        <code className={`font-mono text-[14px] leading-relaxed ${isLight ? 'text-gray-900' : 'text-gray-300'}`}>
          {lines.map((line, i) => {
            const ln = i + 1;
            const isMatch = matches.includes(ln);
            return (
              <div key={i} className={isMatch ? 'bg-yellow-400/20' : ''}>
                {searchTerm ? highlightSearchTerm(line, searchTerm) : line}
              </div>
            );
          })}
        </code>
      </pre>
    );
  };

  const topFile = fileSections[0];

  // Mock versions for now - can be replaced with actual version data from mod
  const versions = [
    { version: '1.0.0', timestamp: Date.now(), label: 'latest' },
    { version: '0.9.0', timestamp: Date.now() - 86400000, label: '' },
    { version: '0.8.0', timestamp: Date.now() - 172800000, label: '' },
  ];

  return (
    <div className="overflow-hidden font-mono p-4 relative" style={{ fontFamily: 'JetBrains Mono, monospace', backgroundColor: theme.panelAlt }}>
      {/* Ambient glow background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 right-0 w-96 h-96 blur-[120px] rounded-full" style={{ backgroundColor: theme.bgAccent }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 blur-[120px] rounded-full" style={{ backgroundColor: theme.bgAccent }} />
      </div>

      {/* Single line header with search and stats */}
      <div className="px-6 py-3 shadow-2xl flex items-center gap-4 relative" style={{
        backgroundColor: theme.panel,
        border: `2px solid ${theme.border}`,
        boxShadow: `0 0 30px ${theme.glow}`
      }}>
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: theme.accent }} />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: theme.accent }} />

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="px-2.5 py-1" style={{
            background: `linear-gradient(to right, ${theme.bgAccent}, ${theme.bgAccent})`,
            border: `1px solid ${theme.border}`,
            boxShadow: `0 0 10px ${theme.glow}`
          }}>
            <span className="text-[10px] font-bold" style={{
              color: theme.accent,
              textShadow: isLight ? 'none' : `0 0 8px ${theme.glow}`
            }}>CNT</span>
          </div>
          <h3 className="text-[13px] font-bold tracking-wide whitespace-nowrap uppercase" style={{
            color: theme.text,
            textShadow: isLight ? 'none' : `0 0 10px ${theme.glow}`
          }}>
            ► FILE EXPLORER
          </h3>
        </div>

        {/* Search bar - flex-1 to take remaining space */}
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{
            color: theme.accent,
            filter: `drop-shadow(0 0 4px ${theme.glow})`
          }} />
          <input
            type="text"
            placeholder="Search files and content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full border pl-9 pr-3 py-2 text-[11px] outline-none transition-all ${isLight ? 'bg-gray-50 focus:bg-white' : 'bg-white/[0.03] focus:bg-white/[0.06]'}`}
            style={{
              borderColor: theme.border,
              color: theme.text,
              boxShadow: `0 0 15px ${theme.glow}`
            }}
          />
        </div>

        {/* Version selector */}
        <select
          value={selectedVersion}
          onChange={(e) => setSelectedVersion(Number(e.target.value))}
          className={`px-3 py-2 text-[11px] font-medium border outline-none transition-all flex-shrink-0 font-mono ${isLight ? 'bg-gray-50 text-gray-900' : 'bg-white/[0.03] text-white'}`}
          style={{
            borderColor: theme.border,
            boxShadow: `0 0 15px ${theme.glow}`
          }}
        >
          {versions.map((v, idx) => (
            <option key={idx} value={idx}>
              v{v.version} {v.label && `(${v.label})`}
            </option>
          ))}
        </select>

        {/* Stats */}
        <div className="flex items-center gap-2 text-[10px] font-medium flex-shrink-0 font-mono">
          <span className="px-2.5 py-1 whitespace-nowrap" style={{
            backgroundColor: theme.bgAccent,
            color: theme.accent,
            border: `1px solid ${theme.border}`,
            textShadow: isLight ? 'none' : `0 0 8px ${theme.glow}`
          }}>{stats.fileCount} files</span>
          <span className="px-2.5 py-1 whitespace-nowrap" style={{
            backgroundColor: theme.bgAccent,
            color: theme.accent,
            border: `1px solid ${theme.border}`,
            textShadow: isLight ? 'none' : `0 0 8px ${theme.glow}`
          }}>{stats.totalLines} lines</span>
          <span className="px-2.5 py-1 whitespace-nowrap" style={{
            backgroundColor: theme.bgAccent,
            color: theme.accent,
            border: `1px solid ${theme.border}`,
            textShadow: isLight ? 'none' : `0 0 8px ${theme.glow}`
          }}>{stats.totalSize}</span>
          {searchTerm && searchResults.length > 0 && (
            <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-400 whitespace-nowrap" style={{
              border: '1px solid rgba(234, 179, 8, 0.3)',
              textShadow: '0 0 8px rgba(234, 179, 8, 0.5)'
            }}>
              {searchResults.reduce((s, r) => s + r.lineNumbers.length, 0)} matches
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-4 mt-4 relative">
        <div className="micro-scroll-y w-72 max-h-[600px] overflow-y-auto p-4 shadow-xl relative" style={{
          backgroundColor: theme.panelAlt2,
          border: `2px solid ${theme.border}`,
          boxShadow: `0 0 30px ${theme.glow}`
        }}>
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: theme.accent }} />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: theme.accent }} />

          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold tracking-wide uppercase" style={{
                color: theme.accent,
                textShadow: isLight ? 'none' : `0 0 8px ${theme.glow}`
              }}>► Files</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const all = new Set<string>();
                    const collect = (nodes: FileNode[]) => nodes.forEach((n) => { if (n.type === 'folder') { all.add(n.path); n.children && collect(n.children); }});
                    collect(fileTree);
                    setExpandedFolders(all);
                  }}
                  className={`text-xs transition-all p-1.5 rounded-md ${isLight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`}
                  style={{ color: theme.accentDim }}
                  title="Expand all"
                >
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setExpandedFolders(new Set())}
                  className={`text-xs transition-all p-1.5 rounded-md ${isLight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`}
                  style={{ color: theme.accentDim }}
                  title="Collapse all"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-0.5">
            {filteredTree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                level={0}
                onSelect={handleFileSelect}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                selectedPath={selectedFile || undefined}
                onCopy={copyFileContent}
                searchTerm={searchTerm}
                isLight={isLight}
                theme={theme}
              />
            ))}
          </div>
        </div>

        <div className="micro-scroll-y max-h-[600px] flex-1 overflow-y-auto shadow-xl p-4 relative" style={{
          backgroundColor: theme.panel,
          border: `2px solid ${theme.border}`,
          boxShadow: `0 0 30px ${theme.glow}`
        }}>
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: theme.accent }} />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: theme.accent }} />

          {filteredSections.map((section) => {
            const isCollapsed = collapsedFiles.has(section.path);
            const isSelected = selectedFile === section.path;
            const FileIcon = getFileIcon(section.name);
            const matches = searchResults.find((r) => r.path === section.path)?.lineNumbers.length || 0;
            if (selectedFile && !isSelected) return null;
            if (!client) return null;
            const content = fileContents[section.path] || section.content;

            return (
              <div
                key={section.path}
                ref={(el) => { codeRefs.current[section.path] = el; }}
                className={`overflow-hidden mb-4 border transition-all duration-200 relative`}
                style={{
                  borderColor: isSelected ? 'rgba(6, 182, 212, 0.5)' : matches ? 'rgba(234, 179, 8, 0.5)' : theme.border,
                  backgroundColor: theme.panelAlt2,
                  boxShadow: isSelected
                    ? '0 0 30px rgba(6, 182, 212, 0.3)'
                    : matches
                    ? '0 0 20px rgba(234, 179, 8, 0.2)'
                    : 'none',
                  borderWidth: '2px'
                }}
              >
                <div
                  className={`flex cursor-pointer items-center justify-between px-5 py-3.5 transition-all duration-200 rounded-t-xl ${isLight ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
                  onClick={() => toggleFile(section.path)}
                >
                  <div className="micro-row flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                    {isCollapsed ? <ChevronRightIcon className="h-4 w-4 flex-shrink-0" style={{ color: theme.textDim }} /> : <ChevronDownIcon className="h-4 w-4 flex-shrink-0" style={{ color: theme.textDim }} />}
                    <FileIcon className="h-5 w-5 flex-shrink-0" style={{ color: theme.accent }} />
                    <span className={`font-mono text-[13px] font-medium ${isLight ? 'text-gray-900' : 'text-white'} truncate flex-shrink`}>
                      {searchTerm && section.path.toLowerCase().includes(searchTerm.toLowerCase())
                        ? highlightSearchTerm(section.path, searchTerm)
                        : section.path}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${languageColors[section.language]} ${isLight ? 'bg-gray-200' : 'bg-black/40'}`}
                        style={{ borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
                        {section.language}
                      </span>
                      {/* CID Display - Inline with filename */}
                      <span className="text-[10px] font-mono select-all px-2.5 py-1 rounded-md"
                        style={{
                          color: theme.textHighlight,
                          backgroundColor: theme.bgAccent,
                          border: `1px solid ${theme.borderDim}`
                        }}
                        onClick={(e) => e.stopPropagation()}
                        title={section.cid}>
                        {section.cid.length > 20 ? `${section.cid.slice(0, 10)}...${section.cid.slice(-8)}` : section.cid}
                      </span>
                      {!!matches && <span className="text-[10px] text-yellow-400 font-medium px-2.5 py-1 rounded-full bg-yellow-400/10 border border-yellow-500/20">{matches} matches</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase flex-shrink-0 ml-4 whitespace-nowrap" style={{ color: theme.textDim }}>
                    <span>{section.size}</span>
                    <span>{section.lineCount} lines</span>
                    <CopyButton content={content} />
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="flex rounded-b-xl overflow-hidden" style={{ backgroundColor: theme.panelAlt2 }}>
                    {renderLineNumbers(content, 1, section.path)}
                    <div className="micro-scroll micro-edge-x flex-1 overflow-x-auto p-5">
                      {renderCode(content, section.language, section.path)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4 mt-4 shadow-xl relative" style={{
        backgroundColor: theme.panel,
        border: `2px solid ${theme.border}`,
        boxShadow: `0 0 30px ${theme.glow}`
      }}>
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: theme.accent }} />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: theme.accent }} />

        <div className="text-[11px] font-medium font-mono">
          {searchTerm && searchResults.length > 0 && (
            <span className="px-3 py-1.5 bg-yellow-500/10 text-yellow-400" style={{
              border: '1px solid rgba(234, 179, 8, 0.3)',
              textShadow: '0 0 8px rgba(234, 179, 8, 0.5)'
            }}>
              Found "{searchTerm}" in {searchResults.length} files
            </span>
          )}
        </div>
        <button
          onClick={() => {
            const all = filteredSections.map((s) => `// ${s.path}\n${s.content}`).join('\n\n');
            navigator.clipboard.writeText(all);
          }}
          className="flex items-center gap-2.5 text-[11px] font-medium font-mono transition-all px-4 py-2.5 relative group"
          style={{
            color: theme.accent,
            border: `2px solid ${theme.border}`,
            boxShadow: `0 0 20px ${theme.glow}`,
            textShadow: isLight ? 'none' : `0 0 8px ${theme.glow}`
          }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: theme.bgAccent }} />
          <DocumentIcon className="h-4 w-4 relative" />
          <span className="relative uppercase tracking-wider">Copy All Code</span>
        </button>
      </div>

      <style jsx>{`
        .micro-scroll {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .micro-scroll:hover {
          scrollbar-color: ${theme.borderDim} transparent;
        }
        .micro-scroll::-webkit-scrollbar {
          height: 8px;
          background: transparent;
        }
        .micro-scroll::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 9999px;
        }
        .micro-scroll:hover::-webkit-scrollbar-thumb {
          background: ${theme.borderDim};
        }
        .micro-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .micro-scroll-y {
          scrollbar-width: thin;
          scrollbar-color: ${theme.borderDim} transparent;
        }
        .micro-scroll-y::-webkit-scrollbar {
          width: 10px;
          background: transparent;
        }
        .micro-scroll-y::-webkit-scrollbar-thumb {
          background: ${theme.borderDim};
          border-radius: 9999px;
        }
        .micro-scroll-y::-webkit-scrollbar-track {
          background: transparent;
        }
        .micro-edge-x {
          -webkit-mask-image: linear-gradient(to right, transparent, black 12px, black calc(100% - 12px), transparent);
          mask-image: linear-gradient(to right, transparent, black 12px, black calc(100% - 12px), transparent);
        }
        .micro-row {
          min-height: 32px;
        }
      `}</style>
    </div>
  );
}