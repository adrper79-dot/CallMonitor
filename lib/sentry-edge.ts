/**
 * Cloudflare Workers Sentry Integration
 * Provides error tracking and performance monitoring for edge deployment
 */

interface SentryConfig {
  dsn?: string
  environment?: string
  tracesSampleRate?: number
  enabled?: boolean
}

interface SentryEvent {
  message?: string
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
  tags?: Record<string, string>
  extra?: Record<string, any>
  user?: {
    id?: string
    email?: string
    organizationId?: string
  }
  request?: {
    url?: string
    method?: string
    headers?: Record<string, string>
  }
}

class CloudflareSentry {
  private config: SentryConfig
  private isEdgeRuntime: boolean

  constructor(config: SentryConfig) {
    this.config = {
      enabled: true,
      tracesSampleRate: 0.1,
      environment: 'production',
      ...config
    }
    this.isEdgeRuntime = typeof EdgeRuntime !== 'undefined' || typeof caches !== 'undefined'
  }

  /**
   * Capture an exception and send to Sentry
   */
  async captureException(error: Error, context?: Partial<SentryEvent>): Promise<void> {
    if (!this.config.enabled || !this.config.dsn) {
      return
    }

    try {
      const event = this.createEvent({
        message: error.message,
        level: 'error',
        ...context
      })

      // Add error details
      event.extra = {
        ...event.extra,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }

      await this.sendToSentry(event)
    } catch (sentryError) {
      console.error('Failed to send error to Sentry:', sentryError)
    }
  }

  /**
   * Capture a message
   */
  async captureMessage(message: string, level: SentryEvent['level'] = 'info', context?: Partial<SentryEvent>): Promise<void> {
    if (!this.config.enabled || !this.config.dsn) {
      return
    }

    try {
      const event = this.createEvent({
        message,
        level,
        ...context
      })

      await this.sendToSentry(event)
    } catch (sentryError) {
      console.error('Failed to send message to Sentry:', sentryError)
    }
  }

  /**
   * Add context tags for the current request
   */
  setTags(tags: Record<string, string>): void {
    // In edge runtime, we'll pass tags with each event
    // Store in a request-scoped context if available
  }

  /**
   * Set user context
   */
  setUser(user: SentryEvent['user']): void {
    // Store user context for this request
  }

  private createEvent(data: Partial<SentryEvent>): any {
    return {
      event_id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      server_name: 'cloudflare-worker',
      environment: this.config.environment,
      tags: {
        runtime: this.isEdgeRuntime ? 'edge' : 'nodejs',
        worker: true,
        ...data.tags
      },
      extra: data.extra || {},
      level: data.level || 'info',
      message: data.message,
      user: data.user,
      request: data.request
    }
  }

  private async sendToSentry(event: any): Promise<void> {
    if (!this.config.dsn) return

    // Parse DSN to get project info
    const dsnMatch = this.config.dsn.match(/https:\/\/([^@]+)@([^\/]+)\/(.+)/)
    if (!dsnMatch) {
      throw new Error('Invalid Sentry DSN format')
    }

    const [, publicKey, host, projectId] = dsnMatch
    const sentryUrl = `https://${host}/api/${projectId}/store/`

    const headers = {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': [
        `Sentry sentry_version=7`,
        `sentry_client=cloudflare-sentry/1.0.0`,
        `sentry_timestamp=${Math.floor(Date.now() / 1000)}`,
        `sentry_key=${publicKey}`
      ].join(', ')
    }

    await fetch(sentryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(event)
    })
  }

  private generateEventId(): string {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}

// Global instance
let sentryInstance: CloudflareSentry | null = null

/**
 * Initialize Sentry for Cloudflare Workers
 */
export function initSentry(config: SentryConfig): void {
  sentryInstance = new CloudflareSentry(config)
}

/**
 * Capture exception with Sentry
 */
export async function captureException(error: Error, context?: Partial<SentryEvent>): Promise<void> {
  if (sentryInstance) {
    await sentryInstance.captureException(error, context)
  } else {
    console.error('Sentry not initialized:', error)
  }
}

/**
 * Capture message with Sentry
 */
export async function captureMessage(message: string, level?: SentryEvent['level'], context?: Partial<SentryEvent>): Promise<void> {
  if (sentryInstance) {
    await sentryInstance.captureMessage(message, level, context)
  } else {
    console.log(`Sentry not initialized - Message: ${message}`)
  }
}

/**
 * Middleware wrapper for Next.js API routes with Sentry error tracking
 */
export function withSentry<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  context?: { 
    route?: string
    tags?: Record<string, string>
  }
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args)
    } catch (error) {
      await captureException(error instanceof Error ? error : new Error(String(error)), {
        tags: {
          route: context?.route || 'unknown',
          ...context?.tags
        },
        extra: {
          args: args.length <= 2 ? args : ['...args'],
          context
        }
      })
      throw error // Re-throw to maintain normal error handling
    }
  }
}

// Export the Sentry class for advanced usage
export { CloudflareSentry }