"use client"
import React, { useState, useEffect } from "react"
import { signIn, useSession, signOut } from "@/components/AuthProvider"
import { apiPost } from '@/lib/apiClient'

export default function UnlockForm() {
  const { data: session } = useSession()
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [authMethod, setAuthMethod] = useState<'email' | 'credentials'>('email')
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null)
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    // Disable email and google for now
    setEmailAvailable(false)
    setGoogleAvailable(false)
    setAuthMethod('credentials')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("processing")

    if (mode === 'signup') {
      // Handle signup
      if (!email || !password) {
        setStatus('Please fill in all required fields')
        return
      }

      try {
        const data = await apiPost('/api/auth/signup', { 
          email, 
          password, 
          name: name || undefined 
        })

        setStatus('Account created! Signing in...')
        // Auto-sign in after successful signup
        const signInRes = await signIn('credentials', { 
          username: email, 
          password, 
          redirect: false 
        })
        if (signInRes && !signInRes.ok) {
          setStatus('Account created, but sign-in failed. Please try signing in manually.')
        } else {
          setStatus('signed-in')
        }
      } catch (err: any) {
        setStatus('Signup failed: ' + (err?.message || 'Unknown error'))
      }
    } else {
      // Handle signin
      if (authMethod === 'email') {
        // For now, treat as credentials
        const val = (email || '').trim()
        const looksLikeEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)
        if (!looksLikeEmail) {
          setStatus('invalid email')
          return
        }
        const res = await signIn('credentials', { username: val, password: '', redirect: false })
        if (res && !res.ok) setStatus('failed')
        else setStatus('sent')
      } else {
        const id = (username || email).trim()
        if (!id || !password) {
          setStatus('Please enter username/email and password')
          return
        }
        const res = await signIn('credentials', { username: id, password, redirect: false })
        if (res && !res.ok) setStatus('failed')
        else setStatus('signed-in')
      }
    }
  }

  async function handleGoogleSignIn() {
    setStatus('Google sign-in not available')
    // await signIn('google', { callbackUrl: window.location.href })
  }

  if (session) {
    return (
      <div style={{ padding: 8, background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Signed in as {session.user?.email || session.user?.name}</span>
        <button onClick={() => signOut()} style={{ padding: "4px 8px", fontSize: "12px" }}>Sign out</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
      {/* Mode Toggle: Sign In / Sign Up */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button 
          type="button" 
          onClick={() => { setMode('signin'); setStatus(null) }} 
          style={{ padding: 6, fontWeight: mode === 'signin' ? 'bold' : 'normal' }}
        >
          {mode === 'signin' ? '•' : ' '} Sign In
        </button>
        <button 
          type="button" 
          onClick={() => { setMode('signup'); setStatus(null) }} 
          style={{ padding: 6, fontWeight: mode === 'signup' ? 'bold' : 'normal' }}
        >
          {mode === 'signup' ? '•' : ' '} Sign Up
        </button>
      </div>

      {/* Google Sign In Button */}
      {googleAvailable && mode === 'signin' && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            style={{
              padding: "8px 16px",
              width: "100%",
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      )}

      {/* Auth Method Toggle (only for sign in) */}
      {mode === 'signin' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          {emailAvailable !== false && (
            <button type="button" onClick={() => setAuthMethod('email')} style={{ padding: 6, fontSize: "12px" }}>
              {authMethod === 'email' ? '•' : ' '} Email link
            </button>
          )}
          <button type="button" onClick={() => setAuthMethod('credentials')} style={{ padding: 6, fontSize: "12px" }}>
            {authMethod === 'credentials' ? '•' : ' '} Username/Password
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mode === 'signup' ? (
          <>
            <input 
              aria-label="name" 
              placeholder="Name (optional)" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }} 
            />
            <input 
              aria-label="email" 
              placeholder="Email *" 
              type="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }} 
            />
            <input 
              aria-label="password" 
              placeholder="Password (min 8 characters) *" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
              minLength={8}
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }} 
            />
            <button type="submit" style={{ padding: "8px 16px", background: "#4f46e5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Create Account
            </button>
          </>
        ) : authMethod === 'email' ? (
          <>
            <input 
              aria-label="email" 
              placeholder="Email" 
              type="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }} 
            />
            <button type="submit" style={{ padding: "8px 16px", background: "#4f46e5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Send sign-in link
            </button>
          </>
        ) : (
          <>
            <input 
              aria-label="username" 
              placeholder="Username or Email" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }} 
            />
            <input 
              aria-label="password" 
              placeholder="Password" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }} 
            />
            <button type="submit" style={{ padding: "8px 16px", background: "#4f46e5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Sign in
            </button>
          </>
        )}
        {status && (
          <div style={{ 
            padding: "8px", 
            borderRadius: "4px", 
            background: status.includes('failed') || status.includes('error') ? "#fee2e2" : "#d1fae5",
            color: status.includes('failed') || status.includes('error') ? "#991b1b" : "#065f46",
            fontSize: "14px"
          }}>
            {status}
          </div>
        )}
      </form>
    </div>
  )
}
