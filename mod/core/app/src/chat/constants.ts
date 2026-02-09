/**
 * Constants used throughout the chat interface
 */

// Default Settings
export const DEFAULT_TIMEOUT = 30 // seconds
export const DEFAULT_WAIT = false
export const DEFAULT_MODULE = 'api'
export const DEFAULT_FUNCTION = 'edit'
export const DEFAULT_DIVIDER_POSITION = 50 // percentage
export const DEFAULT_CONFIG_ORIENTATION = 'vertical' as const

// UI Constants
export const MIN_DIVIDER_POSITION = 10 // percentage
export const MAX_DIVIDER_POSITION = 90 // percentage
export const DIVIDER_SIZE = 4 // pixels

// Pagination
export const DEFAULT_PAGE_SIZE = 50
export const AUTO_REFRESH_INTERVAL = 10000 // milliseconds

// Fuzzy Search
export const MAX_SEARCH_RESULTS = 8
export const FUZZY_SEARCH_THRESHOLD = 0.8
export const EXACT_MATCH_DISTANCE = 0
export const STARTS_WITH_MATCH_DISTANCE = 0.05
export const REVERSE_STARTS_WITH_DISTANCE = 0.1
export const CONTAINS_MATCH_DISTANCE = 0.2
export const REVERSE_CONTAINS_DISTANCE = 0.3

// Local Storage Keys
export const STORAGE_KEY_DIVIDER_POSITION = 'chat_divider_position'

// Filter Keys
export const FILTER_ALL = 'all'
export const FILTER_SUCCESS = 'success'
export const FILTER_ERROR = 'error'
export const FILTER_PENDING = 'pending'

// Status Groups
export const SUCCESS_STATUSES = ['success', 'finished', 'complete'] as const
export const ERROR_STATUSES = ['error', 'failed', 'cancelled'] as const
export const PENDING_STATUSES = ['pending', 'running'] as const

// Schema Constants
export const EMPTY_VALUE = '_empty'
export const EXCLUDED_PARAMS = ['self', 'cls', 'kwargs'] as const

// Timeouts
export const FOCUS_DELAY = 100 // milliseconds

// Display Constants
export const ADDRESS_DISPLAY_START = 8
export const ADDRESS_DISPLAY_END = 6
export const CID_DISPLAY_START = 12
export const CID_DISPLAY_END = 8

// Responsive Breakpoints
export const MOBILE_BREAKPOINT = 600 // pixels
