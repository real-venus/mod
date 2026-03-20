'use client'

interface Props {
  value: string
  onChange: (val: string) => void
  balance?: string
  token: string
  onMax?: () => void
}

export function AmountInput({ value, onChange, balance, token, onMax }: Props) {
  return (
    <div className="bg-modfi-bg border border-modfi-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-modfi-muted">Amount</span>
        {balance && (
          <span className="text-xs text-modfi-muted">
            Balance: <span className="font-mono text-modfi-text">{balance}</span> {token}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={e => {
            const v = e.target.value
            if (/^\d*\.?\d*$/.test(v)) onChange(v)
          }}
          placeholder="0.0"
          className="flex-1 bg-transparent text-xl font-mono text-white outline-none placeholder-modfi-muted/50"
        />
        <div className="flex items-center gap-2">
          {onMax && (
            <button
              onClick={onMax}
              className="text-xs text-modfi-purple hover:text-modfi-violet transition-colors font-medium"
            >
              MAX
            </button>
          )}
          <span className="text-sm font-medium text-modfi-text bg-modfi-border/50 px-2 py-1 rounded">
            {token}
          </span>
        </div>
      </div>
    </div>
  )
}
