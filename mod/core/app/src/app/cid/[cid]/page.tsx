"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { userContext } from '@/context';
import { CopyButton } from '@/ui/CopyButton';

export default function CidViewer() {
  const { cid } = useParams();
  const { client } = userContext();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentType, setContentType] = useState<'json' | 'text' | 'code' | 'unknown'>('unknown');

  useEffect(() => {
    if (!cid || !client) return;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await client.call('get', { cid: cid as string });
        setContent(res);

        // Detect content type
        if (typeof res === 'string') {
          try {
            JSON.parse(res);
            setContentType('json');
          } catch {
            if (res.includes('function') || res.includes('const') || res.includes('import') || res.includes('export')) {
              setContentType('code');
            } else {
              setContentType('text');
            }
          }
        } else if (typeof res === 'object') {
          setContentType('json');
        } else {
          setContentType('unknown');
        }
      } catch (err: any) {
        console.error('Failed to fetch CID content:', err);
        setError(err.message || 'Failed to fetch content');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [cid, client]);

  const renderContent = () => {
    if (contentType === 'json') {
      const jsonContent = typeof content === 'string' ? JSON.parse(content) : content;
      return (
        <pre className="text-sm overflow-auto bg-black p-4 border border-white/20 text-white/90 font-mono max-h-[600px]">
          {JSON.stringify(jsonContent, null, 2)}
        </pre>
      );
    } else if (contentType === 'code' || contentType === 'text') {
      return (
        <pre className="text-sm overflow-auto bg-black p-4 border border-white/20 text-white/90 font-mono max-h-[600px] whitespace-pre-wrap">
          {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        </pre>
      );
    } else {
      return (
        <div className="bg-black p-4 border border-white/20 text-white/80 font-mono text-sm">
          {typeof content === 'string' ? content : JSON.stringify(content)}
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen p-6 bg-black text-white" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="border-b border-white/10 pb-4">
          <h1 className="text-2xl font-bold text-white mb-1">{cid}</h1>
          <p className="text-xs text-white/50 uppercase tracking-wide">Content-addressed data</p>
        </div>

        {/* CID Info */}
        <div className="border border-white/20 p-4">
          <div className="flex items-center justify-between">
            <CopyButton text={cid as string} size="sm" />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="border border-white/20 p-8 text-center">
            <div className="text-sm text-white/70">Loading...</div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="border border-white/30 p-4 bg-white/5">
            <div className="text-sm font-bold text-white mb-2">Error</div>
            <div className="text-sm text-white/70 font-mono">{error}</div>
          </div>
        )}

        {/* Content Display */}
        {content && !loading && !error && (
          <div className="border border-white/20">
            <div className="border-b border-white/10 p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white uppercase">{contentType}</div>
                <div className="text-xs text-white/50 font-mono mt-1">
                  {typeof content === 'string' ? content.length : JSON.stringify(content).length} bytes
                </div>
              </div>
              <div className="flex gap-2">
                <CopyButton
                  text={typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                  size="sm"
                />
                <button
                  onClick={() => {
                    const blob = new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 2)], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${cid}.${contentType === 'json' ? 'json' : 'txt'}`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1 border border-white/20 hover:bg-white/5 text-xs font-mono uppercase transition-colors"
                >
                  Download
                </button>
              </div>
            </div>
            <div className="p-4">
              {renderContent()}
            </div>
          </div>
        )}

        {/* Metadata */}
        {content && !loading && !error && (
          <div className="border border-white/20 p-4">
            <div className="text-xs font-bold text-white/70 uppercase mb-3">Metadata</div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-white/50 uppercase mb-1">Type</div>
                <div className="text-white font-mono">{contentType}</div>
              </div>
              <div>
                <div className="text-white/50 uppercase mb-1">Format</div>
                <div className="text-white font-mono">{typeof content}</div>
              </div>
              <div>
                <div className="text-white/50 uppercase mb-1">Size</div>
                <div className="text-white font-mono">
                  {(typeof content === 'string' ? content.length : JSON.stringify(content).length).toLocaleString()} bytes
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
