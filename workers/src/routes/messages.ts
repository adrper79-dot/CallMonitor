/**
 * Messages Routes — SMS & Email Delivery with Bulk Campaigns
 *
 * Endpoints:
 *   POST /                    - Send SMS (single or bulk)
 *   POST /email               - Send email
 *   POST /bulk                - Bulk SMS campaign send
 *   GET  /templates           - List SMS templates
 *   POST /templates           - Create SMS template
 *   PUT  /templates/:id       - Update SMS template
 *   DELETE /templates/:id     - Delete SMS template
 *   GET  /health              - Service health check
 *
 * Features:
 * - Single & bulk SMS sending via Telnyx Messaging API v2
 * - Template support with variable replacement
 * - Compliance checks (SMS consent, DNC, opt-out, time-of-day, daily limits)
 * - Multi-tenant isolation
 * - Audit logging for all sends
 * - Rate limiting
 *
 * Tables:
 * - messages (SMS/email tracking)
 * - auto_reply_templates (message templates)
 * - opt_out_requests (opt-out tracking)
 * - collection_accounts (consent management)
 *
 * @see ARCH_DOCS/02-FEATURES/OMNICHANNEL_MESSAGING.md
 * @see migrations/2026-02-14-omnichannel-messaging.sql
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { sendEmail, getEmailDefaults } from '../lib/email'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { messagesRateLimit, collectionsRateLimit } from '../lib/rate-limit'
import { validateBody } from '../lib/validate'
import { 
  SendSmsSchema, 
  BulkSmsSchema, 
  CreateSmsTemplateSchema, 
  UpdateSmsTemplateSchema 
} from '../lib/schemas'
import { 
  checkSmsCompliance, 
  bulkCheckSmsCompliance,
  isValidE164Phone,
  normalizePhoneNumber 
} from '../lib/compliance'

export const messagesRoutes = new Hono<AppEnv>()

// ─── Helper: Render Template ────────────────────────────────────────────────

/**
 * Replace template variables in message body.
 * Variables format: {{variable_name}}
 * 
 * @param template - Template string with {{variables}}
 * @param vars - Object of variable replacements
 * @returns Rendered message
 */
function renderTemplate(template: string, vars: Record<string, string>): string {
  let rendered = template

  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    rendered = rendered.replace(regex, value || '')
  }

  // Remove any unreplaced variables
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, '')

  return rendered
}

// ─── Helper: Send Single SMS via Telnyx ─────────────────────────────────────

interface SendSmsOptions {
  from: string
  to: string
  text: string
  accountId?: string
  campaignId?: string
  organizationId: string
  userId: string
  apiKey: string
  messagingProfileId?: string
  webhookUrl?: string
}

async function sendSingleSms(
  db: any,
  options: SendSmsOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { from, to, text, accountId, campaignId, organizationId, userId, apiKey, messagingProfileId, webhookUrl } = options

  try {
    // Send via Telnyx Messaging API v2
    const telnyxPayload: any = {
      from,
      to,
      text,
    }

    if (messagingProfileId) {
      telnyxPayload.messaging_profile_id = messagingProfileId
    }

    if (webhookUrl) {
      telnyxPayload.webhook_url = webhookUrl
    }

    const telnyxResponse = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telnyxPayload),
    })

    if (!telnyxResponse.ok) {
      const errorText = await telnyxResponse.text().catch(() => 'Unknown error')
      logger.error('Telnyx SMS send failed', {
        status: telnyxResponse.status,
        error: errorText.substring(0, 200),
        to,
      })

      // Store failed message in DB
      await db.query(
        `INSERT INTO messages 
         (organization_id, account_id, campaign_id, direction, channel, from_number, to_number, message_body, status, error_message, created_at)
         VALUES ($1, $2, $3, 'outbound', 'sms', $4, $5, $6, 'failed', $7, NOW())`,
        [organizationId, accountId || null, campaignId || null, from, to, text, errorText.substring(0, 500)]
      ).catch((err: any) => {
        logger.error('Failed to log SMS failure', { error: err?.message })
      })

      return { 
        success: false, 
        error: telnyxResponse.status === 429 ? 'Rate limit exceeded' : 'SMS delivery failed' 
      }
    }

    const result = await telnyxResponse.json() as { data?: { id?: string } }
    const externalMessageId = result.data?.id

    // Store message in DB
    await db.query(
      `INSERT INTO messages 
       (organization_id, account_id, campaign_id, direction, channel, from_number, to_number, message_body, status, external_message_id, sent_at, created_at)
       VALUES ($1, $2, $3, 'outbound', 'sms', $4, $5, $6, 'sent', $7, NOW(), NOW())`,
      [organizationId, accountId || null, campaignId || null, from, to, text, externalMessageId]
).catch((err: any) => {
      logger.error('Failed to log SMS send', { error: err?.message })
    })

    // Update account last_contact_at
    if (accountId) {
      await db.query(
        `UPDATE collection_accounts
         SET last_contact_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [accountId, organizationId]
      ).catch(() => {})
    }

    logger.info('SMS sent successfully', { to, messageId: externalMessageId })

    return { success: true, messageId: externalMessageId }
  } catch (error) {
    logger.error('SMS send error', { error: (error as Error)?.message, to })
    return { success: false, error: 'Internal error' }
  }
}

// ─── POST / — Send SMS (Single or Bulk) ─────────────────────────────────────

messagesRoutes.post('/', messagesRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, SendSmsSchema)
  if (!parsed.success) return parsed.response

  const { channel, to, message_body, campaign_id, account_id, template_id, template_vars, scheduled_at } = parsed.data

  if (channel !== 'sms') {
    return c.json({ error: 'Only SMS channel supported on this endpoint' }, 400)
  }

  if (!c.env.TELNYX_API_KEY) {
    logger.error('TELNYX_API_KEY not configured')
    return c.json({ error: 'SMS service not configured' }, 500)
  }

  if (!c.env.TELNYX_NUMBER) {
    logger.error('TELNYX_NUMBER not configured')
    return c.json({ error: 'SMS sender number not configured' }, 500)
  }

  const db = getDb(c.env)

  try {
    let finalMessageBody = message_body

    // Fetch template if template_id provided
    if (template_id) {
      const templateResult = await db.query(
        `SELECT message_body, variables FROM auto_reply_templates
         WHERE id = $1 AND organization_id = $2 AND is_active = true`,
        [template_id, session.organization_id]
      )

      if (templateResult.rows.length === 0) {
        return c.json({ error: 'Template not found or inactive' }, 404)
      }

      const template = templateResult.rows[0]
      finalMessageBody = renderTemplate(template.message_body, template_vars || {})

      // Fire audit log for template usage
      writeAuditLog(db, {
        organizationId: session.organization_id,
        userId: session.user_id,
        resourceType: 'templates',
        resourceId: template_id,
        action: AuditAction.SMS_TEMPLATE_USED,
        newValue: { template_id, variables: template_vars },
      }, c.env.KV)
    }

    // Handle bulk send (array of phone numbers)
    if (Array.isArray(to)) {
      const recipients = to
      const BATCH_SIZE = 50
      let sentCount = 0
      let failedCount = 0
      let skippedCount = 0
      const errors: string[] = []

      // Process in batches
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE)

        for (const phone of batch) {
          // Normalize phone number
          const normalizedPhone = normalizePhoneNumber(phone)
          if (!normalizedPhone) {
            logger.warn('Invalid phone format, skipping', { phone })
            skippedCount++
            errors.push(`Invalid phone: ${phone}`)
            continue
          }

          // Find account by phone number
          const accountResult = await db.query(
            `SELECT id FROM collection_accounts
             WHERE organization_id = $1 AND primary_phone = $2
             LIMIT 1`,
            [session.organization_id, normalizedPhone]
          )

          const foundAccountId = accountResult.rows[0]?.id

          // Run compliance check if account found
          if (foundAccountId) {
            const complianceCheck = await checkSmsCompliance(db, foundAccountId, session.organization_id)
            if (!complianceCheck.allowed) {
              logger.info('SMS blocked by compliance', {
                phone: normalizedPhone,
                reason: complianceCheck.reason,
              })

              skippedCount++

              // Log compliance block
              writeAuditLog(db, {
                organizationId: session.organization_id,
                userId: session.user_id,
                resourceType: 'messages',
                resourceId: foundAccountId,
                action: AuditAction.SMS_COMPLIANCE_BLOCKED,
                newValue: { 
                  phone: normalizedPhone, 
                  reason: complianceCheck.reason,
                  skip_reason: complianceCheck.skip_reason 
                },
              }, c.env.KV)

              continue
            }
          }

          // Send SMS
          const sendResult = await sendSingleSms(db, {
            from: c.env.TELNYX_NUMBER,
            to: normalizedPhone,
            text: finalMessageBody,
            accountId: foundAccountId,
            campaignId: campaign_id,
            organizationId: session.organization_id,
            userId: session.user_id,
            apiKey: c.env.TELNYX_API_KEY,
            messagingProfileId: c.env.TELNYX_MESSAGING_PROFILE_ID,
            webhookUrl: c.env.BASE_URL ? `${c.env.BASE_URL}/api/webhooks/telnyx` : undefined,
          })

          if (sendResult.success) {
            sentCount++
          } else {
            failedCount++
            errors.push(`Failed: ${normalizedPhone} - ${sendResult.error}`)
          }
        }
      }

      // Fire bulk send audit log
      writeAuditLog(db, {
        organizationId: session.organization_id,
        userId: session.user_id,
        resourceType: 'messages',
        resourceId: campaign_id || 'bulk',
        action: AuditAction.SMS_BULK_SENT,
        newValue: {
          total: recipients.length,
          sent: sentCount,
          failed: failedCount,
          skipped: skippedCount,
          campaign_id,
        },
      }, c.env.KV)

      logger.info('Bulk SMS completed', { 
        total: recipients.length, 
        sent: sentCount, 
        failed: failedCount, 
        skipped: skippedCount 
      })

      return c.json({
        success: true,
        summary: {
          total: recipients.length,
          sent: sentCount,
          failed: failedCount,
          skipped: skippedCount,
        },
        errors: errors.slice(0, 10), // Return first 10 errors
      })
    }

    // Single send
    const normalizedPhone = normalizePhoneNumber(to as string)
    if (!normalizedPhone) {
      return c.json({ error: 'Invalid phone number format. Use E.164 format (e.g., +15551234567)' }, 400)
    }

    // Run compliance check if account_id provided
    if (account_id) {
      const complianceCheck = await checkSmsCompliance(db, account_id, session.organization_id)
      if (!complianceCheck.allowed) {
        logger.warn('SMS blocked by compliance', {
          accountId: account_id,
          reason: complianceCheck.reason,
        })

        // Log compliance block
        writeAuditLog(db, {
          organizationId: session.organization_id,
          userId: session.user_id,
          resourceType: 'messages',
          resourceId: account_id,
          action: AuditAction.SMS_COMPLIANCE_BLOCKED,
          newValue: { 
            account_id,
            phone: normalizedPhone,
            reason: complianceCheck.reason,
            skip_reason: complianceCheck.skip_reason 
          },
        }, c.env.KV)

        return c.json({ 
          error: 'SMS send blocked by compliance rules', 
          reason: complianceCheck.reason 
        }, 403)
      }
    }

    // Send SMS
    const sendResult = await sendSingleSms(db, {
      from: c.env.TELNYX_NUMBER,
      to: normalizedPhone,
      text: finalMessageBody,
      accountId: account_id,
      campaignId: campaign_id,
      organizationId: session.organization_id,
      userId: session.user_id,
      apiKey: c.env.TELNYX_API_KEY,
      messagingProfileId: c.env.TELNYX_MESSAGING_PROFILE_ID,
      webhookUrl: c.env.BASE_URL ? `${c.env.BASE_URL}/api/webhooks/telnyx` : undefined,
    })

    if (!sendResult.success) {
      return c.json({ error: 'Failed to send SMS', details: sendResult.error }, 502)
    }

    // Fire audit log
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'messages',
      resourceId: sendResult.messageId || 'unknown',
      action: AuditAction.SMS_SENT,
      newValue: { 
        phone: normalizedPhone, 
        account_id, 
        campaign_id,
        template_id 
      },
    }, c.env.KV)

    return c.json({
      success: true,
      message_id: sendResult.messageId,
      status: 'sent',
    })
  } catch (error) {
    logger.error('SMS send error', { error: (error as Error)?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /bulk — Bulk SMS Campaign Send ────────────────────────────────────

messagesRoutes.post('/bulk', messagesRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Forbidden' }, 403)

  const parsed = await validateBody(c, BulkSmsSchema)
  if (!parsed.success) return parsed.response

  const { channel, account_ids, message_body, template_id, template_vars, campaign_id } = parsed.data

  if (channel !== 'sms') {
    return c.json({ error: 'Only SMS channel supported' }, 400)
  }

  if (!c.env.TELNYX_API_KEY || !c.env.TELNYX_NUMBER) {
    return c.json({ error: 'SMS service not configured' }, 500)
  }

  const db = getDb(c.env)

  try {
    let finalMessageBody: string = message_body || ''

    // Fetch template if provided
    if (template_id) {
      const templateResult = await db.query(
        `SELECT message_body FROM auto_reply_templates
         WHERE id = $1 AND organization_id = $2 AND is_active = true`,
        [template_id, session.organization_id]
      )

      if (templateResult.rows.length === 0) {
        return c.json({ error: 'Template not found' }, 404)
      }

      finalMessageBody = renderTemplate(templateResult.rows[0].message_body, template_vars || {})
    }

    // Ensure we have a message body
    if (!finalMessageBody) {
      return c.json({ error: 'Message body or template required' }, 400)
    }

    // Bulk compliance check
    const complianceResults = await bulkCheckSmsCompliance(db, account_ids, session.organization_id)

    let sentCount = 0
    let failedCount = 0
    let skippedCount = 0
    const BATCH_SIZE = 50

    // Process in batches
    for (let i = 0; i < account_ids.length; i += BATCH_SIZE) {
      const batch = account_ids.slice(i, i + BATCH_SIZE)

      for (const accountId of batch) {
        const complianceCheck = complianceResults.get(accountId)

        if (!complianceCheck || !complianceCheck.allowed) {
          logger.info('SMS blocked by compliance', {
            accountId,
            reason: complianceCheck?.reason,
          })
          skippedCount++

          // Log compliance block
          writeAuditLog(db, {
            organizationId: session.organization_id,
            userId: session.user_id,
            resourceType: 'messages',
            resourceId: accountId,
            action: AuditAction.SMS_COMPLIANCE_BLOCKED,
            newValue: { 
              account_id: accountId,
              reason: complianceCheck?.reason,
              skip_reason: complianceCheck?.skip_reason 
            },
          }, c.env.KV)

          continue
        }

        // Fetch account phone
        const accountResult = await db.query(
          `SELECT primary_phone FROM collection_accounts
           WHERE id = $1 AND organization_id = $2`,
          [accountId, session.organization_id]
        )

        if (accountResult.rows.length === 0) {
          skippedCount++
          continue
        }

        const phone = accountResult.rows[0].primary_phone

        // Send SMS
        const sendResult = await sendSingleSms(db, {
          from: c.env.TELNYX_NUMBER,
          to: phone,
          text: finalMessageBody,
          accountId,
          campaignId: campaign_id,
          organizationId: session.organization_id,
          userId: session.user_id,
          apiKey: c.env.TELNYX_API_KEY,
          messagingProfileId: c.env.TELNYX_MESSAGING_PROFILE_ID,
          webhookUrl: c.env.BASE_URL ? `${c.env.BASE_URL}/api/webhooks/telnyx` : undefined,
        })

        if (sendResult.success) {
          sentCount++
        } else {
          failedCount++
        }
      }
    }

    // Fire bulk send audit log
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'messages',
      resourceId: campaign_id || 'bulk',
      action: AuditAction.SMS_BULK_SENT,
      newValue: {
        total: account_ids.length,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
        campaign_id,
      },
    }, c.env.KV)

    logger.info('Bulk SMS completed', {
      total: account_ids.length,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
    })

    return c.json({
      success: true,
      summary: {
        total: account_ids.length,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
      },
    })
  } catch (error) {
    logger.error('Bulk SMS error', { error: (error as Error)?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /templates — List SMS Templates ────────────────────────────────────

messagesRoutes.get('/templates', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)

  try {
    const result = await db.query(
      `SELECT id, name, message_body, variables, channel, trigger_type, is_active, created_at, updated_at
       FROM auto_reply_templates
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({ success: true, templates: result.rows })
  } catch (error) {
    logger.error('Get templates error', { error: (error as Error)?.message })
    return c.json({ error: 'Failed to fetch templates' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /templates — Create SMS Template ──────────────────────────────────

messagesRoutes.post('/templates', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Forbidden' }, 403)

  const parsed = await validateBody(c, CreateSmsTemplateSchema)
  if (!parsed.success) return parsed.response

  const { name, category, message_body, variables, channel, trigger_type } = parsed.data

  const db = getDb(c.env)

  try {
    const result = await db.query(
      `INSERT INTO auto_reply_templates 
       (organization_id, name, channel, trigger_type, message_body, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [session.organization_id, name, channel, trigger_type, message_body]
    )

    // Fire audit log
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'templates',
      resourceId: result.rows[0].id,
      action: AuditAction.SMS_TEMPLATE_CREATED,
      newValue: result.rows[0],
    }, c.env.KV)

    return c.json({ success: true, template: result.rows[0] }, 201)
  } catch (error) {
    logger.error('Create template error', { error: (error as Error)?.message })
    return c.json({ error: 'Failed to create template' }, 500)
  } finally {
    await db.end()
  }
})

// ─── PUT /templates/:id — Update SMS Template ───────────────────────────────

messagesRoutes.put('/templates/:id', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Forbidden' }, 403)

  const templateId = c.req.param('id')
  const parsed = await validateBody(c, UpdateSmsTemplateSchema)
  if (!parsed.success) return parsed.response

  const updates = parsed.data
  const db = getDb(c.env)

  try {
    // Build dynamic UPDATE query
    const setClauses: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    if (setClauses.length === 0) {
      return c.json({ error: 'No fields to update' }, 400)
    }

    setClauses.push(`updated_at = NOW()`)
    values.push(templateId, session.organization_id)

    const result = await db.query(
      `UPDATE auto_reply_templates
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Template not found' }, 404)
    }

    // Fire audit log
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'templates',
      resourceId: templateId,
      action: AuditAction.SMS_TEMPLATE_UPDATED,
      oldValue: null, // Could fetch old value first if needed
      newValue: result.rows[0],
    }, c.env.KV)

    return c.json({ success: true, template: result.rows[0] })
  } catch (error) {
    logger.error('Update template error', { error: (error as Error)?.message })
    return c.json({ error: 'Failed to update template' }, 500)
  } finally {
    await db.end()
  }
})

// ─── DELETE /templates/:id — Delete SMS Template ────────────────────────────

messagesRoutes.delete('/templates/:id', async (c) => {
  const session = await requireRole(c, 'manager')
  if (!session) return c.json({ error: 'Forbidden' }, 403)

  const templateId = c.req.param('id')
  const db = getDb(c.env)

  try {
    const result = await db.query(
      `DELETE FROM auto_reply_templates
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [templateId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Template not found' }, 404)
    }

    // Fire audit log
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'templates',
      resourceId: templateId,
      action: AuditAction.SMS_TEMPLATE_DELETED,
      oldValue: result.rows[0],
      newValue: null,
    }, c.env.KV)

    return c.json({ success: true })
  } catch (error) {
    logger.error('Delete template error', { error: (error as Error)?.message })
    return c.json({ error: 'Failed to delete template' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /email — Send Email via Resend ────────────────────────────────────

messagesRoutes.post('/email', collectionsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const body = await c.req.json()
    const { to, subject, body: emailBody, account_id } = body

    if (!to || !subject || !emailBody) {
      return c.json({ error: 'Missing required fields: to, subject, body' }, 400)
    }

    if (!c.env.RESEND_API_KEY) {
      logger.error('RESEND_API_KEY not configured')
      return c.json({ error: 'Email service not configured' }, 500)
    }

    const db = getDb(c.env)

    try {
      const emailResult = await sendEmail(c.env.RESEND_API_KEY, {
        ...getEmailDefaults(c.env),
        to,
        subject,
        html: emailBody,
        text: emailBody.replace(/<[^>]*>/g, ''),
      })

      if (!emailResult.success) {
        return c.json({ error: 'Failed to send email', details: emailResult.error }, 502)
      }

      // Store in messages table
      await db.query(
        `INSERT INTO messages 
         (organization_id, account_id, direction, channel, to_email, subject, message_body, status, external_message_id, sent_at, created_at)
         VALUES ($1, $2, 'outbound', 'email', $3, $4, $5, 'sent', $6, NOW(), NOW())`,
        [session.organization_id, account_id || null, to, subject, emailBody, emailResult.id || null]
      ).catch(() => {})

      return c.json({ success: true, email_id: emailResult.id })
    } finally {
      await db.end()
    }
  } catch (error) {
    logger.error('Email send error', { error: (error as Error)?.message })
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ─── GET /inbox — Unified Inbox Messages ────────────────────────────────────

messagesRoutes.get('/inbox', messagesRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)

  try {
    // Query parameters
    const channel = c.req.query('channel') || 'all'
    const direction = c.req.query('direction') || 'all'
    const status = c.req.query('status') || 'all'
    const accountId = c.req.query('account_id')
    const startDate = c.req.query('start_date')
    const endDate = c.req.query('end_date')
    const limit = parseInt(c.req.query('limit') || '50', 10)
    const offset = parseInt(c.req.query('offset') || '0', 10)
    const search = c.req.query('search')

    // Build WHERE clause
    const conditions = ['m.organization_id = $1']
    const params: any[] = [session.organization_id]
    let paramIndex = 2

    if (channel !== 'all') {
      conditions.push(`m.channel = $${paramIndex}`)
      params.push(channel)
      paramIndex++
    }

    if (direction !== 'all') {
      conditions.push(`m.direction = $${paramIndex}`)
      params.push(direction)
      paramIndex++
    }

    if (status === 'unread') {
      conditions.push('m.read_at IS NULL')
    } else if (status === 'read') {
      conditions.push('m.read_at IS NOT NULL')
    }

    if (accountId) {
      conditions.push(`m.account_id = $${paramIndex}`)
      params.push(accountId)
      paramIndex++
    }

    if (startDate) {
      conditions.push(`m.created_at >= $${paramIndex}`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      conditions.push(`m.created_at <= $${paramIndex}`)
      params.push(endDate)
      paramIndex++
    }

    if (search) {
      conditions.push(`(
        ca.name ILIKE $${paramIndex} OR
        ca.phone ILIKE $${paramIndex} OR
        ca.email ILIKE $${paramIndex} OR
        m.message_body ILIKE $${paramIndex}
      )`)
      params.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      LEFT JOIN collection_accounts ca ON m.account_id = ca.id
      WHERE ${whereClause}
    `
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0]?.total || '0', 10)

    // Get messages with account details
    const messagesQuery = `
      SELECT 
        m.id,
        m.account_id,
        ca.name as account_name,
        ca.phone as account_phone,
        ca.email as account_email,
        m.direction,
        m.channel,
        m.from_number,
        m.to_number,
        m.from_email,
        m.to_email,
        m.message_body,
        m.subject,
        m.status,
        m.read_at,
        m.created_at,
        m.sent_at,
        m.delivered_at
      FROM messages m
      LEFT JOIN collection_accounts ca ON m.account_id = ca.id
      WHERE ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const result = await db.query(messagesQuery, params)

    return c.json({
      messages: result.rows,
      total,
      has_more: offset + limit < total,
      limit,
      offset,
    })
  } catch (error) {
    logger.error('Inbox fetch error', { error: (error as Error)?.message })
    return c.json({ error: 'Failed to fetch messages' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /threads/:accountId — Message Thread for Account ──────────────────

messagesRoutes.get('/threads/:accountId', messagesRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const accountId = c.req.param('accountId')
  const db = getDb(c.env)

  try {
    // Get all messages for this account
    const result = await db.query(
      `SELECT 
        m.id,
        m.account_id,
        m.direction,
        m.channel,
        m.from_number,
        m.to_number,
        m.from_email,
        m.to_email,
        m.message_body,
        m.subject,
        m.status,
        m.read_at,
        m.created_at,
        m.sent_at,
        m.delivered_at,
        ca.name as account_name,
        ca.phone as account_phone,
        ca.email as account_email
      FROM messages m
      LEFT JOIN collection_accounts ca ON m.account_id = ca.id
      WHERE m.account_id = $1 
        AND m.organization_id = $2
      ORDER BY m.created_at ASC`,
      [accountId, session.organization_id]
    )

    return c.json({
      messages: result.rows,
      account_id: accountId,
    })
  } catch (error) {
    logger.error('Thread fetch error', { error: (error as Error)?.message })
    return c.json({ error: 'Failed to fetch thread' }, 500)
  } finally {
    await db.end()
  }
})

// ─── PATCH /:id/read — Mark Message as Read ─────────────────────────────────

messagesRoutes.patch('/:id/read', messagesRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const messageId = c.req.param('id')
  const db = getDb(c.env)

  try {
    // Get message first
    const getMessage = await db.query(
      'SELECT * FROM messages WHERE id = $1 AND organization_id = $2',
      [messageId, session.organization_id]
    )

    if (getMessage.rows.length === 0) {
      return c.json({ error: 'Message not found' }, 404)
    }

    const message = getMessage.rows[0]

    // Update read_at
    const result = await db.query(
      `UPDATE messages 
       SET read_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [messageId, session.organization_id]
    )

    // Audit log
    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.MESSAGE_SENT,
      resourceType: 'message',
      resourceId: messageId,
      oldValue: { read_at: message.read_at },
      newValue: { read_at: result.rows[0].read_at },
    }).catch(() => {})

    return c.json({ message: result.rows[0] })
  } catch (error) {
    logger.error('Mark as read error', { error: (error as Error)?.message })
    return c.json({ error: 'Failed to mark as read' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /:id/reply — Reply to Message ─────────────────────────────────────

messagesRoutes.post('/:id/reply', messagesRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const messageId = c.req.param('id')
  const db = getDb(c.env)

  try {
    const body = await c.req.json()
    const { message_body, channel } = body

    if (!message_body) {
      return c.json({ error: 'message_body is required' }, 400)
    }

    // Get original message
    const getMessage = await db.query(
      'SELECT * FROM messages WHERE id = $1 AND organization_id = $2',
      [messageId, session.organization_id]
    )

    if (getMessage.rows.length === 0) {
      return c.json({ error: 'Message not found' }, 404)
    }

    const originalMessage = getMessage.rows[0]
    const replyChannel = channel || originalMessage.channel

    // Get account details and check consent
    if (!originalMessage.account_id) {
      return c.json({ error: 'Cannot reply: no account linked to message' }, 400)
    }

    const accountResult = await db.query(
      'SELECT * FROM collection_accounts WHERE id = $1 AND organization_id = $2',
      [originalMessage.account_id, session.organization_id]
    )

    if (accountResult.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const account = accountResult.rows[0]

    // Check consent based on channel
    if (replyChannel === 'sms') {
      if (!account.sms_consent) {
        return c.json({ error: 'Account has not consented to SMS' }, 403)
      }

      if (!c.env.TELNYX_API_KEY || !c.env.TELNYX_NUMBER) {
        return c.json({ error: 'SMS service not configured' }, 500)
      }

      // Determine reply phone numbers
      const toNumber = originalMessage.direction === 'inbound' 
        ? originalMessage.from_number 
        : originalMessage.to_number

      if (!toNumber) {
        return c.json({ error: 'No phone number to reply to' }, 400)
      }

      // Send SMS reply
      const smsResult = await sendSingleSms(db, {
        from: c.env.TELNYX_NUMBER,
        to: toNumber,
        text: message_body,
        accountId: account.id,
        organizationId: session.organization_id,
        userId: session.user_id,
        apiKey: c.env.TELNYX_API_KEY,
        messagingProfileId: c.env.TELNYX_MESSAGING_PROFILE_ID,
      })

      if (!smsResult.success) {
        return c.json({ error: 'SMS reply failed', details: smsResult.error }, 502)
      }

      return c.json({ success: true, message_id: smsResult.messageId })

    } else if (replyChannel === 'email') {
      if (!account.email_consent) {
        return c.json({ error: 'Account has not consented to email' }, 403)
      }

      if (!c.env.RESEND_API_KEY) {
        return c.json({ error: 'Email service not configured' }, 500)
      }

      const toEmail = originalMessage.direction === 'inbound'
        ? originalMessage.from_email
        : originalMessage.to_email

      if (!toEmail) {
        return c.json({ error: 'No email address to reply to' }, 400)
      }

      const emailDefaults = getEmailDefaults({ RESEND_FROM: c.env.RESEND_FROM })
      const subject = originalMessage.subject 
        ? `Re: ${originalMessage.subject}`
        : 'Reply to your message'

      const emailResult = await sendEmail(c.env.RESEND_API_KEY!, {
        to: toEmail,
        from: emailDefaults.from || 'Word Is Bond <noreply@wordis-bond.com>',
        subject,
        html: message_body,
        text: message_body.replace(/<[^>]*>/g, ''),
      })

      if (!emailResult.success) {
        return c.json({ error: 'Email reply failed', details: emailResult.error }, 502)
      }

      // Store reply in messages table
      await db.query(
        `INSERT INTO messages 
         (organization_id, account_id, direction, channel, to_email, subject, message_body, status, external_message_id, sent_at, created_at)
         VALUES ($1, $2, 'outbound', 'email', $3, $4, $5, 'sent', $6, NOW(), NOW())`,
        [session.organization_id, account.id, toEmail, subject, message_body, emailResult.id || null]
      ).catch(() => {})

      return c.json({ success: true, email_id: emailResult.id })

    } else {
      return c.json({ error: 'Cannot reply to call messages' }, 400)
    }
  } catch (error) {
    logger.error('Reply error', { error: (error as Error)?.message })
    return c.json({ error: 'Failed to send reply' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /unread-count — Unread Message Count ───────────────────────────────

messagesRoutes.get('/unread-count', messagesRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)

  try {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE channel = 'sms') as sms,
        COUNT(*) FILTER (WHERE channel = 'email') as email,
        COUNT(*) FILTER (WHERE channel = 'call') as call
      FROM messages
      WHERE organization_id = $1 
        AND read_at IS NULL
        AND direction = 'inbound'`,
      [session.organization_id]
    )

    return c.json({
      total: parseInt(result.rows[0]?.total || '0', 10),
      by_channel: {
        sms: parseInt(result.rows[0]?.sms || '0', 10),
        email: parseInt(result.rows[0]?.email || '0', 10),
        call: parseInt(result.rows[0]?.call || '0', 10),
      },
    })
  } catch (error) {
    logger.error('Unread count error', { error: (error as Error)?.message })
    return c.json({ error: 'Failed to fetch unread count' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /health — Service Health Check ─────────────────────────────────────

messagesRoutes.get('/health', async (c) => {
  const telnyxConfigured = !!c.env.TELNYX_API_KEY && !!c.env.TELNYX_NUMBER
  const resendConfigured = !!c.env.RESEND_API_KEY

  return c.json({
    status: 'healthy',
    services: {
      sms: telnyxConfigured ? 'configured' : 'not_configured',
      email: resendConfigured ? 'configured' : 'not_configured',
    },
  })
})
