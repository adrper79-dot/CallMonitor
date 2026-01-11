"use client"
import React, { useState } from "react"
import { signIn, useSession } from "next-auth/react"

export default function UnlockForm() {
  const { data: session } = useSession()
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [mode, setMode] = useState<'email' | 'credentials'>('email')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    if (mode === 'email') {
      const res = await signIn('email', { email, redirect: false })
      if (res && (res as any).error) setStatus('failed')
      else setStatus('sent')
    } else {
      const res = await signIn('credentials', { username: username || email, password, redirect: false })
      if (res && (res as any).error) setStatus('failed')
      else setStatus('signed-in')
    }
  }

  if (session) {
    return (
      <div style={{ padding: 8, background: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
        Signed in as {session.user?.email}
      </div>
    )
  }

  return (
    <div style={{ padding: 8, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={() => setMode('email')} style={{ padding: 6 }}>{mode === 'email' ? '•' : ' '} Email link</button>
        <button type="button" onClick={() => setMode('credentials')} style={{ padding: 6 }}>{mode === 'credentials' ? '•' : ' '} Username/Password</button>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        {mode === 'email' ? (
          <>
            <input aria-label="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: "6px 8px" }} />
            <button type="submit" style={{ padding: "6px 10px" }}>Send sign-in link</button>
          </>
        ) : (
          <>
            <input aria-label="username" placeholder="username or email" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: "6px 8px" }} />
            <input aria-label="password" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: "6px 8px" }} />
            <button type="submit" style={{ padding: "6px 10px" }}>Sign in</button>
          </>
        )}
        {status && <span style={{ marginLeft: 8 }}>{status}</span>}
      </form>
    </div>
  )
}
