"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CubeIcon,
  ChatBubbleLeftRightIcon,
  TrophyIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}

const navItems: NavItem[] = [
  {
    href: '/mod/explore',
    label: 'Modules',
    icon: CubeIcon,
    color: '#10b981',
  },
  {
    href: '/quests',
    label: 'Quests',
    icon: TrophyIcon,
    color: '#0bf58c',
  },
  {
    href: '/chat',
    label: 'Chat',
    icon: ChatBubbleLeftRightIcon,
    color: '#8b5cf6',
  },
  {
    href: '/docs',
    label: 'Docs',
    icon: DocumentTextIcon,
    color: '#a78bfa',
  },
];

export default function Header() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pathname = usePathname();

  return (
    <div className="flex flex-col items-center gap-1.5">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const isHovered = hoveredIndex === index;
        const isActive = pathname?.startsWith(item.href);

        return (
          <div
            key={item.href}
            className="relative"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <Link href={item.href}>
              <div
                className="flex items-center justify-center transition-all duration-200 cursor-pointer"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: isActive
                    ? `${item.color}18`
                    : isHovered
                      ? `${item.color}10`
                      : 'transparent',
                  border: `1px solid ${isActive ? `${item.color}35` : isHovered ? `${item.color}20` : 'transparent'}`,
                  transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                <Icon
                  className="w-5 h-5"
                  style={{
                    color: isActive ? item.color : isHovered ? item.color : `${item.color}60`,
                    filter: isActive ? `drop-shadow(0 0 4px ${item.color}80)` : 'none',
                    transition: 'all 0.2s ease',
                  }}
                />
              </div>
            </Link>

            {/* Active indicator dot */}
            {isActive && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-[3px] h-4 rounded-full"
                style={{
                  background: item.color,
                  boxShadow: `0 0 6px ${item.color}80`,
                }}
              />
            )}

            {/* Simple label tooltip */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1.5 z-50 whitespace-nowrap pointer-events-none"
                  style={{
                    background: 'rgba(10, 10, 10, 0.95)',
                    border: `1px solid ${item.color}30`,
                    borderRadius: '6px',
                    backdropFilter: 'blur(12px)',
                    boxShadow: `0 4px 16px rgba(0,0,0,0.5)`,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                >
                  <span
                    className="text-[12px] font-bold uppercase tracking-wider"
                    style={{ color: item.color }}
                  >
                    {item.label}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
