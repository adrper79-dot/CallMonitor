"use client"
import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

// Workers API URL for auth endpoints
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const SESSION_KEY = 'wb-session-token'

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

// Get stored session token
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_KEY)
}

// Store session token
function storeToken(token: string, expires: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_KEY, token)
  localStorage.setItem(`${SESSION_KEY}-expires`, expires)
}

// Clear stored token
function clearToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(`${SESSION_KEY}-expires`)
}

// Wrapper for signIn that works with Workers API
export async function signIn(
  provider: string,
  options?: { username?: string; password?: string; redirect?: boolean; callbackUrl?: string }
) {
  if (provider === 'credentials') {
    try {
      // First, get CSRF token (no auth needed for this endpoint)
      // Request CSRF token. include credentials so browser will accept
      // Set-Cookie from the workers API when present (SameSite=None).
      const csrfRes = await fetch(`${API_BASE}/api/auth/csrf`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      
      if (!csrfRes.ok) {
        return { error: 'Failed to get CSRF token', ok: false }
      }
      
      const csrfData = await csrfRes.json()
      
      // Now make the credentials callback request with CSRF token (no auth needed - this IS the login)
      // Use credentials: 'include' so cookies set by the API will be stored
      // in the browser (the API sets SameSite=None; Secure; HttpOnly cookies).
      const res = await fetch(`${API_BASE}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: options?.username,
          password: options?.password,
          csrf_token: csrfData.csrf_token
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { error: data.error || 'Authentication failed', ok: false }
      }
      
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
    const token = getStoredToken()
    await fetch(`${API_BASE}/api/auth/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    })
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
      
      const res = await fetch(`${API_BASE}/api/auth/session`, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!res.ok) {
        clearToken()
        setSession(null)
        setStatus('unauthenticated')
        return null
      }
      
      const data = await res.json()
      
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
      console.error('Session fetch error:', err)
      setSession(null)
      setStatus('unauthenticated')
      return null
    }
  }, [])

  useEffect(() => {
    fetchSession()
    
    // Listen for auth changes
    const handleAuthChange = () => fetchSession()
    window.addEventListener('auth-change', handleAuthChange)
    window.addEventListener('storage', handleAuthChange)
    
    return () => {
      window.removeEventListener('auth-change', handleAuthChange)
      window.removeEventListener('storage', handleAuthChange)
    }
  }, [fetchSession])

  return (
    <AuthContext.Provider value={{ data: session, status, update: fetchSession }}>
      {children}
    </AuthContext.Provider>
  )
}
