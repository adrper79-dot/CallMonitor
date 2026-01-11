"use client"
import React, { useState } from "react"
import { signIn, useSession } from "next-auth/react"

export default function UnlockForm() {
  const { data: session } = useSession()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    const res = await signIn('email', { email, redirect: false })
    if (res && (res as any).error) setStatus('failed')
    else setStatus('sent')
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
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          aria-label="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: "6px 8px" }}
        />
        <button type="submit" style={{ padding: "6px 10px" }}>
          Send sign-in link
        </button>
        {status && <span style={{ marginLeft: 8 }}>{status}</span>}
      </form>
    </div>
  )
}
