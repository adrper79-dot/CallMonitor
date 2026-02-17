/**
 * Consent Records Routes
 *
 * Manages consent evidence chain — replaces scattered flags with proper
 * auditable records for TCPA/FDCPA compliance.
 *
 * Endpoints:
 *   GET    /               - List consent records for account or org
 *   POST   /               - Record a consent event
 *   POST   /revoke         - Revoke consent (creates revocation record + updates account)
 *   GET    /account/:id    - Get consent timeline for specific account
 *   GET    /check/:id      - Quick consent status check for pre-dial
 *
 * @see ARCH_DOCS/08-COMPLIANCE/TCPA_COMPLIANCE.md
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { collectionsRateLimit } from '../lib/rate-limit'

export const consentRoutes = new Hono<AppEnv>()

const VALID_EVENT_TYPES = ['granted', 'revoked', 'renewed', 'expired', 'verbal_yes', 'written', 'ivr_confirm', 'dtmf_confirm']
const VALID_CONSENT_TYPES = ['call_recording', 'outbound_contact', 'sms_contact', 'email_contact', 'payment_processing', 'data_sharing']
const VALID_SOURCES = ['inbound_call', 'outbound_call', 'web_form', 'written_letter', 'agent_entry', 'ivr', 'api', 'import']

// ─── GET / ─── List consent records ────────────────────────────────────────────
consentRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const offset = parseInt(c.req.query('offset') || '0')
    const accountId = c.req.query('account_id')
    const consentType = c.req.query('consent_type')
    const eventType = c.req.query('event_type')

    let query = `
      SELECT cr.*,
        ca.debtor_name, ca.account_number,
        u.name as created_by_name
      FROM consent_records cr
      LEFT JOIN collection_accounts ca ON cr.account_id = ca.id
      LEFT JOIN users u ON cr.created_by::uuid = u.id
      WHERE cr.organization_id = $1`
    const params: any[] = [session.organization_id]

    if (accountId) {
      params.push(accountId)
      query += ` AND cr.account_id = $${params.length}`
    }
    if (consentType && VALID_CONSENT_TYPES.includes(consentType)) {
      params.push(consentType)
      query += ` AND cr.consent_type = $${params.length}`
    }
    if (eventType && VALID_EVENT_TYPES.includes(eventType)) {
      params.push(eventType)
      query += ` AND cr.event_type = $${params.length}`
    }

    query += ` ORDER BY cr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    return c.json({
      success: true,
      records: result.rows,
      total: result.rows.length,
      limit,
      offset,
    })
  } catch (err: any) {
    logger.error('GET /api/consent error', { error: err?.message })
    return c.json({ success: true, records: [], total: 0 })
  } finally {
    await db.end()
  }
})

// ─── POST / ─── Record a consent event ─────────────────────────────────────────
consentRoutes.post('/', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    account_id: string
    call_id?: string | null
    event_type: string
    consent_type: string
    source: string
    evidence_reference?: string
    notes?: string
    expires_at?: string
  }>()

  if (!body.account_id || !body.event_type || !body.consent_type || !body.source) {
    return c.json({ error: 'account_id, event_type, consent_type, and source are required' }, 400)
  }
  if (!VALID_EVENT_TYPES.includes(body.event_type)) {
    return c.json({ error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` }, 400)
  }
  if (!VALID_CONSENT_TYPES.includes(body.consent_type)) {
    return c.json({ error: `Invalid consent_type. Must be one of: ${VALID_CONSENT_TYPES.join(', ')}` }, 400)
  }
  if (!VALID_SOURCES.includes(body.source)) {
    return c.json({ error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` }, 400)
  }

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `INSERT INTO consent_records (
        organization_id, account_id, call_id, event_type, consent_type, source,
        evidence_reference, notes, expires_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        session.organization_id,
        body.account_id,
        body.call_id || null,
        body.event_type,
        body.consent_type,
        body.source,
        body.evidence_reference || null,
        body.notes?.trim() || null,
        body.expires_at || null,
        session.user_id,
      ]
    )

    // If granting outbound_contact consent, update account consent_status
    if (['granted', 'verbal_yes', 'written', 'ivr_confirm', 'dtmf_confirm', 'renewed'].includes(body.event_type)
        && body.consent_type === 'outbound_contact') {
      try {
        await db.query(
          `UPDATE collection_accounts SET consent_status = 'verified', updated_at = NOW()
           WHERE id = $1 AND organization_id = $2`,
          [body.account_id, session.organization_id]
        )
      } catch { /* best-effort sync */ }
    }

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.CONSENT_RECORDED,
      resourceType: 'consent_record',
      resourceId: result.rows[0].id,
      oldValue: null,
      newValue: result.rows[0],
    }).catch(() => {})

    logger.info('Consent recorded', {
      recordId: result.rows[0].id,
      accountId: body.account_id,
      eventType: body.event_type,
      consentType: body.consent_type,
    })

    return c.json({ success: true, record: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/consent error', { error: err.message })
    return c.json({ error: 'Failed to record consent' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /revoke ─── Revoke consent ───────────────────────────────────────────
consentRoutes.post('/revoke', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    account_id: string
    consent_type: string
    source: string
    reason?: string
    call_id?: string
  }>()

  if (!body.account_id || !body.consent_type || !body.source) {
    return c.json({ error: 'account_id, consent_type, and source are required' }, 400)
  }

  const db = getDb(c.env, session.organization_id)
  try {
    // Record the revocation event
    const result = await db.query(
      `INSERT INTO consent_records (
        organization_id, account_id, call_id, event_type, consent_type, source,
        notes, created_by
      ) VALUES ($1, $2, $3, 'revoked', $4, $5, $6, $7)
      RETURNING *`,
      [
        session.organization_id,
        body.account_id,
        body.call_id || null,
        body.consent_type,
        body.source,
        body.reason?.trim() || 'Consumer revoked consent',
        session.user_id,
      ]
    )

    // Update account consent_status to 'revoked'
    if (body.consent_type === 'outbound_contact') {
      await db.query(
        `UPDATE collection_accounts SET consent_status = 'revoked', updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [body.account_id, session.organization_id]
      )
    }

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.CONSENT_REVOKED,
      resourceType: 'consent_record',
      resourceId: result.rows[0].id,
      oldValue: null,
      newValue: result.rows[0],
    }).catch(() => {})

    logger.info('Consent revoked', {
      recordId: result.rows[0].id,
      accountId: body.account_id,
      consentType: body.consent_type,
    })

    return c.json({ success: true, record: result.rows[0], consent_revoked: true }, 201)
  } catch (err: any) {
    logger.error('POST /api/consent/revoke error', { error: err.message })
    return c.json({ error: 'Failed to revoke consent' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /account/:id ─── Consent timeline for an account ──────────────────────
consentRoutes.get('/account/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')

    const result = await db.query(
      `SELECT cr.*, u.name as created_by_name
       FROM consent_records cr
       LEFT JOIN users u ON cr.created_by::uuid = u.id
       WHERE cr.account_id = $1 AND cr.organization_id = $2
       ORDER BY cr.created_at DESC`,
      [accountId, session.organization_id]
    )

    // Compute current effective consent status per type
    const statusByType: Record<string, { status: string; last_event: string; last_date: string }> = {}
    for (const consentType of VALID_CONSENT_TYPES) {
      const latest = result.rows.find((r: any) => r.consent_type === consentType)
      if (latest) {
        const isGranted = ['granted', 'verbal_yes', 'written', 'ivr_confirm', 'dtmf_confirm', 'renewed'].includes(latest.event_type)
        statusByType[consentType] = {
          status: isGranted ? 'active' : latest.event_type === 'expired' ? 'expired' : 'revoked',
          last_event: latest.event_type,
          last_date: latest.created_at,
        }
      }
    }

    return c.json({
      success: true,
      account_id: accountId,
      timeline: result.rows,
      current_status: statusByType,
      total: result.rows.length,
    })
  } catch (err: any) {
    logger.error('GET /api/consent/account/:id error', { error: err?.message })
    return c.json({ success: true, timeline: [], current_status: {}, total: 0 })
  } finally {
    await db.end()
  }
})

// ─── GET /check/:id ─── Quick consent check (for pre-dial) ────────────────────
consentRoutes.get('/check/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')
    const consentType = c.req.query('type') || 'outbound_contact'

    // Get latest consent record for this account + type
    const result = await db.query(
      `SELECT event_type, created_at, expires_at
       FROM consent_records
       WHERE account_id = $1 AND organization_id = $2 AND consent_type = $3
       ORDER BY created_at DESC LIMIT 1`,
      [accountId, session.organization_id, consentType]
    )

    if (result.rows.length === 0) {
      // Fall back to account-level consent_status
      const acctResult = await db.query(
        `SELECT consent_status FROM collection_accounts WHERE id = $1 AND organization_id = $2`,
        [accountId, session.organization_id]
      )
      const status = acctResult.rows[0]?.consent_status || 'unknown'
      return c.json({
        success: true,
        account_id: accountId,
        consent_type: consentType,
        has_consent: status === 'verified',
        status,
        source: 'account_flag',
      })
    }

    const record = result.rows[0]
    const isGranted = ['granted', 'verbal_yes', 'written', 'ivr_confirm', 'dtmf_confirm', 'renewed'].includes(record.event_type)
    const isExpired = record.expires_at && new Date(record.expires_at) < new Date()

    return c.json({
      success: true,
      account_id: accountId,
      consent_type: consentType,
      has_consent: isGranted && !isExpired,
      status: isExpired ? 'expired' : isGranted ? 'active' : 'revoked',
      last_event: record.event_type,
      last_date: record.created_at,
      source: 'consent_record',
    })
  } catch (err: any) {
    logger.error('GET /api/consent/check/:id error', { error: err?.message })
    // On error, default to unknown (pre-dial checker handles this)
    return c.json({ success: true, has_consent: false, status: 'unknown', source: 'error' })
  } finally {
    await db.end()
  }
})
