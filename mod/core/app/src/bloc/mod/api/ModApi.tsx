'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { CopyButton } from '@/bloc/ui/CopyButton';
import { useUserContext } from '@/bloc/context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  CodeBracketIcon,
  PlayIcon,
  CommandLineIcon,
  XMarkIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

type SchemaField = { value: any; type: string };
type SchemaType = {
  input: Record<string, SchemaField>;
  output: SchemaField;
  code?: string;
  hash?: string;
};
type TabType = 'run' | 'code';

const ui = {
  bg:       '#0a0a0a',
  panel:    '#0f0f0f',
  panelAlt: '#141414',
  border:   '#2a2a2a',
  text:     '#e7e7e7',
  textDim:  '#a8a8a8',
  focus:    '#3a86ff',
  accent:   '#22c55e',
  accentHover: '#16a34a',
  danger:   '#ff3b30',
  success:  '#22c55e',
  purple:   '#a855f7',
  blue:     '#3b82f6',
  orange:   '#f97316',
};

export const ModApi = ({ mod }: { mod: any }) => {
  const { user, client } = useUserContext();

  const schema: Record<string, SchemaType> = mod?.schema || {};

  const filteredSchema = useMemo(() => {
    return Object.entries(schema).reduce((acc, [fn, value]) => {
      if (fn === 'self' || fn === 'cls') return acc;
      const filteredInput = Object.entries(value?.input || {}).reduce((ia, [k, v]) => {
        if (k !== 'self' && k !== 'cls') (ia as any)[k] = v;
        return ia;
      }, {} as Record<string, SchemaField>);
      (acc as any)[fn] = { ...value, input: filteredInput };
      return acc;
    }, {} as Record<string, SchemaType>);
  }, [schema]);

  const functionNames = useMemo(() => Object.keys(filteredSchema), [filteredSchema]);

  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [params, setParams] = useState<Record<string, any>>({});
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('run');
  const [paramColumns, setParamColumns] = useState<number>(3);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [wait, setWait] = useState<boolean>(true);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [timeout, setTimeout] = useState<number>(30000);
  const [cancelFn, setCancelFn] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!selectedFunction && functionNames.length > 0) {
      const first = functionNames[0];
      setSelectedFunction(first);
      const d: Record<string, any> = {};
      const inp = filteredSchema[first]?.input || {};
      Object.entries(inp).forEach(([p, det]) => {
        if (det.value !== '_empty' && det.value !== undefined) d[p] = det.value;
      });
      setParams(d);
    }
  }, [selectedFunction, functionNames, filteredSchema]);

  const searchedFunctions = useMemo(() => {
    if (!searchTerm) return functionNames;
    const q = searchTerm.toLowerCase();
    return functionNames.filter((fn) => fn.toLowerCase().includes(q));
  }, [functionNames, searchTerm]);

  const handleParamChange = (p: string, v: string) =>
    setParams((prev) => ({ ...prev, [p]: v }));

  const initializeParams = useCallback((fn: string) => {
    const s = filteredSchema[fn];
    const d: Record<string, any> = {};
    Object.entries(s?.input || {}).forEach(([p, det]) => {
      if (det.value !== '_empty' && det.value !== undefined) d[p] = det.value;
    });
    setParams(d);
  }, [filteredSchema]);

  const executeFunction = async () => {
    if (!selectedFunction) return;
    setError('');
    setResponse(null);
    setLoading(true);

    let abortFn: (() => void) | undefined;
    
    try {
      if (!client) {
        setError('Client not initialized');
        setLoading(false);
        return;
      }
      const res = await client.call('call', {
        fn: mod.name + '/' + selectedFunction,
        params: params,
        wait: wait
      }, 0, {}, timeout, () => {
        abortFn && abortFn();
      });
      setCancelFn(() => abortFn || null);
      setResponse(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to execute function');
    } finally {
      setLoading(false);
      setCancelFn(null);
    }
  };

  const cancelRequest = () => {
    if (cancelFn) {
      cancelFn();
      setLoading(false);
      setError('Request cancelled');
    }
  };
  const responseColor = error ? ui.danger : ui.success;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {selectedFunction ? (
        <div className="flex h-full flex-col" style={{ backgroundColor: ui.bg }}>
          <div className="border-b px-5 py-4" style={{ borderColor: ui.border, backgroundColor: ui.panel }}>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between rounded-lg px-4 py-3 text-base font-semibold transition-all"
                  style={{
                    backgroundColor: ui.accent,
                    color: '#000',
                    border: `2px solid ${ui.accent}`,
                  }}
                >
                  <span className="flex items-center gap-2">
                    <PlayIcon className="h-5 w-5" />
                    {selectedFunction}
                  </span>
                  <ChevronDownIcon className={`h-5 w-5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {dropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border overflow-hidden z-50" style={{ backgroundColor: ui.panel, borderColor: ui.border, maxHeight: '300px', overflowY: 'auto' }}>
                    <div className="sticky top-0 p-2" style={{ backgroundColor: ui.panel, borderBottom: `1px solid ${ui.border}` }}>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search functions..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                          style={{
                            backgroundColor: ui.panelAlt,
                            color: ui.text,
                            border: `1px solid ${ui.border}`,
                            transition: 'border-color 150ms ease',
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = ui.focus}
                          onBlur={(e) => e.currentTarget.style.borderColor = ui.border}
                        />
                        <MagnifyingGlassIcon
                          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                          style={{ color: ui.textDim }}
                        />
                      </div>
                    </div>
                    {searchedFunctions.map((fn) => (
                      <button
                        key={fn}
                        onClick={() => {
                          setSelectedFunction(fn);
                          initializeParams(fn);
                          setResponse(null);
                          setError('');
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors"
                        style={{ color: selectedFunction === fn ? ui.accent : ui.text }}
                      >
                        {fn}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={executeFunction}
                className="rounded-lg px-6 py-3 text-base font-semibold transition-all hover:scale-105"
                style={{
                  backgroundColor: ui.blue,
                  color: '#fff',
                  border: `2px solid ${ui.blue}`,
                }}
              >
                Execute
              </button>

              {filteredSchema[selectedFunction]?.code && (
                <button
                  onClick={() => setActiveTab('code')}
                  className="rounded-lg px-6 py-3 text-base font-semibold transition-all"
                  style={{
                    backgroundColor: activeTab === 'code' ? ui.purple : 'transparent',
                    color: activeTab === 'code' ? '#fff' : ui.text,
                    border: `2px solid ${activeTab === 'code' ? ui.purple : ui.border}`,
                  }}
                >
                  <span className="flex items-center gap-2">
                    <CodeBracketIcon className="h-5 w-5" />
                    Code
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto flex flex-col">
            <AnimatePresence mode="wait">
              {activeTab === 'run' ? (
                <motion.div
                  key="run"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col"
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="text-sm font-semibold" style={{ color: ui.accent }}>Layout:</label>
                      <div className="relative">
                        <select
                          value={paramColumns}
                          onChange={(e) => setParamColumns(Number(e.target.value))}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all appearance-none pr-8"
                          style={{
                            backgroundColor: ui.panelAlt,
                            color: ui.text,
                            border: `1px solid ${ui.border}`,
                          }}
                        >
                          <option value={1}>1 col</option>
                          <option value={2}>2 col</option>
                          <option value={3}>3 col</option>
                          <option value={4}>4 col</option>
                        </select>
                        <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: ui.textDim }} />
                      </div>
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="rounded-lg px-4 py-1.5 text-sm font-medium transition-all"
                        style={{
                          backgroundColor: showAdvanced ? ui.purple : ui.panelAlt,
                          color: showAdvanced ? '#fff' : ui.text,
                          border: `1px solid ${showAdvanced ? ui.purple : ui.border}`,
                        }}
                      >
                        {showAdvanced ? '📝 Multiline' : '📄 Single'}
                      </button>
                      <button
                        onClick={() => setWait(!wait)}
                        className="rounded-lg px-4 py-1.5 text-sm font-medium transition-all"
                        style={{
                          backgroundColor: wait ? ui.accent : ui.orange,
                          color: '#fff',
                          border: `1px solid ${wait ? ui.accent : ui.orange}`,
                        }}
                      >
                        {wait ? '⏳ Wait' : '🚀 Async'}
                      </button>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold" style={{ color: ui.accent }}>Timeout:</label>
                        <input
                          type="number"
                          value={timeout / 1000}
                          onChange={(e) => setTimeout(Number(e.target.value) * 1000)}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all w-20"
                          style={{
                            backgroundColor: ui.panelAlt,
                            color: ui.text,
                            border: `1px solid ${ui.border}`,
                          }}
                          min="1"
                          max="300"
                        />
                        <span className="text-xs" style={{ color: ui.textDim }}>sec</span>
                      </div>
                    </div>
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns: `repeat(${paramColumns}, minmax(0, 1fr))`,
                      }}
                    >
                      {Object.entries(filteredSchema[selectedFunction]?.input || {}).map(([p, d]) => (
                        <div key={p} className="space-y-1.5">
                          <label className="text-sm font-semibold flex items-center gap-2" style={{ color: ui.text }}>
                            <span style={{ color: ui.accent }}>●</span>
                            {p}
                            <span className="text-xs font-normal" style={{ color: ui.textDim }}>{d.type}</span>
                          </label>
                          {showAdvanced ? (
                            <textarea
                              value={params[p] ?? ''}
                              onChange={(e) => handleParamChange(p, e.target.value)}
                              placeholder={d.value ? String(d.value) : 'Enter value...'}
                              rows={3}
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono resize-none"
                              style={{
                                backgroundColor: ui.panelAlt,
                                color: ui.text,
                                border: `1px solid ${ui.border}`,
                                transition: 'border-color 150ms ease',
                              }}
                              onFocus={(e) => e.currentTarget.style.borderColor = ui.focus}
                              onBlur={(e) => e.currentTarget.style.borderColor = ui.border}
                              onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') executeFunction();
                              }}
                            />
                          ) : (
                            <input
                              type="text"
                              value={params[p] ?? ''}
                              onChange={(e) => handleParamChange(p, e.target.value)}
                              placeholder={d.value ? String(d.value) : 'Enter value...'}
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                              style={{
                                backgroundColor: ui.panelAlt,
                                color: ui.text,
                                border: `1px solid ${ui.border}`,
                                transition: 'border-color 150ms ease',
                              }}
                              onFocus={(e) => e.currentTarget.style.borderColor = ui.focus}
                              onBlur={(e) => e.currentTarget.style.borderColor = ui.border}
                              onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') executeFunction();
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {(response || error) && (
                    <div className="border-t p-5 space-y-3" style={{ borderColor: ui.border, backgroundColor: ui.panel }}>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold" style={{ color: responseColor }}>
                          {error ? '❌ Error' : '✅ Response'}
                        </span>
                        <CopyButton content={JSON.stringify(response || error, null, 2)} />
                      </div>
                      <pre
                        className="micro-scroll-y overflow-auto rounded-lg p-4 text-sm max-h-80"
                        style={{
                          backgroundColor: ui.panelAlt,
                          color: responseColor,
                          border: `2px solid ${responseColor}`,
                        }}
                      >
{JSON.stringify(response || error, null, 2)}
                      </pre>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="code"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full p-5"
                >
                  <div
                    className="micro-scroll-y h-full overflow-auto rounded-lg"
                    style={{ backgroundColor: ui.panelAlt, border: `1px solid ${ui.border}` }}
                  >
                    <div
                      className="flex items-center justify-between border-b px-4 py-3"
                      style={{ borderColor: ui.border, backgroundColor: ui.panel }}
                    >
                      <span className="text-sm font-semibold" style={{ color: ui.accent }}>
                        📄 Source Code
                      </span>
                      <CopyButton content={filteredSchema[selectedFunction]?.code || ''} />
                    </div>
                    <pre className="p-4 text-sm" style={{ color: ui.text }}>
{filteredSchema[selectedFunction]?.code || 'No code available'}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div
          className="flex h-full items-center justify-center"
          style={{ color: ui.textDim, backgroundColor: ui.bg }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <CommandLineIcon className="h-12 w-12 opacity-40" />
            <span className="text-base">Select a function to begin</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .micro-scroll-y {
          scrollbar-width: thin;
          scrollbar-color: rgba(34,197,94,0.3) transparent;
        }
        .micro-scroll-y::-webkit-scrollbar {
          width: 8px;
          background: transparent;
        }
        .micro-scroll-y::-webkit-scrollbar-thumb {
          background: rgba(34,197,94,0.3);
          border-radius: 9999px;
        }
        .micro-scroll-y::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
};

export default ModApi;
