/**
 * Caching Service
 * 
 * Multi-tier caching:
 * - Cloudflare Edge Cache (for Workers)
 * - Simple in-memory cache for frequently accessed data
 * - Per PRODUCTION_READINESS_TASKS.md
 * 
 * For production, consider Redis or Vercel KV.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

interface EdgeCacheOptions {
  ttl?: number // Time to live in seconds
  staleWhileRevalidate?: number // Stale-while-revalidate in seconds
  tags?: string[] // Cache tags for invalidation
}

// Cloudflare Edge Cache for Workers environment
class CloudflareEdgeCache {
  private cache: Cache

  constructor() {
    this.cache = (globalThis as any).caches?.default || {
      match: () => Promise.resolve(null),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve(false)
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const response = await this.cache.match(this.buildCacheKey(key))
      if (!response) return null
      
      const data = await response.json()
      return data as T
    } catch (error) {
      console.warn('Edge cache get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, options: EdgeCacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || 3600 // Default 1 hour
      const response = new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttl}`,
          'CDN-Cache-Control': `public, max-age=${ttl * 2}`, // Cache longer at edge
          'Date': new Date().toISOString(),
          ...(options.tags && { 'Cache-Tags': options.tags.join(',') })
        }
      })
      
      await this.cache.put(this.buildCacheKey(key), response)
    } catch (error) {
      console.warn('Edge cache set error:', error)
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      return await this.cache.delete(this.buildCacheKey(key))
    } catch (error) {
      console.warn('Edge cache delete error:', error)
      return false
    }
  }

  private buildCacheKey(key: string): string {
    return `https://cache.wordisbond.com/api/${key}`
  }
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
    const entries = Array.from(this.cache.entries())
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

const cache = new SimpleCache()
const edgeCache = new CloudflareEdgeCache()

// Hybrid caching class that uses both edge and memory cache
class HybridCache {
  async get<T>(key: string): Promise<T | null> {
    // Try memory cache first (fastest)
    const memoryResult = cache.get<T>(key)
    if (memoryResult !== null) {
      return memoryResult
    }

    // Try edge cache second
    const edgeResult = await edgeCache.get<T>(key)
    if (edgeResult !== null) {
      // Store in memory cache for even faster access
      cache.set(key, edgeResult, 300) // 5 minute memory cache
      return edgeResult
    }

    return null
  }

  async set<T>(key: string, value: T, options: { ttlSeconds?: number; edgeTtl?: number; tags?: string[] } = {}): Promise<void> {
    const { ttlSeconds = 300, edgeTtl = 3600, tags } = options
    
    // Set in memory cache
    cache.set(key, value, ttlSeconds)
    
    // Set in edge cache with longer TTL
    await edgeCache.set(key, value, { ttl: edgeTtl, tags })
  }

  async delete(key: string): Promise<void> {
    cache.delete(key)
    await edgeCache.delete(key)
  }

  clear(): void {
    cache.clear()
  }
}

const hybridCache = new HybridCache()

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000)
}

/**
 * Get cached value or compute and cache using hybrid caching
 */
export async function getOrSet<T>(
  key: string,
  computeFn: () => Promise<T>,
  ttlSeconds: number = 300,
  edgeTtl: number = 3600
): Promise<T> {
  // Try hybrid cache first
  const cached = await hybridCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  const value = await computeFn()
  await hybridCache.set(key, value, { ttlSeconds, edgeTtl })
  return value
}

/**
 * Cache voice configs (frequently accessed)
 */
export async function getCachedVoiceConfig(organizationId: string, fetchFn: () => Promise<any>): Promise<any> {
  return getOrSet(`voice_config:${organizationId}`, fetchFn, 60, 300) // 1 min memory, 5 min edge
}

/**
 * Cache organization plan (rarely changes)
 */
export async function getCachedOrgPlan(organizationId: string, fetchFn: () => Promise<string>): Promise<string> {
  return getOrSet(`org_plan:${organizationId}`, fetchFn, 300, 1800) // 5 min memory, 30 min edge
}

/**
 * Invalidate cache entry from both tiers
 */
export async function invalidateCache(key: string): Promise<void> {
  await hybridCache.delete(key)
}

/**
 * Invalidate all memory cache
 */
export function clearCache(): void {
  hybridCache.clear()
}

/**
 * Cache presets for different data types
 */
export const CachePresets = {
  // Static data that rarely changes
  STATIC: { ttlSeconds: 3600, edgeTtl: 86400 }, // 1h memory, 24h edge
  
  // API responses that change periodically
  API: { ttlSeconds: 300, edgeTtl: 3600 }, // 5m memory, 1h edge
  
  // User-specific data
  USER: { ttlSeconds: 60, edgeTtl: 300 }, // 1m memory, 5m edge
  
  // Organization data (bump for scale)
  ORG: { ttlSeconds: 600, edgeTtl: 86400 }, // 10m memory, 24h edge
  
  // Real-time data
  REALTIME: { ttlSeconds: 30, edgeTtl: 60 } // 30s memory, 1m edge
} as const
