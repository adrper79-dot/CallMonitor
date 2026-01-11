/**
 * Caching Service
 * 
 * Simple in-memory cache for frequently accessed data.
 * Per PRODUCTION_READINESS_TASKS.md
 * 
 * For production, consider Redis or Vercel KV.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map()

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

const cache = new SimpleCache()

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000)
}

/**
 * Get cached value or compute and cache
 */
export async function getOrSet<T>(
  key: string,
  computeFn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = cache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  const value = await computeFn()
  cache.set(key, value, ttlSeconds)
  return value
}

/**
 * Cache voice configs (frequently accessed)
 */
export async function getCachedVoiceConfig(organizationId: string, fetchFn: () => Promise<any>): Promise<any> {
  return getOrSet(`voice_config:${organizationId}`, fetchFn, 60) // 1 minute TTL
}

/**
 * Cache organization plan (rarely changes)
 */
export async function getCachedOrgPlan(organizationId: string, fetchFn: () => Promise<string>): Promise<string> {
  return getOrSet(`org_plan:${organizationId}`, fetchFn, 300) // 5 minutes TTL
}

/**
 * Invalidate cache entry
 */
export function invalidateCache(key: string): void {
  cache.delete(key)
}

/**
 * Invalidate all cache
 */
export function clearCache(): void {
  cache.clear()
}
