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
import type { Transaction, Module, SchemaInputParam, ModuleSchema, FunctionSchema } from './types'

/**
 * Normalizes the input field to map format
 * Handles both map format { paramName: SchemaInputParam } and list format [{ name: paramName, ... }]
 * @param input - Input in either format
 * @returns Input as a map with parameter names as keys
 */
export function normalizeInput(
  input: Record<string, SchemaInputParam> | SchemaInputParam[]
): Record<string, SchemaInputParam> {
  // Already a map
  if (!Array.isArray(input)) {
    console.log('normalizeInput - already a map, keys:', Object.keys(input))
    return input
  }

  console.log('normalizeInput - converting list to map, input:', input)

  // Convert list to map
  const normalized: Record<string, SchemaInputParam> = {}
  input.forEach((paramSchema, index) => {
    // Use the 'name' field as the key if it exists
    // Otherwise fall back to the index as a string (for numeric keys like "0", "1", etc.)
    const paramName = paramSchema.name || String(index)

    // Create a copy without the 'name' field since it's now the key
    const { name, ...rest } = paramSchema
    normalized[paramName] = rest as SchemaInputParam
  })

  console.log('normalizeInput - output map keys:', Object.keys(normalized))

  return normalized
}

/**
 * Normalizes a function schema by ensuring input is in map format
 * @param fnSchema - Function schema to normalize
 * @returns Normalized function schema with input as a map
 */
export function normalizeFunctionSchema(fnSchema: FunctionSchema): FunctionSchema {
  return {
    ...fnSchema,
    input: normalizeInput(fnSchema.input)
  }
}

/**
 * Normalizes a schema to map format
 * Handles both map format { fnName: FunctionSchema } and list format [{ name: fnName, ... }]
 * Also normalizes the input field within each function schema
 * @param schema - Schema in either format
 * @returns Schema as a map with function names as keys
 */
export function normalizeSchema(schema: ModuleSchema): Record<string, FunctionSchema> {
  // Already a map
  if (!Array.isArray(schema)) {
    console.log('normalizeSchema - input is already a map, keys:', Object.keys(schema))
    // Still need to normalize the input fields within each function schema
    const normalized: Record<string, FunctionSchema> = {}
    Object.entries(schema).forEach(([fnName, fnSchema]) => {
      normalized[fnName] = normalizeFunctionSchema(fnSchema)
    })
    console.log('normalizeSchema - normalized map keys:', Object.keys(normalized))
    return normalized
  }

  console.log('normalizeSchema - converting list to map, input:', schema)

  // Convert list to map
  const normalized: Record<string, FunctionSchema> = {}
  schema.forEach((fnSchema, index) => {
    // Use the 'name' field as the key if it exists
    // Otherwise fall back to the index as a string (for numeric keys like "0", "1", etc.)
    const fnName = fnSchema.name || String(index)
    console.log(`normalizeSchema - function ${index}: name="${fnName}"`, fnSchema)

    // Create a copy without the 'name' field since it's now the key
    const { name, ...rest } = fnSchema

    // Normalize the function schema (which will normalize its input field)
    normalized[fnName] = normalizeFunctionSchema(rest as FunctionSchema)
  })

  console.log('normalizeSchema - output map keys:', Object.keys(normalized))

  return normalized
}

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
 * Handles both map and list formats
 * @param schema - Module schema (map or list format)
 * @returns Array of function names
 */
export function extractFunctions(schema: ModuleSchema | Record<string, any>): string[] {
  const normalizedSchema = normalizeSchema(schema as ModuleSchema)
  return Object.keys(normalizedSchema)
    .filter(fn => fn !== 'self' && fn !== 'cls')
    .sort()
}

/**
 * Gets input parameters for a function, excluding special parameters
 * Handles both map and array formats
 * @param functionSchema - Function schema input (map or array)
 * @returns Array of parameter names
 */
export function getInputParams(functionSchema: Record<string, SchemaInputParam> | SchemaInputParam[]): string[] {
  if (!functionSchema) return []

  // Normalize to map format first
  const normalizedInput = normalizeInput(functionSchema)

  return Object.keys(normalizedInput)
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
 * Handles both map and array formats for input
 * @param functionSchema - Function schema with input definitions
 * @returns Object with default parameter values
 */
export function extractDefaultParams(
  functionSchema: { input?: Record<string, SchemaInputParam> | SchemaInputParam[] }
): Record<string, any> {
  const defaultParams: Record<string, any> = {}

  if (!functionSchema.input) {
    return defaultParams
  }

  // Normalize input to map format
  const normalizedInput = normalizeInput(functionSchema.input)

  const inputKeys = Object.keys(normalizedInput).filter(
    k => k !== 'self' && k !== 'cls'
  )

  // Extract non-empty default values
  Object.entries(normalizedInput).forEach(([key, value]) => {
    if (!isEmptyValue(value.value)) {
      defaultParams[key] = value.value
    }
  })

  // Handle kwargs by including all parameters
  const hasKwargs = inputKeys.some(k => k === 'kwargs')
  if (hasKwargs) {
    Object.entries(normalizedInput).forEach(([key, value]) => {
      if (key !== 'self' && key !== 'cls' && key !== 'kwargs' && !(key in defaultParams)) {
        defaultParams[key] = !isEmptyValue(value.value) ? value.value : ''
      }
    })
  }

  return defaultParams
}

/**
 * Gets sorted parameter entries from function schema
 * Sorts by args array if available, then by position field, then by Object.keys order
 * Handles both map and array formats for input
 * @param functionSchema - Function schema with input and optional args array
 * @returns Sorted array of [paramName, paramValue] tuples
 */
export function getSortedParamEntries(
  functionSchema: { input?: Record<string, SchemaInputParam> | SchemaInputParam[]; args?: string[] }
): [string, SchemaInputParam][] {
  if (!functionSchema.input) return []

  // Normalize input to map format
  const normalizedInput = normalizeInput(functionSchema.input)

  let entries = Object.entries(normalizedInput).filter(
    ([key]) => key !== 'self' && key !== 'cls' && key !== 'kwargs'
  )

  // If schema has args array, use that order
  if (functionSchema.args && Array.isArray(functionSchema.args)) {
    const argsOrder = functionSchema.args.filter(
      k => k !== 'self' && k !== 'cls' && k !== 'kwargs'
    )
    entries.sort((a, b) => {
      const indexA = argsOrder.indexOf(a[0])
      const indexB = argsOrder.indexOf(b[0])
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
  } else {
    // Sort by position field
    entries.sort((a, b) => {
      const posA = a[1]?.position ?? Number.MAX_SAFE_INTEGER
      const posB = b[1]?.position ?? Number.MAX_SAFE_INTEGER
      return posA - posB
    })
  }

  return entries as [string, SchemaInputParam][]
}

/**
 * Gets sorted parameter names from function schema
 * Handles both map and array formats for input
 * @param functionSchema - Function schema
 * @returns Sorted array of parameter names
 */
export function getSortedParamNames(
  functionSchema: { input?: Record<string, SchemaInputParam> | SchemaInputParam[]; args?: string[] }
): string[] {
  return getSortedParamEntries(functionSchema).map(([name]) => name)
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
