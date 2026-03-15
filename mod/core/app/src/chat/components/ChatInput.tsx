"use client";

import type { FunctionSchema } from '../types'

interface ChatInputProps {
  input: string
  setInput: (v: string) => void
  isLoading: boolean
  inputMode: 'chat' | 'params'
  setInputMode: (mode: 'chat' | 'params') => void
  selectedParam: string
  setSelectedParam: (p: string) => void
  selectedFunction: string
  combinedSchema: Record<string, FunctionSchema> | null
  params: Record<string, any>
  setParams: (p: Record<string, any>) => void
  onSubmit: () => void
  onCancel: () => void
}

export function ChatInput({
  input,
  setInput,
  isLoading,
  inputMode,
  setInputMode,
  selectedParam,
  setSelectedParam,
  selectedFunction,
  combinedSchema,
  params,
  setParams,
  onSubmit,
  onCancel,
}: ChatInputProps) {
  const fnSchema = combinedSchema?.[selectedFunction]
  const inputFields = fnSchema?.input || {}
  const paramCount = Object.keys(inputFields).length

  return (
    <div className="flex-shrink-0 border-t-4 relative overflow-hidden" style={{
      borderColor: 'var(--border-strong)',
      backgroundColor: 'var(--bg-secondary)',
    }}>
      <div className="max-w-4xl mx-auto">
        {/* Function Controls */}
        {combinedSchema && Object.keys(combinedSchema).length > 0 && (
          <div className="px-6 pt-4 pb-2 flex items-center gap-3 border-b-2" style={{ borderColor: 'var(--border-color)' }}>
            {/* Function Selector */}
            <select
              value={selectedFunction}
              onChange={(e) => {/* handled by parent */}}
              className="flex-1 max-w-md px-4 py-2 border-2 text-sm font-digital focus:outline-none transition-all uppercase"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Select Function</option>
              {Object.keys(combinedSchema).map(fn => (
                <option key={fn} value={fn}>{fn}</option>
              ))}
            </select>

            {/* Mode Controls */}
            {selectedFunction && fnSchema && (
              <>
                <div className="flex items-center gap-1.5">
                  {(['chat', 'params'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setInputMode(mode)}
                      className="px-3 py-1.5 text-xs font-digital font-bold transition-all border-2 uppercase"
                      style={{
                        backgroundColor: inputMode === mode ? 'var(--accent-primary)' : 'var(--bg-input)',
                        color: inputMode === mode ? 'var(--bg-primary)' : 'var(--text-secondary)',
                        borderColor: inputMode === mode ? 'var(--accent-primary)' : 'var(--border-color)',
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Chat Mode - Parameter Selector */}
                {inputMode === 'chat' && (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-digital uppercase" style={{ color: 'var(--text-tertiary)' }}>Param:</span>
                    <select
                      value={selectedParam}
                      onChange={(e) => setSelectedParam(e.target.value)}
                      className="px-3 py-1.5 text-sm font-digital border-2"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {paramCount === 0 ? (
                        <option value="">(_empty)</option>
                      ) : (
                        Object.entries(inputFields).map(([name, param]: [string, any]) => (
                          <option key={name} value={name}>
                            {name} ({param.type || 'any'})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div className="text-xs font-digital" style={{ color: 'var(--text-tertiary)' }}>
                  {paramCount} params
                </div>
              </>
            )}
          </div>
        )}

        {/* Main Input */}
        <div className="p-6">
          {inputMode === 'chat' ? (
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      onSubmit()
                    }
                  }}
                  placeholder={`> ${selectedParam || 'message'}_`}
                  rows={3}
                  disabled={isLoading}
                  className="relative w-full border-4 px-4 py-3 focus:outline-none resize-none text-base transition-all font-digital"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-digital), "JetBrains Mono", monospace',
                    letterSpacing: '0.02em',
                  }}
                />
              </div>
              <ActionButton
                isLoading={isLoading}
                disabled={!input.trim()}
                onSubmit={onSubmit}
                onCancel={onCancel}
              />
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {selectedFunction && fnSchema &&
                  Object.entries(inputFields).map(([paramName, paramSchema]: [string, any]) => (
                    <div key={paramName} className="space-y-1">
                      <label className="flex items-center gap-2 text-xs font-digital" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-bold uppercase">{paramName}</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>({paramSchema.type || 'any'})</span>
                      </label>
                      <input
                        type="text"
                        value={params[paramName] !== undefined ? params[paramName] : (paramSchema.value || '')}
                        onChange={(e) => setParams({ ...params, [paramName]: e.target.value })}
                        placeholder={`${paramName}...`}
                        className="w-full px-3 py-2 text-sm font-digital border-2 focus:outline-none transition-all"
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          borderColor: 'var(--border-input)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                  ))
                }
              </div>
              <div className="flex justify-end">
                <ActionButton
                  isLoading={isLoading}
                  disabled={false}
                  onSubmit={onSubmit}
                  onCancel={onCancel}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionButton({ isLoading, disabled, onSubmit, onCancel }: {
  isLoading: boolean
  disabled: boolean
  onSubmit: () => void
  onCancel: () => void
}) {
  if (isLoading) {
    return (
      <button
        onClick={onCancel}
        className="px-6 py-4 transition-all text-xs font-bold border-4 flex items-center gap-3 flex-shrink-0 font-digital uppercase tracking-widest active:translate-x-[2px] active:translate-y-[2px]"
        style={{
          backgroundColor: 'var(--accent-error, #ff4444)',
          color: '#ffffff',
          borderColor: 'var(--accent-error, #ff4444)',
          boxShadow: '4px 4px 0px 0px var(--border-strong)',
        }}
      >
        <span className="w-2 h-2 bg-white animate-pulse"></span>
        STOP
      </button>
    )
  }

  return (
    <button
      onClick={onSubmit}
      disabled={disabled}
      className="px-6 py-4 transition-all text-xs font-bold border-4 flex items-center gap-3 flex-shrink-0 font-digital uppercase tracking-widest active:translate-x-[2px] active:translate-y-[2px]"
      style={{
        backgroundColor: disabled ? 'var(--bg-input)' : 'var(--accent-primary)',
        color: disabled ? 'var(--text-tertiary)' : 'var(--bg-primary)',
        borderColor: disabled ? 'var(--border-color)' : 'var(--accent-primary)',
        boxShadow: disabled ? 'none' : '4px 4px 0px 0px var(--border-strong)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span className="text-lg">&#9654;</span>
      SEND
    </button>
  )
}
