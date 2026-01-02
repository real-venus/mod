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
    <div className="border-t-2 border-orange-500/30 bg-gradient-to-br from-black/80 to-gray-900/60 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <div className="absolute top-3 right-3 z-10">
            <select
              value={selectedInputParam}
              onChange={(e) => setSelectedInputParam(e.target.value)}
              disabled={inputParamOptions.length === 0}
              className="bg-orange-500/20 border-2 border-orange-500/40 text-white px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/60 disabled:opacity-50 transition-all text-sm font-bold"
              style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
            >
              {inputParamOptions.length === 0 ? (
                <option value="">no params</option>
              ) : (
                inputParamOptions.map(param => (
                  <option key={param} value={param}>{param}</option>
                ))
              )}
            </select>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={selectedInputParam ? `Enter ${selectedInputParam}...` : "Type your message or leave empty to use default params..."}
            disabled={isLoading || !selectedModule || !selectedFunction}
            rows={3}
            className="w-full bg-transparent border-2 border-orange-500 text-white px-5 py-3.5 pr-32 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500 disabled:opacity-50 transition-all shadow-lg resize-none text-lg"
            style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace', fontSize: '1.125rem' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setWait(!wait)}
            type="button"
            className={`flex-1 px-6 py-4 rounded-xl font-semibold text-base transition-all ${
              wait
                ? 'bg-green-500/20 text-green-400 border-2 border-green-500/40'
                : 'bg-orange-500/20 text-orange-400 border-2 border-orange-500/40'
            }`}
            style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
          >
            {wait ? '⏳ AWAIT MODE' : '🚀 SEND MODE'}
          </button>
          <button
            type="submit"
            disabled={isLoading || !selectedModule || !selectedFunction}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500/30 to-green-600/20 text-green-400 border-2 border-green-500/40 hover:from-green-500/40 hover:to-green-600/30 hover:border-green-500/60 rounded-xl transition-all duration-200 font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl text-base"
            style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
          >
            {isLoading ? 'SENDING...' : 'SEND'}
          </button>
        </div>
        {isLoading && onCancel && (
          <button
            onClick={onCancel}
            type="button"
            className="w-full px-6 py-4 bg-gradient-to-r from-red-500/30 to-red-600/20 text-red-400 border-2 border-red-500/40 hover:from-red-500/40 hover:to-red-600/30 hover:border-red-500/60 rounded-xl transition-all duration-200 font-bold shadow-xl text-base"
            style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
          >
            ✕ CANCEL
          </button>
        )}
      </form>
    </div>
  )
}
