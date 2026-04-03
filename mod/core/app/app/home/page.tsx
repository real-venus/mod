"use client"

import { motion } from 'framer-motion'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const ORBS = [
  { size: 300, color: 'rgba(167, 139, 250, 0.15)', x: '15%', y: '20%', delay: 0 },
  { size: 200, color: 'rgba(103, 232, 249, 0.12)', x: '75%', y: '60%', delay: 5 },
  { size: 250, color: 'rgba(52, 211, 153, 0.08)', x: '60%', y: '15%', delay: 10 },
  { size: 180, color: 'rgba(251, 191, 36, 0.06)', x: '25%', y: '75%', delay: 3 },
  { size: 150, color: 'rgba(167, 139, 250, 0.08)', x: '85%', y: '25%', delay: 7 },
]

const FEATURES = [
  { title: 'PUBLISH', desc: 'Deploy modules on-chain. Immutable, permissionless, zero middlemen.' },
  { title: 'VERIFY', desc: 'Cryptographically signed. Tamper-proof. Code is law.' },
  { title: 'INSTALL', desc: 'Users verify and install trustlessly. Decentralized distribution.' },
]

const STATS = [
  { label: 'ON-CHAIN', value: 'MODULES' },
  { label: 'VERIFIED', value: 'CRYPTO' },
  { label: 'ZERO', value: 'MIDDLEMEN' },
]

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Floating Orbs Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {ORBS.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: orb.size,
              height: orb.size,
              background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
              left: orb.x,
              top: orb.y,
              filter: 'blur(40px)',
            }}
            animate={{
              x: [0, 30, -20, 0],
              y: [0, -25, 15, 0],
              scale: [1, 1.1, 0.95, 1],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              delay: orb.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Subtle dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }} />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="mb-6 text-center"
        >
          <h1 className="text-8xl font-bold tracking-wider" style={{
            color: 'var(--text-primary)',
            textShadow: '0 0 60px rgba(167, 139, 250, 0.2), 0 0 120px rgba(103, 232, 249, 0.08)',
            fontFamily: "var(--font-orbitron), var(--font-digital), monospace",
          }}>
            MODCHAIN
          </h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-lg mt-4 tracking-[0.3em]"
            style={{ color: 'var(--text-secondary)', fontWeight: 400 }}
          >
            DECENTRALIZED MODULE REGISTRY
          </motion.div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex gap-8 mb-12"
        >
          {STATS.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-xs tracking-[0.2em]" style={{ color: 'var(--text-tertiary)' }}>{stat.label}</div>
              <div className="text-sm font-semibold mt-1" style={{ color: 'var(--accent-primary, #a78bfa)' }}>{stat.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Feature cards - glass panel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-12 max-w-3xl w-full"
          style={{
            background: 'rgba(15, 20, 40, 0.4)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '44px',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.15 }}
              >
                <h3 className="text-sm font-semibold tracking-[0.2em] mb-3" style={{ color: 'var(--accent-primary, #a78bfa)' }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', fontFamily: "var(--font-digital), monospace" }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="flex gap-5"
        >
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/chat"
              className="px-8 py-4 font-semibold transition-all rounded-xl inline-block"
              style={{
                background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(103, 232, 249, 0.1))',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                color: 'var(--text-primary)',
                boxShadow: '0 4px 20px rgba(167, 139, 250, 0.15)',
                fontFamily: "var(--font-digital), monospace",
              }}
            >
              ENTER APP
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/user/explore"
              className="px-8 py-4 font-semibold transition-all rounded-xl inline-block"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-primary)',
                fontFamily: "var(--font-digital), monospace",
              }}
            >
              EXPLORE NETWORK
            </Link>
          </motion.div>
        </motion.div>

        {/* Subtle bottom accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.2, duration: 1, ease: [0.4, 0, 0.2, 1] }}
          className="mt-16 h-px w-48"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(167, 139, 250, 0.3), rgba(103, 232, 249, 0.2), transparent)',
          }}
        />
      </div>
    </div>
  )
}
