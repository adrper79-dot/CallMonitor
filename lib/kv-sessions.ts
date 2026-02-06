// lib/kv-sessions.ts - KV-based session management for Cloudflare Workers
interface SessionData {
  userId: string
  organizationId: string
  email: string
  role: string
  lastActivity: number
  expiresAt: number
}

interface KVSessionService {
  createSession(userId: string, sessionData: Omit<SessionData, 'expiresAt' | 'lastActivity'>): Promise<string>
  getSession(sessionId: string): Promise<SessionData | null>
  updateSession(sessionId: string, data: Partial<SessionData>): Promise<void>
  deleteSession(sessionId: string): Promise<void>
  cleanupExpiredSessions(): Promise<number>
}

export class CloudflareKVSessionService implements KVSessionService {
  private kv: any
  private keyPrefix = 'session:'
  private defaultTTL = 86400 // 24 hours

  constructor() {
    this.kv = (globalThis as any).KV
    if (!this.kv) {
      console.warn('KV binding not available - falling back to memory sessions')
    }
  }

  async createSession(userId: string, sessionData: Omit<SessionData, 'expiresAt' | 'lastActivity'>): Promise<string> {
    if (!this.kv) {
      throw new Error('KV store not available')
    }

    const sessionId = this.generateSessionId()
    const now = Date.now()
    
    const session: SessionData = {
      ...sessionData,
      lastActivity: now,
      expiresAt: now + (this.defaultTTL * 1000)
    }

    await this.kv.put(
      `${this.keyPrefix}${sessionId}`, 
      JSON.stringify(session),
      { expirationTtl: this.defaultTTL }
    )

    return sessionId
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.kv) return null

    try {
      const data = await this.kv.get(`${this.keyPrefix}${sessionId}`)
      if (!data) return null

      const session: SessionData = JSON.parse(data)
      
      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        await this.deleteSession(sessionId)
        return null
      }

      return session
    } catch (error) {
      console.error('Failed to get session from KV:', error)
      return null
    }
  }

  async updateSession(sessionId: string, data: Partial<SessionData>): Promise<void> {
    if (!this.kv) return

    const existing = await this.getSession(sessionId)
    if (!existing) return

    const updated: SessionData = {
      ...existing,
      ...data,
      lastActivity: Date.now()
    }

    await this.kv.put(
      `${this.keyPrefix}${sessionId}`,
      JSON.stringify(updated),
      { expirationTtl: this.defaultTTL }
    )
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.kv) return

    await this.kv.delete(`${this.keyPrefix}${sessionId}`)
  }

  async cleanupExpiredSessions(): Promise<number> {
    if (!this.kv) return 0

    // KV automatically handles expiration via TTL, so this is mainly for logging
    return 0
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  isAvailable(): boolean {
    return !!this.kv
  }
}

// Fallback in-memory session service for non-KV environments
class MemorySessionService implements KVSessionService {
  private sessions = new Map<string, SessionData>()

  async createSession(userId: string, sessionData: Omit<SessionData, 'expiresAt' | 'lastActivity'>): Promise<string> {
    const sessionId = this.generateSessionId()
    const now = Date.now()
    
    const session: SessionData = {
      ...sessionData,
      lastActivity: now,
      expiresAt: now + (86400 * 1000) // 24 hours
    }

    this.sessions.set(sessionId, session)
    return sessionId
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId)
      return null
    }

    return session
  }

  async updateSession(sessionId: string, data: Partial<SessionData>): Promise<void> {
    const existing = this.sessions.get(sessionId)
    if (!existing) return

    const updated: SessionData = {
      ...existing,
      ...data,
      lastActivity: Date.now()
    }

    this.sessions.set(sessionId, updated)
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now()
    let cleaned = 0
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId)
        cleaned++
      }
    }
    
    return cleaned
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Factory function to get the appropriate session service
export function getSessionService(): KVSessionService {
  const kvService = new CloudflareKVSessionService()
  if (kvService.isAvailable()) {
    return kvService
  }
  
  // Fall back to memory sessions for development/non-KV environments
  return new MemorySessionService()
}

// Utility functions for use in API routes
export async function createUserSession(userId: string, organizationId: string, email: string, role: string): Promise<string> {
  const sessionService = getSessionService()
  return await sessionService.createSession(userId, {
    userId,
    organizationId,
    email,
    role
  })
}

export async function validateSession(sessionId: string): Promise<SessionData | null> {
  const sessionService = getSessionService()
  return await sessionService.getSession(sessionId)
}

export async function invalidateSession(sessionId: string): Promise<void> {
  const sessionService = getSessionService()
  await sessionService.deleteSession(sessionId)
}

export type { SessionData }