"use client"
import React, { useEffect, useState } from 'react'

type Status = {
  ok: boolean
  adapterEnv?: boolean
  resendEnv?: boolean
  nextauthSecret?: boolean
  overrides?: { emailEnabled?: boolean }
  effectiveEmailEnabled?: boolean
}

export default function AdminAuthDiagnostics() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)
  const [adminKey, setAdminKey] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/_admin/auth-providers')
      const j = await res.json()
      setStatus(j)
    } catch (e) {
      setStatus({ ok: false })
    }
  }

  useEffect(() => { load() }, [])

  async function setEmailEnabled(v: boolean | null) {
    setLoading(true)
    try {
      await fetch('/api/_admin/auth-providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminKey ? { 'x-admin-key': adminKey } : {}),
        },
        body: JSON.stringify({ emailEnabled: v }),
      })
      await load()
    } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 12, border: '1px solid #e5e7eb', background: '#fff' }}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Auth Providers Diagnostics</h3>
      <div style={{ marginBottom: 8 }}>
        <strong>Status:</strong> {status ? (status.ok ? 'ok' : 'error') : 'loading'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>Adapter env: <strong>{String(status?.adapterEnv)}</strong></div>
        <div>Resend key: <strong>{String(status?.resendEnv)}</strong></div>
        <div>NextAuth secret: <strong>{String(status?.nextauthSecret)}</strong></div>
        <div>Effective Email enabled: <strong>{String(status?.effectiveEmailEnabled)}</strong></div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>Admin key (optional):</label>
        <input value={adminKey} onChange={e => setAdminKey(e.target.value)} style={{ padding: 6, width: '100%' }} placeholder="x-admin-key if set" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setEmailEnabled(true)} disabled={loading}>Force Email ON</button>
        <button onClick={() => setEmailEnabled(false)} disabled={loading}>Force Email OFF</button>
        <button onClick={() => setEmailEnabled(null)} disabled={loading}>Clear Override</button>
        <button onClick={load} disabled={loading} style={{ marginLeft: 'auto' }}>Reload</button>
      </div>
      <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
        Note: override is stored in-memory on the running instance and is not persistent across deployments or server instances.
      </div>
    </div>
  )
}
