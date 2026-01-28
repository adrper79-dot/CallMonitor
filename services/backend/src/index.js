const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { Pool } = require('pg')
const { v4: uuidv4 } = require('uuid')
require('dotenv').config()

const app = express()
// Security middlewares
app.use(helmet())

// CORS: allow configured frontend origin or allow all in local/dev
const frontendOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || '*'
const corsOptions = {
  origin: frontendOrigin === '*' ? true : frontendOrigin,
  credentials: true,
}
app.use(cors(corsOptions))

// Body parsers with limits to avoid large requests
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// Rate limiting for API routes (basic protection)
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 })
app.use('/api/', apiLimiter)

const PORT = process.env.PORT || 8080
const connectionString = process.env.NEON_PG_CONN || process.env.PG_CONN || process.env.DATABASE_URL

const pool = connectionString ? new Pool({ connectionString }) : null

app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid })
})

// Root - quick human-friendly landing for local testing
app.get('/', (req, res) => {
  res.type('text').send('Backend is running. See /health and /api/* endpoints.')
})

// Mount webhook handlers (simple stubs implemented in webhooks.js)
const webhooks = require('./webhooks')
const integrations = require('./integrations')
const authOps = require('./auth_ops')
const subscriptions = require('./subscriptions')
const nextAuthHandler = require('./nextauth')

// AssemblyAI posts JSON webhooks
app.post('/api/webhooks/assemblyai', express.json(), async (req, res) => {
  try {
    await webhooks.handleAssemblyAI(req, res, { pool })
  } catch (err) {
    console.error('assemblyai webhook handler error', err)
    res.status(500).send('handler error')
  }
})

// SignalWire webhook (JSON)
app.post('/api/webhooks/signalwire', express.json(), async (req, res) => {
  try {
    await webhooks.handleSignalWire(req, res, { pool })
  } catch (err) {
    console.error('signalwire webhook handler error', err)
    res.status(500).send('handler error')
  }
})

// Stripe requires the raw body for signature verification; accept raw JSON here
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  try {
    await webhooks.handleStripe(req, res, { pool })
  } catch (err) {
    console.error('stripe webhook handler error', err)
    res.status(500).send('handler error')
  }
})

// Example: GET /api/attention/events
app.get('/api/attention/events', async (req, res) => {
  if (!pool) return res.status(500).json({ success: false, error: 'No DB configured' })
  try {
    const { rows } = await pool.query(`SELECT ae.*, ad.id as decision_id, ad.decision as decision_decision, ad.reason as decision_reason FROM attention_events ae LEFT JOIN LATERAL ( SELECT * FROM attention_decisions ad WHERE ad.attention_event_id = ae.id ORDER BY ad.created_at DESC LIMIT 1 ) ad ON true WHERE ae.organization_id = $1 ORDER BY ae.occurred_at DESC LIMIT $2`, [req.query.orgId || null, Math.min(parseInt(req.query.limit || '50'), 100)])
    res.json({ success: true, events: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: 'DB query failed' })
  }
})

// Example: POST /api/attention/decisions/:id/override
app.post('/api/attention/decisions/:id/override', async (req, res) => {
  if (!pool) return res.status(500).json({ success: false, error: 'No DB configured' })
  const eventId = req.params.id
  const { decision, reason, orgId, userId } = req.body
  if (!decision || !reason || !orgId || !userId) return res.status(400).json({ success: false, error: 'decision, reason, orgId, userId required' })
  try {
    const decisionId = uuidv4()
    await pool.query(`INSERT INTO attention_decisions (id, organization_id, attention_event_id, decision, reason, created_at, produced_by_user_id, produced_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [decisionId, orgId, eventId, decision, reason, new Date().toISOString(), userId, 'human'])
    res.json({ success: true, decision_id: decisionId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: 'Insert failed' })
  }
})

// GET /api/audio/status/:id - Poll transcription status for manual audio uploads
app.get('/api/audio/status/:id', async (req, res) => {
  if (!pool) return res.status(500).json({ success: false, error: 'No DB configured' })
  const id = req.params.id
  try {
    const { rows } = await pool.query('SELECT id, status, output, completed_at FROM ai_runs WHERE id = $1 LIMIT 1', [id])
    const aiRun = rows && rows.length ? rows[0] : null
    if (!aiRun) return res.status(404).json({ success: false, error: 'Transcript not found' })

    const output = aiRun.output || null
    const response = { id: aiRun.id, status: aiRun.status }
    if (aiRun.status === 'completed' && output && output.transcript) {
      response.transcript = typeof output.transcript === 'string' ? output.transcript : (output.transcript.text || JSON.stringify(output.transcript))
      response.confidence = output.transcript?.confidence
      response.completed_at = aiRun.completed_at
    }
    if (aiRun.status === 'failed' && output?.error) {
      response.error = typeof output.error === 'string' ? output.error : JSON.stringify(output.error)
    }

    return res.json(response)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, error: 'Failed to fetch status' })
  }
})

// POST /api/audio/upload - submit a transcript job to AssemblyAI and create ai_run record
app.post('/api/audio/upload', async (req, res) => {
  if (!pool) return res.status(500).json({ success: false, error: 'No DB configured' })
  try {
    const { audio_url, filename, organization_id } = req.body
    if (!audio_url) return res.status(400).json({ success: false, error: 'Missing audio_url' })

    const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyAIKey) return res.status(503).json({ success: false, error: 'AssemblyAI not configured' })

    const transcriptId = uuidv4()
    // insert ai_run record
    const startedAt = new Date().toISOString()
    const outputObj = { filename, audio_url, organization_id }
    await pool.query('INSERT INTO ai_runs (id, call_id, system_id, model, status, started_at, produced_by, is_authoritative, output) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [transcriptId, null, null, 'assemblyai-upload', 'pending', startedAt, 'model', true, outputObj])

    // submit to AssemblyAI
    const webhookBase = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_APP_URL || ''
    const webhookUrl = webhookBase ? `${webhookBase.replace(/\/$/, '')}/api/webhooks/assemblyai` : undefined
    const body = { audio_url, language_detection: true }
    if (webhookUrl) body.webhook_url = webhookUrl

    const uploadResp = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { 'Authorization': assemblyAIKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!uploadResp.ok) {
      const err = await uploadResp.json().catch(() => ({}))
      console.error('AssemblyAI error', err)
      await pool.query('UPDATE ai_runs SET status = $1, completed_at = $2, output = $3 WHERE id = $4', ['failed', new Date().toISOString(), { ...outputObj, error: err.error || 'AssemblyAI submission failed' }, transcriptId])
      return res.status(500).json({ success: false, error: 'Transcription submission failed' })
    }

    const uploadData = await uploadResp.json()
    await pool.query('UPDATE ai_runs SET status = $1, output = $2 WHERE id = $3', ['processing', { ...outputObj, job_id: uploadData.id, assemblyai_status: uploadData.status }, transcriptId])

    return res.json({ success: true, transcript_id: transcriptId, assemblyai_id: uploadData.id, status: 'processing' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, error: 'Upload failed' })
  }
})

// Integrations callbacks
app.get('/api/integrations/hubspot/callback', async (req, res) => {
  try {
    await integrations.handleHubspotCallback(req, res, { pool })
  } catch (err) {
    console.error('hubspot callback error', err)
    res.status(500).send('error')
  }
})

app.get('/api/integrations/salesforce/callback', async (req, res) => {
  try {
    await integrations.handleSalesforceCallback(req, res, { pool })
  } catch (err) {
    console.error('salesforce callback error', err)
    res.status(500).send('error')
  }
})

// Auth server ops
app.post('/api/auth/signup', async (req, res) => {
  try {
    await authOps.handleSignup(req, res, { pool })
  } catch (err) {
    console.error('signup error', err)
    res.status(500).json({ success: false })
  }
})

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    await authOps.handleForgotPassword(req, res, { pool })
  } catch (err) {
    console.error('forgot-password error', err)
    res.status(500).json({ success: false })
  }
})

// Auth endpoints (delegate to Auth.js handler)
app.all('/api/auth/:path*', async (req, res) => {
  try {
    await nextAuthHandler(req, res, { pool })
  } catch (err) {
    console.error('auth handler error', err)
    res.status(500).send('error')
  }
})

// Subscriptions (reliability/webhook subscriptions)
app.get('/api/webhooks/subscriptions', async (req, res) => {
  try {
    await subscriptions.listSubscriptions(req, res, { pool })
  } catch (err) {
    console.error('list subscriptions error', err)
    res.status(500).json({ success: false })
  }
})

app.post('/api/webhooks/subscriptions', async (req, res) => {
  try {
    await subscriptions.createSubscription(req, res, { pool })
  } catch (err) {
    console.error('create subscription error', err)
    res.status(500).json({ success: false })
  }
})

// Bind to 0.0.0.0 to ensure listening on both IPv4 and IPv6 interfaces locally
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on http://0.0.0.0:${PORT}`)
})
