"use client"

import { motion } from 'framer-motion'

export function GlowCard({ children, color, delay = 0, className = '' }: {
  children: React.ReactNode; color: string; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className={`relative group ${className}`}
    >
      <div
        className="absolute -inset-[1px] rounded-xl opacity-40 group-hover:opacity-60 blur-sm transition-opacity duration-500"
        style={{ background: `linear-gradient(135deg, ${color}40, transparent 60%)` }}
      />
      <div className="relative rounded-xl p-6 backdrop-blur-xl h-full" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-strong)' }}>
        {children}
      </div>
    </motion.div>
  )
}
