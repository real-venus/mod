/**
 * Dynamic Navigation System
 *
 * This module provides utilities for dynamically adding modules to the sidebar
 * based on their existence in the filesystem or module registry.
 */

import { NAV_ITEMS, NavItem, hasDirectRoute } from './navigation'

/**
 * Known modules from the orbit ecosystem that can be added to navigation
 * Update this list as you add modules you want in the sidebar
 */
export const ORBIT_MODULES = [
  'agent',
  'ipfs',
  'cache',
  'skill',
  'bridge',
  'web',
  'filecoin',
  'claude',
  'dev',
  'ctx',
  'model',
  // Add more modules from ~/mod/orbit/ as needed
]

/**
 * Color generator for new modules
 * Returns a color based on the module name for consistency
 */
export function getModuleColor(moduleName: string): string {
  const colors = [
    '#10b981', // emerald
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#f97316', // orange
    '#a855f7', // purple
    '#14b8a6', // teal
    '#6366f1', // indigo
  ]

  // Use character codes to pick a consistent color
  let hash = 0
  for (let i = 0; i < moduleName.length; i++) {
    hash = moduleName.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

/**
 * Create a navigation item for a module
 */
export function createModuleNavItem(
  moduleName: string,
  label?: string,
  color?: string
): NavItem {
  return {
    href: `/${moduleName}`,
    label: label || moduleName.toUpperCase(),
    color: color || getModuleColor(moduleName),
    type: 'module',
    moduleName,
  }
}

/**
 * Get all navigation items including dynamically added modules
 */
export function getAllNavItems(additionalModules?: string[]): NavItem[] {
  const baseItems = [...NAV_ITEMS]
  const modulesToAdd = additionalModules || []

  // Add modules that aren't already in navigation
  const existingHrefs = new Set(baseItems.map(item => item.href))

  for (const moduleName of modulesToAdd) {
    const href = `/${moduleName}`
    if (!existingHrefs.has(href)) {
      baseItems.push(createModuleNavItem(moduleName))
    }
  }

  return baseItems
}

/**
 * Example usage:
 *
 * To add new modules to the sidebar, you can:
 *
 * 1. Add to navigation.ts NAV_ITEMS array (recommended for permanent additions)
 * 2. Use getAllNavItems(['agent', 'ipfs']) in your component
 * 3. Dynamically fetch from a config file or API
 */
