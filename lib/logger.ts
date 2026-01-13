/**
 * Centralized Logging System
 * 
 * Replaces console.log/error/warn with environment-aware structured logging.
 * Production logs only errors and warnings, development logs everything.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

class Logger {
  private isDevelopment: boolean
  private isTest: boolean

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
    this.isTest = process.env.NODE_ENV === 'test'
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isTest) return false
    
    // Production: only warn and error
    if (!this.isDevelopment) {
      return level === 'warn' || level === 'error'
    }
    
    // Development: log everything
    return true
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context))
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...context
      } : { error, ...context }
      
      console.error(this.formatMessage('error', message, errorContext))
    }
  }

  // Helper for logging API requests
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API Request: ${method} ${path}`, context)
  }

  // Helper for logging API responses
  apiResponse(method: string, path: string, statusCode: number, duration?: number): void {
    const context = { statusCode, duration }
    if (statusCode >= 500) {
      this.error(`API Response: ${method} ${path}`, undefined, context)
    } else if (statusCode >= 400) {
      this.warn(`API Response: ${method} ${path}`, context)
    } else {
      this.info(`API Response: ${method} ${path}`, context)
    }
  }

  // Helper for database queries
  dbQuery(query: string, params?: any): void {
    this.debug('Database query', { query: query.substring(0, 100), params })
  }

  // Helper for external API calls
  externalCall(service: string, endpoint: string, context?: LogContext): void {
    this.info(`External call: ${service}`, { endpoint, ...context })
  }
}

// Export singleton instance
export const logger = new Logger()

// Export helper for migration from console.log
export const log = logger
