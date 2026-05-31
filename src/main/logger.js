/**
 * Environment-aware logging utility.
 * Sanitizes sensitive paths in non-development environments.
 *
 * Environment is checked at runtime (not import time) so tests
 * that mutate NODE_ENV between imports get correct behavior.
 */

function getEnv() {
  const isDev = process.env.NODE_ENV === 'development'
  return { isDev }
}

/**
 * Sanitize message for production logging.
 * Removes full file paths and sensitive system info.
 */
function sanitizeForProd(msg) {
  if (typeof msg !== 'string') return msg
  const { isDev } = getEnv()
  if (isDev) return msg
  return msg
    .replace(/\/home\/[^\/\s]+/g, '/home/***')
    .replace(/\/Users\/[^\/\s]+/g, '/Users/***')
    .replace(/C:\\Users\\[^\\\s]+/gi, 'C:\\Users\\***')
    .replace(/\/tmp\/[^\s]+/g, '/tmp/***')
}

export const logger = {
  /**
   * Debug logging - only in development.
   * Use for verbose operational info.
   */
  debug(...args) {
    if (getEnv().isDev) console.debug(...args)
  },

  /**
   * Info logging - only in development.
   * Use for operational milestones.
   */
  info(...args) {
    if (getEnv().isDev) console.log(...args.map(a => typeof a === 'string' ? sanitizeForProd(a) : a))
  },

  /**
   * Warning logging - always active.
   * Use for recoverable issues.
   */
  warn(...args) {
    console.warn(...args.map(a => typeof a === 'string' ? sanitizeForProd(a) : a))
  },

  /**
   * Error logging - always active.
   * Use for failures requiring attention.
   */
  error(...args) {
    console.error(...args.map(a => typeof a === 'string' ? sanitizeForProd(a) : a))
  },

  /**
   * Log with context tag.
   * Automatically sanitizes paths in production.
   */
  tagged(tag, level, ...args) {
    const validLevels = ['debug', 'info', 'warn', 'error']
    if (!validLevels.includes(level)) {
      throw new Error(`Invalid log level: ${level}. Must be one of: ${validLevels.join(', ')}`)
    }
    const prefixed = args.map(a => typeof a === 'string' ? `[${tag}] ${sanitizeForProd(a)}` : a)
    this[level](...prefixed)
  }
}

export default logger
