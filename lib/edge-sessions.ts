/**
 * KV Session Management for Cloudflare Edge
 * Provides ultra-fast session handling using Cloudflare KV
 */

interface SessionData {
  userId: string
  organizationId: string
  role: string
  email: string
  createdAt: string
  expiresAt: string
  lastActivity: string
}

interface KVSessionStore {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
  delete: (key: string) => Promise<void>
}

export class EdgeSessionManager {
  private kv: KVSessionStore
  private readonly SESSION_TTL = 24 * 60 * 60 // 24 hours in seconds
  private readonly SESSION_PREFIX = 'sess:'

  constructor(kvStore: KVSessionStore) {
    this.kv = kvStore
  }

  /**
   * Create a new session and store in KV
   */
  async createSession(sessionId: string, userData: Omit<SessionData, 'createdAt' | 'expiresAt' | 'lastActivity'>): Promise<void> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + (this.SESSION_TTL * 1000))
    
    const sessionData: SessionData = {
      ...userData,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastActivity: now.toISOString()
    }

    const key = this.getSessionKey(sessionId)
    await this.kv.put(key, JSON.stringify(sessionData), {
      expirationTtl: this.SESSION_TTL
    })
  }

  /**
   * Get session data from KV
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = this.getSessionKey(sessionId)
    const data = await this.kv.get(key)
    
    if (!data) {
      return null
    }

    try {
      const sessionData: SessionData = JSON.parse(data)
      
      // Check if session has expired
      if (new Date(sessionData.expiresAt) < new Date()) {
        await this.deleteSession(sessionId)
        return null
      }

      return sessionData
    } catch (error) {
      console.error('Failed to parse session data:', error)
      return null
    }
  }

  /**
   * Update session last activity time
   */
  async touchSession(sessionId: string): Promise<boolean> {
    const sessionData = await this.getSession(sessionId)
    if (!sessionData) {
      return false
    }

    sessionData.lastActivity = new Date().toISOString()
    
    const key = this.getSessionKey(sessionId)
    await this.kv.put(key, JSON.stringify(sessionData), {
      expirationTtl: this.SESSION_TTL
    })
    
    return true
  }

  /**
   * Delete session from KV
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = this.getSessionKey(sessionId)
    await this.kv.delete(key)
  }

  /**
   * Validate session and return user data
   */
  async validateSession(sessionId: string): Promise<SessionData | null> {
    const sessionData = await this.getSession(sessionId)
    if (!sessionData) {
      return null
    }

    // Update last activity
    await this.touchSession(sessionId)
    
    return sessionData
  }

  /**
   * Get organization sessions (for admin purposes)
   */
  async getOrganizationSessions(organizationId: string): Promise<string[]> {
    // Note: KV doesn't support listing by prefix efficiently
    // This would require a separate index or D1 database
    // For now, return empty array - implement with D1 if needed
    return []
  }

  private getSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`
  }
}

/**
 * Initialize session manager for Cloudflare Workers environment
 */
export function createSessionManager(env: { SESSIONS?: KVNamespace }): EdgeSessionManager {
  if (env.SESSIONS) {
    // Use Cloudflare KV
    return new EdgeSessionManager({
      get: async (key: string) => await env.SESSIONS!.get(key),
      put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
        await env.SESSIONS!.put(key, value, options)
      },
      delete: async (key: string) => await env.SESSIONS!.delete(key)
    })
  } else {
    // Fallback to in-memory store (development)
    const memoryStore = new Map<string, { value: string; expiresAt: number }>()
    
    return new EdgeSessionManager({
      get: async (key: string) => {
        const item = memoryStore.get(key)
        if (!item || item.expiresAt < Date.now()) {
          memoryStore.delete(key)
          return null
        }
        return item.value
      },
      put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
        const expiresAt = Date.now() + (options?.expirationTtl || 3600) * 1000
        memoryStore.set(key, { value, expiresAt })
      },
      delete: async (key: string) => {
        memoryStore.delete(key)
      }
    })
  }
}

// Export types for use in other modules
export type { SessionData, KVSessionStore }