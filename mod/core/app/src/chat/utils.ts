/**
 * Utility functions for the chat interface
 */

import {
  ADDRESS_DISPLAY_START,
  ADDRESS_DISPLAY_END,
  CID_DISPLAY_START,
  CID_DISPLAY_END,
  EXACT_MATCH_DISTANCE,
  STARTS_WITH_MATCH_DISTANCE,
  REVERSE_STARTS_WITH_DISTANCE,
  CONTAINS_MATCH_DISTANCE,
  REVERSE_CONTAINS_DISTANCE,
  SUCCESS_STATUSES,
  ERROR_STATUSES,
  PENDING_STATUSES
} from './constants'
import type { Transaction, Module, SchemaInputParam } from './types'

/**
 * Formats an address or hash for display
 * @param address - The full address/hash
 * @param startChars - Number of characters to show at start (default: 8)
 * @param endChars - Number of characters to show at end (default: 6)
 * @returns Formatted address like "0x1234...5678"
 */
export function formatAddress(
  address: string,
  startChars: number = ADDRESS_DISPLAY_START,
  endChars: number = ADDRESS_DISPLAY_END
): string {
  if (!address || address.length <= startChars + endChars) {
    return address
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Formats a CID for display
 * @param cid - The full CID
 * @param startChars - Number of characters to show at start (default: 12)
 * @param endChars - Number of characters to show at end (default: 8)
 * @returns Formatted CID
 */
export function formatCID(
  cid: string,
  startChars: number = CID_DISPLAY_START,
  endChars: number = CID_DISPLAY_END
): string {
  return formatAddress(cid, startChars, endChars)
}

/**
 * Calculates the Levenshtein distance between two strings with optimizations
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Distance normalized between 0 (exact match) and 1 (completely different)
 */
export function calculateDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  // Exact match
  if (s1 === s2) return EXACT_MATCH_DISTANCE

  // Prefix matches (highly relevant)
  if (s1.startsWith(s2)) return STARTS_WITH_MATCH_DISTANCE
  if (s2.startsWith(s1)) return REVERSE_STARTS_WITH_DISTANCE

  // Contains matches (somewhat relevant)
  if (s1.includes(s2)) return CONTAINS_MATCH_DISTANCE
  if (s2.includes(s1)) return REVERSE_CONTAINS_DISTANCE

  // Full Levenshtein distance calculation
  const matrix: number[][] = []

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  // Normalize the distance
  return matrix[s2.length][s1.length] / Math.max(s1.length, s2.length)
}

/**
 * Checks if a transaction is successful
 * @param status - Transaction status
 * @returns true if transaction was successful
 */
export function isSuccessStatus(status: string): boolean {
  return SUCCESS_STATUSES.includes(status as any)
}

/**
 * Checks if a transaction has an error
 * @param status - Transaction status
 * @returns true if transaction had an error
 */
export function isErrorStatus(status: string): boolean {
  return ERROR_STATUSES.includes(status as any)
}

/**
 * Checks if a transaction is pending
 * @param status - Transaction status
 * @returns true if transaction is pending
 */
export function isPendingStatus(status: string): boolean {
  return PENDING_STATUSES.includes(status as any)
}

/**
 * Filters transactions by status
 * @param transactions - Array of transactions
 * @param statusFilter - Status filter ('all', 'success', 'error', 'pending')
 * @returns Filtered transactions
 */
export function filterTransactionsByStatus(
  transactions: Transaction[],
  statusFilter: string
): Transaction[] {
  if (statusFilter === 'all') {
    return transactions
  }

  return transactions.filter(tx => {
    if (statusFilter === 'success') return isSuccessStatus(tx.status)
    if (statusFilter === 'error') return isErrorStatus(tx.status)
    if (statusFilter === 'pending') return isPendingStatus(tx.status)
    return true
  })
}

/**
 * Searches transactions by query string
 * @param transactions - Array of transactions
 * @param query - Search query
 * @returns Filtered transactions
 */
export function searchTransactions(
  transactions: Transaction[],
  query: string
): Transaction[] {
  if (!query.trim()) {
    return transactions
  }

  const q = query.toLowerCase()
  return transactions.filter(tx =>
    (tx.fn && tx.fn.toLowerCase().includes(q)) ||
    (tx.key && tx.key.toLowerCase().includes(q)) ||
    (tx.cid && tx.cid.toLowerCase().includes(q)) ||
    (tx.hash && tx.hash.toLowerCase().includes(q)) ||
    (tx.module && tx.module.toLowerCase().includes(q)) ||
    (tx.owner && tx.owner.toLowerCase().includes(q)) ||
    (tx.status && tx.status.toLowerCase().includes(q))
  )
}

/**
 * Sorts modules alphabetically by name
 * @param modules - Array of modules
 * @returns Sorted modules
 */
export function sortModules(modules: Module[]): Module[] {
  return [...modules].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Filters functions from schema, excluding special parameters
 * @param schema - Module schema
 * @returns Array of function names
 */
export function extractFunctions(schema: Record<string, any>): string[] {
  return Object.keys(schema)
    .filter(fn => fn !== 'self' && fn !== 'cls')
    .sort()
}

/**
 * Gets input parameters for a function, excluding special parameters
 * @param functionSchema - Function schema
 * @returns Array of parameter names
 */
export function getInputParams(functionSchema: Record<string, SchemaInputParam>): string[] {
  if (!functionSchema) return []

  return Object.keys(functionSchema)
    .filter(key => key !== 'self' && key !== 'cls')
}

/**
 * Checks if a schema value is empty
 * @param value - Schema value
 * @returns true if value is considered empty
 */
export function isEmptyValue(value: any): boolean {
  return value === '_empty' || value === undefined || value === null
}

/**
 * Extracts default parameters from function schema
 * @param functionSchema - Function schema with input definitions
 * @returns Object with default parameter values
 */
export function extractDefaultParams(
  functionSchema: { input?: Record<string, SchemaInputParam> }
): Record<string, any> {
  const defaultParams: Record<string, any> = {}

  if (!functionSchema.input) {
    return defaultParams
  }

  const inputKeys = Object.keys(functionSchema.input).filter(
    k => k !== 'self' && k !== 'cls'
  )

  // Extract non-empty default values
  Object.entries(functionSchema.input).forEach(([key, value]) => {
    if (!isEmptyValue(value.value)) {
      defaultParams[key] = value.value
    }
  })

  // Handle kwargs by including all parameters
  const hasKwargs = inputKeys.some(k => k === 'kwargs')
  if (hasKwargs) {
    Object.entries(functionSchema.input).forEach(([key, value]) => {
      if (key !== 'self' && key !== 'cls' && key !== 'kwargs' && !(key in defaultParams)) {
        defaultParams[key] = !isEmptyValue(value.value) ? value.value : ''
      }
    })
  }

  return defaultParams
}

/**
 * Focuses an element after a delay
 * @param selector - CSS selector for the element
 * @param delay - Delay in milliseconds (default: 100)
 */
export function focusElement(selector: string, delay: number = 100): void {
  setTimeout(() => {
    const element = document.querySelector<HTMLElement>(selector)
    if (element) {
      element.focus()
    }
  }, delay)
}

/**
 * Debounces a function call
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttles a function call
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}
