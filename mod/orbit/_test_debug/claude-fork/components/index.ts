/**
 * Unified Interface Components
 *
 * A comprehensive interface system combining API interaction,
 * app preview, and code viewing in a single unified component.
 *
 * Based on mod/core/app architecture.
 */

// Main component
export { default as UnifiedInterface } from './UnifiedInterface'
export type { ModuleData, UnifiedInterfaceProps } from './UnifiedInterface'

// Individual panels (if you need them separately)
export { default as ApiPanel } from './panels/ApiPanel'
export { default as AppPanel } from './panels/AppPanel'
export { default as CodePanel } from './panels/CodePanel'

/**
 * Usage Example:
 *
 * import { UnifiedInterface } from '@/components'
 *
 * <UnifiedInterface
 *   mod={{
 *     name: 'my-module',
 *     key: 'user-key',
 *     schema: { ... },
 *     url_app: 'https://...',
 *     content: { ... }
 *   }}
 *   client={apiClient}
 *   defaultTab="api"
 * />
 */
