"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { userContext } from '@/context';
import { useTheme } from '@/context/ThemeContext';
import { CopyButton } from '@/ui/CopyButton';

export default function CidViewer() {
  const { cid } = useParams();
  const { client } = userContext();
  const { effectiveTheme } = useTheme();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentType, setContentType] = useState<'json' | 'text' | 'code' | 'unknown'>('unknown');
  const isLight = effectiveTheme === 'light';

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
    const bgClass = isLight ? 'bg-gray-50' : 'bg-black';
    const borderClass = isLight ? 'border-black/10' : 'border-white/20';
    const textClass = isLight ? 'text-black/90' : 'text-white/90';

    if (contentType === 'json') {
      const jsonContent = typeof content === 'string' ? JSON.parse(content) : content;
      return (
        <pre className={`text-sm overflow-auto ${bgClass} p-4 border ${borderClass} ${textClass} font-mono max-h-[600px]`}>
          {JSON.stringify(jsonContent, null, 2)}
        </pre>
      );
    } else if (contentType === 'code' || contentType === 'text') {
      return (
        <pre className={`text-sm overflow-auto ${bgClass} p-4 border ${borderClass} ${textClass} font-mono max-h-[600px] whitespace-pre-wrap`}>
          {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        </pre>
      );
    } else {
      return (
        <div className={`${bgClass} p-4 border ${borderClass} ${isLight ? 'text-black/80' : 'text-white/80'} font-mono text-sm`}>
          {typeof content === 'string' ? content : JSON.stringify(content)}
        </div>
      );
    }
  };

  return (
    <div className={`min-h-screen p-6 ${isLight ? 'bg-white text-black' : 'bg-black text-white'}`} style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header with CID and Copy Button */}
        <div className={`border ${isLight ? 'border-black/10' : 'border-white/10'} rounded-lg p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                Content-Addressed Data
              </div>
              <h1 className={`text-lg font-bold font-mono break-all ${isLight ? 'text-black' : 'text-white'}`}>
                {cid}
              </h1>
            </div>
            <CopyButton text={cid as string} size="md" />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className={`border ${isLight ? 'border-black/20' : 'border-white/20'} rounded-lg p-8 text-center`}>
            <div className={`text-sm ${isLight ? 'text-black/70' : 'text-white/70'}`}>Loading...</div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className={`border ${isLight ? 'border-red-200 bg-red-50' : 'border-white/30 bg-white/5'} rounded-lg p-4`}>
            <div className={`text-sm font-bold mb-2 ${isLight ? 'text-red-700' : 'text-white'}`}>Error</div>
            <div className={`text-sm font-mono ${isLight ? 'text-red-600' : 'text-white/70'}`}>{error}</div>
          </div>
        )}

        {/* Content Display */}
        {content && !loading && !error && (
          <div className={`border ${isLight ? 'border-black/20' : 'border-white/20'} rounded-lg overflow-hidden`}>
            <div className={`border-b ${isLight ? 'border-black/10 bg-gray-50' : 'border-white/10'} p-4 flex items-center justify-between`}>
              <div>
                <div className={`text-sm font-bold uppercase ${isLight ? 'text-black' : 'text-white'}`}>{contentType}</div>
                <div className={`text-xs font-mono mt-1 ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                  {(typeof content === 'string' ? content.length : JSON.stringify(content).length).toLocaleString()} bytes
                </div>
              </div>
              <div className="flex gap-2">
                <CopyButton
                  text={typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                  size="md"
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
                  className={`px-4 py-2 border ${isLight ? 'border-black/20 hover:bg-black/5 text-black' : 'border-white/20 hover:bg-white/5 text-white'} text-xs font-mono uppercase transition-colors rounded`}
                >
                  Download
                </button>
              </div>
            </div>
            <div className="p-0">
              {renderContent()}
            </div>
          </div>
        )}

        {/* Metadata */}
        {content && !loading && !error && (
          <div className={`border ${isLight ? 'border-black/20' : 'border-white/20'} rounded-lg p-6`}>
            <div className={`text-xs font-bold uppercase mb-4 ${isLight ? 'text-black/70' : 'text-white/70'}`}>Metadata</div>
            <div className="grid grid-cols-3 gap-6 text-xs">
              <div>
                <div className={`uppercase mb-2 ${isLight ? 'text-black/50' : 'text-white/50'}`}>Type</div>
                <div className={`font-mono font-semibold ${isLight ? 'text-black' : 'text-white'}`}>{contentType}</div>
              </div>
              <div>
                <div className={`uppercase mb-2 ${isLight ? 'text-black/50' : 'text-white/50'}`}>Format</div>
                <div className={`font-mono font-semibold ${isLight ? 'text-black' : 'text-white'}`}>{typeof content}</div>
              </div>
              <div>
                <div className={`uppercase mb-2 ${isLight ? 'text-black/50' : 'text-white/50'}`}>Size</div>
                <div className={`font-mono font-semibold ${isLight ? 'text-black' : 'text-white'}`}>
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
