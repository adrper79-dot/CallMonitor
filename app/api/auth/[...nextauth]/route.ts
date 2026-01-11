import NextAuth from "next-auth"
import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"
import { createClient } from '@supabase/supabase-js'
import { SupabaseAdapter } from '@next-auth/supabase-adapter'

async function sendViaResend(to: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || `no-reply@${process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '')}`,
      to: [to],
      subject: 'Your sign-in link',
      html,
    }),
  })
  if (!res.ok) throw new Error(`Resend API error: ${res.status} ${await res.text()}`)
}

// Lazily configure Supabase adapter (avoid failing at build-time when env missing)
let adapter: any = undefined
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabaseForAdapter = createClient(String(process.env.SUPABASE_URL), String(process.env.SUPABASE_SERVICE_ROLE_KEY))
    adapter = SupabaseAdapter(supabaseForAdapter as any)
  }
} catch (e) {

    // runtime diagnostic: whether Email provider is enabled (no secrets logged)
    // eslint-disable-next-line no-console
    console.info(`[next-auth] Email provider ${adapter ? 'registered' : 'not registered'}; adapterPresent=${Boolean(adapter)}`)
  // don't throw during build; runtime will surface adapter issues
  // eslint-disable-next-line no-console
  console.error('Failed to initialize Supabase adapter for NextAuth', e)
}

const providers: any[] = []
// Always include credentials provider
providers.push(CredentialsProvider({
  name: 'Credentials',
  credentials: {
    username: { label: 'Username or Email', type: 'text' },
    password: { label: 'Password', type: 'password' }
  },
  async authorize(credentials) {
    if (!credentials || !credentials.username || !credentials.password) return null
    // Rate limiting by username (lowercased). This prevents brute-force attempts.
    const key = String(credentials.username).toLowerCase()
    // Initialize limiter store on first use
    if (!(global as any).__loginRateLimiter) (global as any).__loginRateLimiter = new Map()
    const limiter: Map<string, any> = (global as any).__loginRateLimiter
    const MAX_ATTEMPTS = 5
    const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
    const BLOCK_MS = 15 * 60 * 1000 // 15 minutes

    function now() { return Date.now() }

    const entry = limiter.get(key) || { attempts: [] as number[], blockedUntil: 0 }
    // purge old attempts
    entry.attempts = entry.attempts.filter((t: number) => t > now() - WINDOW_MS)
    if (entry.blockedUntil && entry.blockedUntil > now()) {
      // temporarily blocked
      return null
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase not configured for credentials login')
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ email: credentials.username, password: credentials.password })
    })
    if (!res.ok) {
      // record failed attempt
      entry.attempts.push(now())
      if (entry.attempts.length >= MAX_ATTEMPTS) {
        entry.blockedUntil = now() + BLOCK_MS
      }
      limiter.set(key, entry)
      return null
    }
    const data = await res.json()
    const user = data?.user ?? null
    if (!user) {
      entry.attempts.push(now())
      if (entry.attempts.length >= MAX_ATTEMPTS) entry.blockedUntil = now() + BLOCK_MS
      limiter.set(key, entry)
      return null
    }
    // success: clear attempts
    limiter.delete(key)
    return { id: user.id, name: user.email, email: user.email }
  }
}))

// Only include Email provider if adapter is present (NextAuth requires adapter for Email)
if (adapter) {
  providers.push(EmailProvider({
    // Implement custom sender via Resend HTTP API (no SDK required)
    async sendVerificationRequest({ identifier: email, url }) {
      const html = `<p>Sign in to the app with this link:</p><p><a href="${url}">${url}</a></p>`
      await sendViaResend(email, html)
    },
    server: undefined,
  }))
}

const authOptions = {
  ...(adapter ? { adapter } : {}),
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  // Use default session strategy (JWT) unless adapter is configured
}

const handler = NextAuth(authOptions as any)

export { handler as GET, handler as POST }
