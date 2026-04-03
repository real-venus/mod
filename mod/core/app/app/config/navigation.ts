/**
 * Navigation configuration for the sidebar
 *
 * Each nav item can be:
 * - type: 'direct' - Direct route to a page in src/app/{route}/page.tsx
 * - type: 'module' - Dynamic module route that checks if page exists, otherwise redirects to module page
 */

import sidebarConfig from './sidebar.json'

export interface NavItem {
  href: string
  label: string
  color: string
  type: 'direct' | 'module'
  moduleName?: string // For type: 'module', specify the module name (defaults to href without leading /)
}

/**
 * Load navigation items from sidebar.json
 * You can edit sidebar.json to add new navigation items without touching this file
 */
export const NAV_ITEMS: NavItem[] = sidebarConfig.navigation as NavItem[]

/**
 * Additional modules to add to sidebar (from sidebar.json)
 * These will be added as 'module' type navigation items
 */
export const ADDITIONAL_MODULES: string[] = sidebarConfig.additionalModules || []

/**
 * Available routes in src/app/ directory
 * Loaded from sidebar.json - update that file when adding new pages
 */
export const AVAILABLE_ROUTES: string[] = sidebarConfig.availableRoutes || []

/**
 * Check if a route has a corresponding page in src/app/
 */
export function hasDirectRoute(route: string): boolean {
  const cleanRoute = route.startsWith('/') ? route.slice(1) : route
  const firstSegment = cleanRoute.split('/')[0]
  return AVAILABLE_ROUTES.includes(firstSegment)
}

/**
 * Get the final href for a nav item
 * - For direct routes, returns the href as-is
 * - For module routes, checks if page exists, otherwise returns module page URL
 */
export function getNavHref(item: NavItem, userAddress?: string): string {
  if (item.type === 'direct') {
    return item.href
  }

  // For module type, check if direct route exists
  if (hasDirectRoute(item.href)) {
    return item.href
  }

  // Otherwise, go to module page
  const moduleName = item.moduleName || item.href.replace(/^\//, '')

  return `/${moduleName}`
}

/**
 * Get all navigation items including additional modules from config
 * and optionally from running module app servers (auto-discovery).
 */
export function getAllNavItems(moduleApps?: Record<string, unknown>): NavItem[] {
  const items = [...NAV_ITEMS]

  const existingHrefs = new Set(items.map(item => item.href))

  // Add additional modules from config
  for (const moduleName of ADDITIONAL_MODULES) {
    const href = `/${moduleName}`
    if (!existingHrefs.has(href)) {
      items.push({
        href,
        label: moduleName.toUpperCase(),
        color: getModuleColor(moduleName),
        type: 'module',
        moduleName,
      })
      existingHrefs.add(href)
    }
  }

  // Auto-add running module app servers
  if (moduleApps) {
    for (const moduleName of Object.keys(moduleApps)) {
      const href = `/${moduleName}`
      if (!existingHrefs.has(href)) {
        items.push({
          href,
          label: moduleName.toUpperCase(),
          color: getModuleColor(moduleName),
          type: 'module',
          moduleName,
        })
        existingHrefs.add(href)
      }
    }
  }

  return items
}

/**
 * Color generator for modules
 */
function getModuleColor(moduleName: string): string {
  const colors = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4',
    '#ec4899', '#84cc16', '#f97316', '#a855f7', '#14b8a6', '#6366f1',
  ]

  let hash = 0
  for (let i = 0; i < moduleName.length; i++) {
    hash = moduleName.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}
