'use client'

import { useState, useEffect } from 'react'
import { userContext } from '@/mod/context/UserContext'
import { text2color } from '@/mod/utils'
import { motion, AnimatePresence } from 'framer-motion'
import CreateModule from './components/CreateModule'
import EditModuleSelector from './components/EditModuleSelector'
import ForkModuleEnhanced from './components/ForkModuleEnhanced'
import { 
  WrenchScrewdriverIcon, 
  PlusCircleIcon, 
  PencilSquareIcon, 
  DocumentDuplicateIcon,
  CommandLineIcon,
  SparklesIcon,
  CubeIcon
} from '@heroicons/react/24/outline'

type BuidlTab = 'create' | 'edit' | 'fork'

const tabs: { id: BuidlTab; label: string; icon: any; description: string; gradient: string }[] = [
  { id: 'create', label: 'Create', icon: PlusCircleIcon, description: 'Build a new module from scratch', gradient: 'from-emerald-500 to-teal-500' },
  { id: 'edit', label: 'Edit', icon: PencilSquareIcon, description: 'Modify an existing module', gradient: 'from-blue-500 to-indigo-500' },
  { id: 'fork', label: 'Fork', icon: DocumentDuplicateIcon, description: 'Clone and customize a module', gradient: 'from-purple-500 to-pink-500' },
]

export default function BuidlPage() {
  const { user } = userContext()
  const [activeTab, setActiveTab] = useState<BuidlTab>('create')
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const userColor = user?.key ? text2color(user.key) : '#a855f7'

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const activeTabData = tabs.find(t => t.id === activeTab)!

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.03] blur-[120px] transition-all duration-[2000ms]"
          style={{ 
            background: `radial-gradient(circle, ${userColor}, transparent)`,
            left: mousePos.x - 300,
            top: mousePos.y - 300,
          }}
        />
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(${userColor}40 1px, transparent 1px), linear-gradient(90deg, ${userColor}40 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ backgroundColor: userColor, opacity: 0.15 }}
            animate={{
              x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
              y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
            }}
            transition={{
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-10"
        >
          <div className="flex items-center gap-4 mb-3">
            <div 
              className="p-3 rounded-2xl border-2"
              style={{ 
                borderColor: `${userColor}40`,
                backgroundColor: `${userColor}10`,
                boxShadow: `0 0 30px ${userColor}15`
              }}
            >
              <CommandLineIcon className="w-8 h-8" style={{ color: userColor }} />
            </div>
            <div>
              <h1 
                className="text-4xl font-black tracking-tight"
                style={{ 
                  fontFamily: 'IBM Plex Mono, Courier New, monospace',
                  background: `linear-gradient(135deg, ${userColor}, ${userColor}80)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                BUIDL
              </h1>
              <p className="text-gray-500 text-sm font-mono mt-0.5">Create, edit, and fork modules</p>
            </div>
          </div>

          {/* Decorative line */}
          <div className="h-px w-full mt-6" style={{ background: `linear-gradient(90deg, transparent, ${userColor}30, transparent)` }} />
        </motion.div>

        {/* Tab Navigation */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex gap-3 mb-8"
        >
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`relative flex-1 group rounded-2xl border-2 p-5 transition-all duration-300 overflow-hidden`}
                style={{
                  borderColor: isActive ? userColor : 'rgba(255,255,255,0.08)',
                  backgroundColor: isActive ? `${userColor}08` : 'rgba(255,255,255,0.02)',
                  boxShadow: isActive ? `0 0 40px ${userColor}15, inset 0 1px 0 ${userColor}20` : 'none',
                }}
              >
                {/* Active indicator glow */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabGlow"
                    className="absolute inset-0 rounded-2xl"
                    style={{ 
                      background: `radial-gradient(ellipse at center, ${userColor}08, transparent 70%)`,
                    }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}

                <div className="relative z-10 flex items-start gap-4">
                  <div 
                    className={`p-2.5 rounded-xl border transition-all duration-300 ${isActive ? 'border-current' : 'border-white/10 group-hover:border-white/20'}`}
                    style={{ 
                      color: isActive ? userColor : '#6b7280',
                      backgroundColor: isActive ? `${userColor}15` : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <tab.icon className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div 
                      className="font-bold text-base tracking-wide mb-1 transition-colors duration-300"
                      style={{ 
                        color: isActive ? userColor : '#9ca3af',
                        fontFamily: 'IBM Plex Mono, Courier New, monospace'
                      }}
                    >
                      {tab.label}
                    </div>
                    <div className="text-xs text-gray-600 leading-relaxed">
                      {tab.description}
                    </div>
                  </div>
                </div>

                {/* Bottom active bar */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabBar"
                    className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                    style={{ backgroundColor: userColor }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </motion.button>
            )
          })}
        </motion.div>

        {/* Content Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative"
        >
          {/* Content card */}
          <div 
            className="rounded-2xl border-2 overflow-hidden"
            style={{ 
              borderColor: `${userColor}15`,
              backgroundColor: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
              boxShadow: `0 0 60px ${userColor}05`
            }}
          >
            {/* Content header bar */}
            <div 
              className="flex items-center gap-3 px-6 py-4 border-b"
              style={{ borderColor: `${userColor}15` }}
            >
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div 
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg border"
                  style={{ 
                    borderColor: `${userColor}20`,
                    backgroundColor: `${userColor}05`,
                  }}
                >
                  <activeTabData.icon className="w-4 h-4" style={{ color: userColor }} />
                  <span 
                    className="text-xs font-bold tracking-wider uppercase"
                    style={{ color: `${userColor}90`, fontFamily: 'IBM Plex Mono, Courier New, monospace' }}
                  >
                    {activeTabData.label} Module
                  </span>
                </div>
              </div>
              <div className="w-[52px]" /> {/* Spacer for centering */}
            </div>

            {/* Content body */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  {activeTab === 'create' && <CreateModule />}
                  {activeTab === 'edit' && <EditModuleSelector />}
                  {activeTab === 'fork' && <ForkModuleEnhanced />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom status bar */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-between mt-4 px-2"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: userColor }} />
              <span className="text-xs text-gray-600 font-mono">Ready</span>
            </div>
            <div className="flex items-center gap-4">
              {user?.key && (
                <span className="text-xs text-gray-700 font-mono">
                  {user.key.slice(0, 8)}...{user.key.slice(-6)}
                </span>
              )}
              <span className="text-xs text-gray-700 font-mono">
                v1.0.0
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
