/**
 * Wordisbond API - Cloudflare Workers
 * 
 * Edge-native API layer using Hono framework
 * Replaces Next.js API routes for Cloudflare Workers deployment
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

// Route modules
import { healthRoutes } from './routes/health'
import { callsRoutes } from './routes/calls'
import { authRoutes } from './routes/auth'
import { webhooksRoutes } from './routes/webhooks'
import { organizationsRoutes } from './routes/organizations'
import { bookingsRoutes } from './routes/bookings'
import { userRoutes as usersRoutes } from './routes/users'
import { recordingsRoutes } from './routes/recordings'
import { auditRoutes } from './routes/audit'
import { webrtcRoutes } from './routes/webrtc'
import { handleScheduled } from './scheduled'
import { scorecardsRoutes } from './routes/scorecards'
import { rbacRoutes } from './routes/rbac'
import { analyticsRoutes } from './routes/analytics'
import { campaignsRoutes } from './routes/campaigns'
import { voiceRoutes } from './routes/voice'
import { callCapabilitiesRoutes } from './routes/call-capabilities'

// Types for Cloudflare bindings
export interface Env {
  // Hyperdrive (Neon Postgres)
  HYPERDRIVE: Hyperdrive
  
  // KV Namespace
  KV: KVNamespace
  
  // R2 Bucket
  R2: R2Bucket
  
  // Environment variables
  NODE_ENV: string
  CORS_ORIGIN: string
  
  // Secrets
  NEON_PG_CONN: string
  AUTH_SECRET: string
  OPENAI_API_KEY: string
  RESEND_API_KEY: string
  STRIPE_SECRET_KEY: string
  TELNYX_API_KEY: string
  TELNYX_CONNECTION_ID: string
  TELNYX_NUMBER: string
  ASSEMBLYAI_API_KEY: string
  ELEVENLABS_API_KEY: string
  NEXT_PUBLIC_APP_URL?: string
}

// Create Hono app with typed bindings
const app = new Hono<{ Bindings: Env }>()

// Global middleware
app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: (origin, c) => {
    // Allow configured origin, localhost for dev, and Cloudflare Pages preview URLs
    const allowed = [
      c.env.CORS_ORIGIN,
      'https://wordis-bond.com',
      'https://www.wordis-bond.com',
      'https://voxsouth.online',
      'https://www.voxsouth.online',
      'https://wordisbond.pages.dev',
      'http://localhost:3000',
    ]
    
    // Also allow any *.wordisbond.pages.dev preview URLs
    if (origin && origin.endsWith('.wordisbond.pages.dev')) {
      return origin
    }
    
    return allowed.includes(origin) ? origin : allowed[0]
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}))

// Mount route modules
app.route('/health', healthRoutes)
app.route('/api/health', healthRoutes)
app.route('/api/calls', callsRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/organizations', organizationsRoutes)
app.route('/api/bookings', bookingsRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/recordings', recordingsRoutes)
app.route('/api/audit-logs', auditRoutes)  // Mount audit routes at /api/audit-logs
app.route('/api/webrtc', webrtcRoutes)  // Mount webrtc routes at /api/webrtc
app.route('/webhooks', webhooksRoutes)
app.route('/api/webhooks', webhooksRoutes)  // Also mount at /api/webhooks
app.route('/api/scorecards', scorecardsRoutes)
app.route('/api/rbac', rbacRoutes)
app.route('/api/analytics', analyticsRoutes)
app.route('/api/campaigns', campaignsRoutes)
app.route('/api/voice', voiceRoutes)
app.route('/api/call-capabilities', callCapabilitiesRoutes)

// Root endpoint
app.get('/', (c) => {
  return c.json({
    service: 'wordisbond-api',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
  })
})

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    path: c.req.path,
    method: c.req.method,
  }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('API Error:', {
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  })
  
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    path: c.req.path,
  }, 500)
})

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  
  // Scheduled handler for cron triggers
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event, env))
  },
}
