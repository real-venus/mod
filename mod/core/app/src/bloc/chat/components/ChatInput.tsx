'use client'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  selectedInputParam: string
  setSelectedInputParam: (value: string) => void
  wait: boolean
  setWait: (value: boolean) => void
  isLoading: boolean
  selectedModule: string
  selectedFunction: string
  inputParamOptions: string[]
  handleSubmit: (e: React.FormEvent) => void
  onCancel?: () => void
}

export function ChatInput({
  input, setInput, selectedInputParam, setSelectedInputParam,
  wait, setWait, isLoading, selectedModule, selectedFunction,
  inputParamOptions, handleSubmit, onCancel
}: ChatInputProps) {
  return (
    <div className="border-t-2 border-green-500/30 bg-gradient-to-br from-black/80 to-gray-900/60 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={selectedInputParam ? `Enter ${selectedInputParam}...` : "Type your message or leave empty to use default params..."}
            disabled={isLoading || !selectedModule || !selectedFunction}
            rows={3}
            className="w-full bg-transparent border-2 border-purple-500 text-white px-5 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500 disabled:opacity-50 transition-all shadow-lg resize-none"
            style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <select
              value={selectedInputParam}
              onChange={(e) => setSelectedInputParam(e.target.value)}
              disabled={inputParamOptions.length === 0}
              className="bg-gray-900/90 border-2 border-gray-700/60 text-white px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-green-500/60 disabled:opacity-50 transition-all shadow-lg text-sm"
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            >
              {inputParamOptions.length === 0 ? (
                <option value="">No params</option>
              ) : (
                inputParamOptions.map(param => (
                  <option key={param} value={param}>{param}</option>
                ))
              )}
            </select>
            <button
              onClick={() => setWait(!wait)}
              type="button"
              className={`px-4 py-2 rounded-xl font-semibold text-xs transition-all whitespace-nowrap ${
                wait
                  ? 'bg-green-500/20 text-green-400 border-2 border-green-500/40'
                  : 'bg-orange-500/20 text-orange-400 border-2 border-orange-500/40'
              }`}
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            >
              {wait ? '⏳' : '🚀'}
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedModule || !selectedFunction}
              className="px-6 py-2 bg-gradient-to-r from-green-500/30 to-green-600/20 text-green-400 border-2 border-green-500/40 hover:from-green-500/40 hover:to-green-600/30 hover:border-green-500/60 rounded-xl transition-all duration-200 font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl text-sm"
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
            {isLoading && onCancel && (
              <button
                onClick={onCancel}
                type="button"
                className="px-4 py-2 bg-gradient-to-r from-red-500/30 to-red-600/20 text-red-400 border-2 border-red-500/40 hover:from-red-500/40 hover:to-red-600/30 hover:border-red-500/60 rounded-xl transition-all duration-200 font-bold shadow-xl text-sm"
                style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
