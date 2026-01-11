"use client"
import React, { useState } from "react"

export default function UnlockForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("working")
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        sessionStorage.setItem("unlocked", "true")
        setStatus("unlocked")
        // notify any listeners
        window.dispatchEvent(new CustomEvent("unlocked"))
      } else {
        const text = await res.text()
        setStatus(text || "failed")
      }
    } catch (err) {
      setStatus("error")
    }
  }

  // If already unlocked, show simple indicator
  if (typeof window !== "undefined" && sessionStorage.getItem("unlocked") === "true") {
    return (
      <div style={{ padding: 8, background: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
        Signed in
      </div>
    )
  }

  return (
    <div style={{ padding: 8, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          aria-label="username"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: "6px 8px" }}
        />
        <input
          aria-label="password"
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "6px 8px" }}
        />
        <button type="submit" style={{ padding: "6px 10px" }}>
          Sign in
        </button>
        {status && <span style={{ marginLeft: 8 }}>{status}</span>}
      </form>
    </div>
  )
}
