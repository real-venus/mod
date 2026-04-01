"use client"

const TERM_FONT = "var(--font-digital), 'JetBrains Mono', 'Courier New', monospace"

export function TerminalCard({ children, className = '', label = '' }: {
  children: React.ReactNode; className?: string; label?: string
}) {
  return (
    <div className={`relative ${className}`}>
      {label && (
        <div className="flex items-center gap-2 mb-1 px-1">
          <span style={{ color: 'var(--accent-primary, #10b981)', opacity: 0.5, fontFamily: TERM_FONT, fontSize: '11px' }}>{'///'}</span>
          <span style={{
            fontFamily: TERM_FONT,
            fontSize: '13px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--accent-primary, #10b981)',
            opacity: 0.6,
          }}>{label}</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
        </div>
      )}
      <div
        style={{
          fontFamily: TERM_FONT,
          fontSize: '14px',
          padding: '16px 20px',
          border: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          boxShadow: '3px 3px 0px 0px rgba(255,255,255,0.06)',
          imageRendering: 'pixelated' as any,
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Keep backwards compat export
export function GlowCard({ children, color: _color, delay: _delay = 0, className = '' }: {
  children: React.ReactNode; color: string; delay?: number; className?: string
}) {
  return <TerminalCard className={className}>{children}</TerminalCard>
}
