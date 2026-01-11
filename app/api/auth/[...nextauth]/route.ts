import NextAuth from "next-auth"
import EmailProvider from "next-auth/providers/email"

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
