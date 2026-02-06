/**
 * Wordisbond API - Cloudflare Workers
 * 
 * Edge-native API layer using Hono framework
 * Replaces Next.js API routes for Cloudflare Workers deployment
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
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
import { rbacRoutes } from './routes/rbac-v2'
import { analyticsRoutes } from './routes/analytics'
import { bondAiRoutes } from './routes/bond-ai'
import { teamsRoutes } from './routes/teams'
import { campaignsRoutes } from './routes/campaigns'
import { voiceRoutes } from './routes/voice'
import { callCapabilitiesRoutes } from './routes/call-capabilities'
import { billingRoutes } from './routes/billing'
import { surveysRoutes } from './routes/surveys'
import { callerIdRoutes } from './routes/caller-id'
import { aiConfigRoutes } from './routes/ai-config'
import { teamRoutes } from './routes/team'
import { usageRoutes } from './routes/usage'
import { shopperRoutes } from './routes/shopper'
import { testRoutes } from './routes/test'
import {
  buildErrorContext, logError, formatErrorResponse, isAppError,
  generateCorrelationId,
} from './lib/errors'

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
  STRIPE_WEBHOOK_SECRET: string
  TELNYX_WEBHOOK_SECRET: string
  NEXT_PUBLIC_APP_URL?: string
}

// Create Hono app with typed bindings
const app = new Hono<{ Bindings: Env }>()

// Global middleware
// Note: Hono logger() removed — it logged all requests to console including auth headers
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
app.route('/api/audit', auditRoutes)       // Alias: frontend also calls /api/audit
app.route('/api/webrtc', webrtcRoutes)  // Mount webrtc routes at /api/webrtc
app.route('/webhooks', webhooksRoutes)
app.route('/api/webhooks', webhooksRoutes)  // Also mount at /api/webhooks
app.route('/api/scorecards', scorecardsRoutes)
app.route('/api/rbac', rbacRoutes)
app.route('/api/analytics', analyticsRoutes)
app.route('/api/campaigns', campaignsRoutes)
app.route('/api/voice', voiceRoutes)
app.route('/api/call-capabilities', callCapabilitiesRoutes)
app.route('/api/billing', billingRoutes)
app.route('/api/surveys', surveysRoutes)
app.route('/api/caller-id', callerIdRoutes)
app.route('/api/ai-config', aiConfigRoutes)
app.route('/api/team', teamRoutes)
app.route('/api/teams', teamsRoutes)
app.route('/api/bond-ai', bondAiRoutes)
app.route('/api/usage', usageRoutes)
app.route('/api/shopper', shopperRoutes)
app.route('/api/test', testRoutes)

// Request timing middleware — attaches start time for error diagnostics
app.use('*', async (c, next) => {
  c.set('requestStart' as any, Date.now())
  c.set('correlationId' as any, generateCorrelationId())
  await next()
})

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

// Structured Error Handler — best-practice diagnostics with differential data
app.onError((err, c) => {
  const requestStart = (c as any).get?.('requestStart') || Date.now()
  const correlationId = (c as any).get?.('correlationId') || generateCorrelationId()

  // Build full diagnostic context
  const errorCtx = buildErrorContext(c as any, err, requestStart)
  errorCtx.correlation_id = correlationId

  // Structured log for Workers logs / wrangler tail / log aggregation
  logError(errorCtx)

  // Determine HTTP status
  const status = isAppError(err) ? (err as any).status : 500

  // Format client response (sanitized — no stack traces in production)
  const { body } = formatErrorResponse(errorCtx, status)
  return c.json(body, status)
})

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  
  // Scheduled handler for cron triggers
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event, env))
  },
}
