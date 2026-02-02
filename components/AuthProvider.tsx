"use client"
import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

// Workers API URL for auth endpoints
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

interface User {
  id: string
  email: string
  name: string | null
  organizationId?: string
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

// Wrapper for signIn that works with Workers API
export async function signIn(
  provider: string,
  options?: { username?: string; password?: string; redirect?: boolean; callbackUrl?: string }
) {
  if (provider === 'credentials') {
    try {
      const res = await fetch(`${API_BASE}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: options?.username,
          password: options?.password
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { error: data.error || 'Authentication failed', ok: false }
      }
      
      // Trigger session refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-change'))
      }
      
      return { ok: true, url: options?.callbackUrl || '/dashboard' }
    } catch (err: any) {
      return { error: err.message, ok: false }
    }
  }
  
  return { error: 'Unsupported provider', ok: false }
}

// Wrapper for signOut
export async function signOut(options?: { callbackUrl?: string }) {
  try {
    // Clear session cookie by calling signout endpoint
    await fetch(`${API_BASE}/api/auth/signout`, {
      method: 'POST',
      credentials: 'include'
    })
  } catch {
    // Ignore errors
  }
  
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
      const res = await fetch(`${API_BASE}/api/auth/session`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      })
      
      if (!res.ok) {
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
    
    return () => {
      window.removeEventListener('auth-change', handleAuthChange)
    }
  }, [fetchSession])

  return (
    <AuthContext.Provider value={{ data: session, status, update: fetchSession }}>
      {children}
    </AuthContext.Provider>
  )
}
