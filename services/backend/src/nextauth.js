const { auth } = require('@auth/core')
let PostgresAdapter
try {
  PostgresAdapter = require('@auth/pg-adapter')
} catch (e) {
  console.warn('@auth/pg-adapter not installed; adapter disabled')
}

async function buildProviders() {
  const providers = []
  // Email provider (passwordless)
  try {
    const EmailProvider = require('@auth/core/providers/email')
    if (process.env.SMTP_HOST && process.env.SMTP_FROM) {
      providers.push(EmailProvider({
        server: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        },
        from: process.env.SMTP_FROM,
      }))
    }
  } catch (e) {
    // provider not available
  }

  // Google provider
  try {
    const GoogleProvider = require('@auth/core/providers/google')
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      providers.push(GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }))
    }
  } catch (e) {}

  // GitHub provider
  try {
    const GitHubProvider = require('@auth/core/providers/github')
    if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
      providers.push(GitHubProvider({ clientId: process.env.GITHUB_ID, clientSecret: process.env.GITHUB_SECRET }))
    }
  } catch (e) {}

  return providers
}

module.exports = async function nextAuthHandler(req, res, { pool } = {}) {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT||8080}`

  const url = new URL(req.originalUrl || req.url, backendUrl)

  // Build options for Auth.js
  const options = {
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET,
    providers: await buildProviders(),
    session: { strategy: 'database' },
  }

  if (PostgresAdapter && pool) {
    try {
      options.adapter = PostgresAdapter.PostgresAdapter ? PostgresAdapter.PostgresAdapter(pool) : PostgresAdapter(pool)
    } catch (e) {
      try { options.adapter = PostgresAdapter(pool) } catch (err) { console.warn('Failed to init PostgresAdapter', err) }
    }
  }

  // Construct a Web Request for Auth.js
  const init = { method: req.method, headers: req.headers }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req
  }

  const request = new Request(url.toString(), init)

  try {
    const response = await auth({ request, ...options })

    // Forward status
    res.status(response.status || 200)

    // Forward headers
    for (const [key, value] of response.headers) {
      // Node/Express may not like multiple Set-Cookie as a single header; use append behavior
      if (key.toLowerCase() === 'set-cookie') {
        // response.headers.getAll isn't available on standard Headers; iterate values
        res.setHeader('Set-Cookie', response.headers.get(key))
      } else {
        res.setHeader(key, value)
      }
    }

    const body = await response.text()
    if (body) res.send(body)
    else res.end()
  } catch (err) {
    console.error('Auth handler error', err)
    res.status(500).json({ error: 'auth handler failed' })
  }
}
