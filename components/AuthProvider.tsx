"use client"
import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

const SESSION_KEY = 'wb-session-token'

import { apiGetNoAuth, apiPostNoAuth, apiPost, apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface User {
  id: string
  email: string
  name: string | null
  organization_id?: string
  role?: string
}

interface Session {
  user: User | null
  expires: string | null
}

interface AuthContextType {
  data: Session | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  update: () => Promise<Session | null>
}

const AuthContext = createContext<AuthContextType>({
  data: null,
  status: 'loading',
  update: async () => null
})

// Custom hook that mimics next-auth's useSession
export function useSession() {
  return useContext(AuthContext)
}

// Get stored session token — validates format and expiry before returning
// @see ARCH_DOCS/06-REFERENCE/ENGINEERING_GUIDE.md Appendix A, Issue #7 (XSS hardening)
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const token = localStorage.getItem(SESSION_KEY)
    if (!token) return null

    // Basic format validation: JWT-like tokens are 3 dot-separated base64 segments,
    // UUIDs / hex tokens are 32-128 chars of alphanumeric + hyphens.
    // Reject anything that looks like injected script or exceeds sane length.
    if (token.length > 2048 || /[<>"']/.test(token)) {
      logger.warn('Token failed format validation — clearing', { len: token.length })
      clearToken()
      return null
    }

    // Check stored expiry — refuse expired tokens client-side
    const expiresStr = localStorage.getItem(`${SESSION_KEY}-expires`)
    if (expiresStr) {
      const expiresMs = new Date(expiresStr).getTime()
      if (!Number.isNaN(expiresMs) && expiresMs < Date.now()) {
        logger.info('Stored token expired — clearing')
        clearToken()
        return null
      }
    }

    return token
  } catch {
    // Storage access can throw in private/restricted contexts
    return null
  }
}

// Store session token — validates inputs before persisting
function storeToken(token: string, expires: string) {
  if (typeof window === 'undefined') return
  // Refuse to store suspicious values
  if (!token || token.length > 2048 || /[<>"']/.test(token)) {
    logger.warn('Refused to store invalid token', { len: token?.length })
    return
  }
  try {
    localStorage.setItem(SESSION_KEY, token)
    localStorage.setItem(`${SESSION_KEY}-expires`, expires)
  } catch {
    // QuotaExceededError or SecurityError in some contexts
    logger.warn('Failed to persist session token')
  }
}

// Clear stored token — called on logout, expiry, or tamper detection
function clearToken() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(`${SESSION_KEY}-expires`)
  } catch {
    // Ignore storage access errors
  }
}

// Wrapper for signIn that works with Workers API
export async function signIn(
  provider: string,
  options?: { username?: string; password?: string; redirect?: boolean; callbackUrl?: string }
) {
  if (provider === 'credentials') {
    try {
      // First, get CSRF token (no auth needed for this endpoint)
      const csrfData = await apiGetNoAuth('/api/auth/csrf')
      
      // Now make the credentials callback request with CSRF token (no auth needed - this IS the login)
      const data = await apiPostNoAuth('/api/auth/callback/credentials', {
        username: options?.username,
        password: options?.password,
        csrf_token: csrfData.csrf_token
      })
      
      // Store session token from response (API returns snake_case)
      if (data.session_token) {
        storeToken(data.session_token, data.expires)
      }
      
      // Trigger session refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-change'))
      }
      
      return { ok: true, url: options?.callbackUrl || '/dashboard', user: data.user }
    } catch (err: any) {
      return { error: err.message, ok: false }
    }
  }
  
  return { error: 'Unsupported provider', ok: false }
}

// Wrapper for signOut
export async function signOut(options?: { callbackUrl?: string }) {
  try {
    // Call signout endpoint with Bearer token
    await apiPost('/api/auth/signout', {})
  } catch {
    // Ignore errors
  }
  
  // Clear local token after signout attempt
  clearToken()
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth-change'))
    if (options?.callbackUrl) {
      window.location.href = options.callbackUrl
    }
  }
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  const fetchSession = useCallback(async (): Promise<Session | null> => {
    try {
      const token = getStoredToken()
      
      if (!token) {
        setSession(null)
        setStatus('unauthenticated')
        return null
      }
      
      const data = await apiGet('/api/auth/session')
      
      if (data.user) {
        const sess = { user: data.user, expires: data.expires }
        setSession(sess)
        setStatus('authenticated')
        return sess
      } else {
        clearToken()
        setSession(null)
        setStatus('unauthenticated')
        return null
      }
    } catch (err) {
      logger.error('Session fetch error', { error: err })
      setSession(null)
      setStatus('unauthenticated')
      return null
    }
  }, [])

  useEffect(() => {
    fetchSession()
    
    // Listen for auth changes (same tab)
    const handleAuthChange = () => fetchSession()
    window.addEventListener('auth-change', handleAuthChange)

    // Cross-tab storage event — detect token removal or tampering from another tab
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY || e.key === `${SESSION_KEY}-expires` || e.key === null) {
        // Token was cleared or changed in another tab — re-validate
        fetchSession()
      }
    }
    window.addEventListener('storage', handleStorage)
    
    return () => {
      window.removeEventListener('auth-change', handleAuthChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [fetchSession])

  // ─── Auto-refresh session before expiry ──────────────────────────────────
  // Checks every 30 min; if <24h left the backend extends to 7 more days.
  useEffect(() => {
    if (status !== 'authenticated') return

    const REFRESH_INTERVAL = 30 * 60 * 1000 // 30 minutes

    const tryRefresh = async () => {
      try {
        const token = getStoredToken()
        if (!token) return

        // Check stored expiry — only refresh if <24h remaining
        const expiresStr = typeof window !== 'undefined'
          ? localStorage.getItem('wb-session-token-expires')
          : null
        if (expiresStr) {
          const hoursLeft = (new Date(expiresStr).getTime() - Date.now()) / (1000 * 60 * 60)
          if (hoursLeft > 24) return // Plenty of time, skip
        }

        const data = await apiPost('/api/auth/refresh', {})
        if (data.refreshed && data.expires) {
          localStorage.setItem('wb-session-token-expires', data.expires)
          // H-3: If token was rotated, store the new token
          if (data.session_token) {
            storeToken(data.session_token, data.expires)
            logger.info('Session token rotated', { expires: data.expires })
          } else {
            logger.info('Session refreshed', { expires: data.expires })
          }
        }
      } catch {
        // Non-critical — next interval will retry
      }
    }

    // Initial check after 5s (avoid hammering on page load)
    const initialTimer = setTimeout(tryRefresh, 5000)
    const interval = setInterval(tryRefresh, REFRESH_INTERVAL)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [status])

  return (
    <AuthContext.Provider value={{ data: session, status, update: fetchSession }}>
      {children}
    </AuthContext.Provider>
  )
}
