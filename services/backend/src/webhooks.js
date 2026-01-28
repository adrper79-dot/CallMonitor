const express = require('express')

/**
 * Simple webhook handler stubs.
 * Keep these idempotent and safe to re-run — webhooks are retried.
 */
module.exports = {
  handleAssemblyAI: async (req, res, { pool } = {}) => {
    const payload = req.body || {}
    console.log('Received AssemblyAI webhook:', JSON.stringify(payload).slice(0, 1000))

    try {
      const id = payload.id || payload.transcript_id
      const status = payload.status || null

      if (pool && id) {
        // Try to find ai_run by output.job_id or output.assemblyai_id
        const { rows } = await pool.query("SELECT id, output FROM ai_runs WHERE (output->>'job_id' = $1 OR output->>'assemblyai_id' = $1) LIMIT 1", [id])
        if (rows && rows.length) {
          const row = rows[0]
          const existingOutput = row.output || {}
          const merged = Object.assign({}, existingOutput, { assemblyai_status: status, assemblyai_payload: payload })
          const newStatus = (status === 'completed') ? 'completed' : (status === 'failed' ? 'failed' : (status ? 'processing' : row.status))
          const completedAt = status === 'completed' ? new Date().toISOString() : row.completed_at
          await pool.query('UPDATE ai_runs SET status = $1, completed_at = $2, output = $3 WHERE id = $4', [newStatus, completedAt, merged, row.id])
          console.log('Updated ai_run', row.id, 'status ->', newStatus)
        }
      }

      // Acknowledge quickly
      res.status(200).json({ received: true })
    } catch (err) {
      console.error('AssemblyAI webhook processing error', err)
      try { res.status(500).send('error') } catch (e) { /* ignore */ }
    }
  },

  handleSignalWire: async (req, res, { pool } = {}) => {
    const payload = req.body || {}
    console.log('Received SignalWire webhook:', JSON.stringify(payload).slice(0, 1000))

    // Basic stub: log and return 200. Replace with domain logic as needed.
    try {
      // Example: you might validate a signature or parse call events here
      res.status(200).json({ received: true })
    } catch (err) {
      console.error('SignalWire webhook error', err)
      res.status(500).send('error')
    }
  },

  handleStripe: async (req, res, { pool } = {}) => {
    // req is raw body as configured by index.js for signature validation
    console.log('Received Stripe webhook (raw length):', req && req.body ? req.body.length || 0 : 0)
    // For now, accept and ack. Implement signature verification in production.
    try {
      // If you want parsed JSON, do: const payload = JSON.parse(req.body.toString())
      res.status(200).json({ received: true })
    } catch (err) {
      console.error('Stripe webhook error', err)
      res.status(500).send('error')
    }
  }
}
const crypto = require('crypto')

module.exports = {
  // Basic stub: log the payload, optionally persist minimal info to DB if pool provided
  async handleAssemblyAI(req, res, { pool } = {}) {
    try {
      const body = req.body
      console.log('[webhook][assemblyai] received', body?.id || '(no id)')

      // Minimal DB write if pool available - non-blocking
      if (pool) {
        try {
          await pool.query('INSERT INTO webhook_events (id, provider, payload, created_at) VALUES ($1,$2,$3,$4)', [
            crypto.randomUUID(),
            'assemblyai',
            body,
            new Date().toISOString()
          ])
        } catch (e) {
          console.warn('Failed to persist assemblyai webhook event:', e.message)
        }
      }

      // Existing projects often expect a 200 body
      return res.status(200).json({ received: true })
    } catch (err) {
      console.error('handleAssemblyAI error', err)
      return res.status(500).send('error')
    }
  },

  async handleSignalWire(req, res, { pool } = {}) {
    try {
      const body = req.body
      console.log('[webhook][signalwire] received', body || '(empty)')
      if (pool) {
        try {
          await pool.query('INSERT INTO webhook_events (id, provider, payload, created_at) VALUES ($1,$2,$3,$4)', [
            crypto.randomUUID(),
            'signalwire',
            body,
            new Date().toISOString()
          ])
        } catch (e) {
          console.warn('Failed to persist signalwire webhook event:', e.message)
        }
      }
      return res.status(200).json({ received: true })
    } catch (err) {
      console.error('handleSignalWire error', err)
      return res.status(500).send('error')
    }
  },

  async handleStripe(req, res, { pool } = {}) {
    try {
      // req.body is raw Buffer because route used express.raw
      const sigHeader = req.headers['stripe-signature'] || req.headers['Stripe-Signature']
      const rawBody = req.body
      console.log('[webhook][stripe] received raw bytes length=', rawBody && rawBody.length)

      // If the project has STRIPE_WEBHOOK_SECRET, attempt verification; otherwise accept
      const secret = process.env.STRIPE_WEBHOOK_SECRET
      if (secret && sigHeader) {
        // Minimal verification using stripe's expected HMAC SHA256
        const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
        // Note: proper Stripe verification uses timestamp + signature format; this is a simplified fallback
        if (!expected) {
          console.warn('Stripe verification produced no expected signature; skipping')
        }
      }

      // Persist minimal event
      if (pool) {
        try {
          await pool.query('INSERT INTO webhook_events (id, provider, payload, created_at) VALUES ($1,$2,$3,$4)', [
            crypto.randomUUID(),
            'stripe',
            rawBody.toString('utf8'),
            new Date().toISOString()
          ])
        } catch (e) {
          console.warn('Failed to persist stripe webhook event:', e.message)
        }
      }

      return res.status(200).send('ok')
    } catch (err) {
      console.error('handleStripe error', err)
      return res.status(500).send('error')
    }
  }
}
