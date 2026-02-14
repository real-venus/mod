"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlobeAltIcon,
  CubeIcon,
  BanknotesIcon,
  ChatBubbleLeftRightIcon,
  PlusCircleIcon,
  TrophyIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  color: string;
}

const navItems: NavItem[] = [
  {
    href: '/chat',
    label: 'Chat',
    icon: ChatBubbleLeftRightIcon,
    features: ['AI Conversations', 'Module Testing', 'Function Calls'],
    color: '#8b5cf6', // purple
  },
  {
    href: '/buidl',
    label: 'Build',
    icon: PlusCircleIcon,
    features: ['Create Module', 'Deploy Code', 'Build APIs'],
    color: '#ec4899', // pink
  },
  {
    href: '/mod/explore',
    label: 'Modules',
    icon: CubeIcon,
    features: ['Browse Modules', 'Create & Fork', 'API Registry'],
    color: '#10b981', // green
  },
  // {
  //   href: '/network',
  //   label: 'Network',
  //   icon: GlobeAltIcon,
  //   features: ['Chain Stats', 'Transactions', 'Validators'],
  //   color: '#3b82f6', // blue
  // },
  // {
  //   href: '/treasury',
  //   label: 'Treasury',
  //   icon: BanknotesIcon,
  //   features: ['Deposits', 'Withdrawals', 'Analytics'],
  //   color: '#f59e0b', // amber
  // },
  {
    href: '/quests',
    label: 'Quests',
    icon: TrophyIcon,
    features: ['Quests', 'Challenges', 'Rewards'],
    color: '#0bf58c', // green
  },
  {
    href: '/docs',
    label: 'Docs',
    icon: DocumentTextIcon,
    features: ['What is Mod', 'Architecture', 'Getting Started'],
    color: '#a78bfa', // light purple
  },
];

export default function Header() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center gap-3">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={item.href}
              className="relative"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <Link href={item.href}>
                <motion.div
                  className="flex items-center justify-center rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden backdrop-blur-sm"
                  style={{
                    width: '60px',
                    height: '60px',
                    borderColor: `${item.color}60`,
                    backgroundColor: `${item.color}20`,
                    boxShadow: `0 0 15px ${item.color}40`,
                  }}
                  whileHover={{ scale: 1.05, boxShadow: `0 0 25px ${item.color}60` }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div
                    style={{
                      color: item.color,
                      filter: `drop-shadow(0 0 6px ${item.color})`,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Icon className="w-8 h-8 relative z-10" />
                  </div>
                </motion.div>
              </Link>

              {/* Hover Expansion */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: -10, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -10, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-3 p-5 rounded-xl backdrop-blur-xl z-50 min-w-[220px]"
                    style={{
                      borderWidth: '2px',
                      borderColor: `${item.color}70`,
                      backgroundColor: 'rgba(0, 0, 0, 0.97)',
                      boxShadow: `0 0 40px ${item.color}30, 0 20px 50px rgba(0, 0, 0, 0.9), inset 0 0 30px ${item.color}10`
                    }}
                  >
                    <div className="text-center">
                      <h3
                        className="text-base font-black uppercase tracking-wider mb-4 pb-2 border-b"
                        style={{
                          color: item.color,
                          borderColor: `${item.color}30`,
                          textShadow: `0 0 10px ${item.color}60`
                        }}
                      >
                        {item.label}
                      </h3>
                      <div className="space-y-2">
                        {item.features.map((feature, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="text-xs text-gray-300 font-semibold px-3 py-2 rounded-lg border"
                            style={{
                              backgroundColor: `${item.color}12`,
                              borderColor: `${item.color}30`,
                              boxShadow: `inset 0 0 10px ${item.color}08`
                            }}
                          >
                            {feature}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    {/* Arrow */}
                    <div
                      className="absolute right-full top-1/2 -translate-y-1/2 border-[10px] border-transparent"
                      style={{ borderRightColor: `${item.color}70` }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
    </div>
  );
}
