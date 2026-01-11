import NextAuth from "next-auth"
import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"

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

const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username or Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials || !credentials.username || !credentials.password) return null
        const supabaseUrl = process.env.SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) throw new Error('Supabase not configured for credentials login')
        const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ email: credentials.username, password: credentials.password })
        })
        if (!res.ok) return null
        const data = await res.json()
        const user = data?.user ?? null
        if (!user) return null
        return { id: user.id, name: user.email, email: user.email }
      }
    }),
    EmailProvider({
      // Implement custom sender via Resend HTTP API (no SDK required)
      async sendVerificationRequest({ identifier: email, url }) {
        const html = `<p>Sign in to the app with this link:</p><p><a href="${url}">${url}</a></p>`
        await sendViaResend(email, html)
      },
      server: undefined,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  // Use default session strategy (JWT) unless adapter is configured
}

const handler = NextAuth(authOptions as any)

export { handler as GET, handler as POST }
