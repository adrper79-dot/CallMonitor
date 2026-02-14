/**
 * Unsubscribe Handler — CAN-SPAM Compliant Email Opt-Out
 *
 * This endpoint handles unsubscribe requests from email campaign links.
 * Required by CAN-SPAM Act to honor opt-out requests within 10 business days.
 *
 * Usage: Add this route to workers/src/routes/messages.ts
 *
 * @see ARCH_DOCS/02-FEATURES/OMNICHANNEL_MESSAGING.md
 * @see EMAIL_CAMPAIGN_IMPLEMENTATION_SUMMARY.md
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { verifyUnsubscribeToken } from '../lib/email-campaigns'

export const unsubscribeRoutes = new Hono<AppEnv>()

/**
 * GET /api/messages/unsubscribe?token={jwt}
 * 
 * Process email unsubscribe request.
 * Updates account.email_consent = false and creates opt_out_request record.
 * Returns HTML confirmation page.
 */
unsubscribeRoutes.get('/unsubscribe', async (c) => {
  const token = c.req.query('token')

  if (!token) {
    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invalid Unsubscribe Link</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 48px;">❌</span>
    </div>
    <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #111827; text-align: center;">Invalid Unsubscribe Link</h1>
    <p style="margin: 0; color: #6b7280; text-align: center; line-height: 1.6;">
      The unsubscribe link you clicked is invalid or malformed.
      Please contact support if you continue to receive unwanted emails.
    </p>
  </div>
</body>
</html>`,
      400
    )
  }

  // Verify JWT token
  const decoded = await verifyUnsubscribeToken(token, c.env.AUTH_SECRET)

  if (!decoded) {
    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expired Unsubscribe Link</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 48px;">⏰</span>
    </div>
    <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #111827; text-align: center;">Unsubscribe Link Expired</h1>
    <p style="margin: 0; color: #6b7280; text-align: center; line-height: 1.6;">
      This unsubscribe link has expired (links are valid for 30 days).
      Please contact support to update your email preferences.
    </p>
  </div>
</body>
</html>`,
      400
    )
  }

  const db = getDb(c.env)

  try {
    // Update account email consent
    const updateResult = await db.query(
      `UPDATE collection_accounts
       SET email_consent = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, email, first_name, last_name`,
      [decoded.accountId, decoded.organizationId]
    )

    if (updateResult.rows.length === 0) {
      // Account not found (maybe deleted)
      logger.warn('Unsubscribe: account not found', {
        accountId: decoded.accountId,
        organizationId: decoded.organizationId,
      })

      return c.html(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Not Found</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 48px;">🔍</span>
    </div>
    <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #111827; text-align: center;">Account Not Found</h1>
    <p style="margin: 0; color: #6b7280; text-align: center; line-height: 1.6;">
      We couldn't find your account in our system.
      You may already be unsubscribed or your account may have been removed.
    </p>
  </div>
</body>
</html>`,
        404
      )
    }

    const account = updateResult.rows[0]

    // Record opt-out request
    await db.query(
      `INSERT INTO opt_out_requests
       (account_id, request_type, channel, reason, source, created_at)
       VALUES ($1, 'opt_out', 'email', 'user_requested', 'unsubscribe_link', NOW())
       ON CONFLICT (account_id, channel)
       DO UPDATE SET created_at = NOW(), request_type = 'opt_out', reason = 'user_requested'`,
      [decoded.accountId]
    ).catch((err) => {
      logger.warn('Unsubscribe: opt_out_request insert failed (non-fatal)', {
        error: (err as Error)?.message,
        accountId: decoded.accountId,
      })
    })

    // Audit log
    writeAuditLog(
      db,
      {
        organizationId: decoded.organizationId,
        userId: 'system',
        resourceType: 'accounts',
        resourceId: decoded.accountId,
        action: AuditAction.EMAIL_UNSUBSCRIBED,
        oldValue: { email_consent: true },
        newValue: { email_consent: false, email: decoded.email },
      },
      c.env.KV
    )

    logger.info('Email unsubscribe successful', {
      accountId: decoded.accountId,
      email: account.email,
    })

    // Return success HTML page
    const displayName = account.first_name
      ? `${account.first_name} ${account.last_name || ''}`.trim()
      : account.email

    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed Successfully</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 48px;">✅</span>
    </div>
    <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #111827; text-align: center;">Unsubscribed Successfully</h1>
    <p style="margin: 0 0 16px 0; color: #6b7280; text-align: center; line-height: 1.6;">
      <strong>${displayName}</strong>, you have been unsubscribed from all email communications.
      You will no longer receive marketing or campaign emails from us.
    </p>
    <p style="margin: 0; color: #6b7280; text-align: center; line-height: 1.6; font-size: 14px;">
      Email: ${account.email}
    </p>
    <div style="margin-top: 32px; padding-top: 32px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
        You may still receive transactional emails related to your account activity.
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        If you have questions, please contact us at support@wordis-bond.com
      </p>
    </div>
  </div>
</body>
</html>`
    )
  } catch (error) {
    logger.error('Unsubscribe processing error', {
      error: (error as Error)?.message,
      accountId: decoded.accountId,
      organizationId: decoded.organizationId,
    })

    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error Processing Request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 48px;">⚠️</span>
    </div>
    <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #111827; text-align: center;">Error Processing Request</h1>
    <p style="margin: 0; color: #6b7280; text-align: center; line-height: 1.6;">
      We encountered an error while processing your unsubscribe request.
      Please try again later or contact support for assistance.
    </p>
  </div>
</body>
</html>`,
      500
    )
  } finally {
    await db.end()
  }
})

/**
 * GET /api/messages/preferences?token={jwt}
 * 
 * Optional: Email preferences page (allows granular control)
 * Users can choose:
 * - Unsubscribe from all emails
 * - Marketing only
 * - Transactional only
 * - Frequency preferences
 */
unsubscribeRoutes.get('/preferences', async (c) => {
  const token = c.req.query('token')

  if (!token) {
    return c.html('<h1>Invalid preferences link</h1>', 400)
  }

  const decoded = await verifyUnsubscribeToken(token, c.env.AUTH_SECRET)

  if (!decoded) {
    return c.html('<h1>Invalid or expired preferences link</h1>', 400)
  }

  const db = getDb(c.env)

  try {
    // Fetch current account preferences
    const accountResult = await db.query(
      `SELECT id, email, first_name, last_name, email_consent, custom_fields
       FROM collection_accounts
       WHERE id = $1 AND organization_id = $2`,
      [decoded.accountId, decoded.organizationId]
    )

    if (accountResult.rows.length === 0) {
      return c.html('<h1>Account not found</h1>', 404)
    }

    const account = accountResult.rows[0]
    const displayName = account.first_name
      ? `${account.first_name} ${account.last_name || ''}`.trim()
      : account.email

    const emailPreferences = account.custom_fields?.email_preferences || {
      marketing: true,
      transactional: true,
      frequency: 'weekly',
    }

    // Return preferences HTML page with form
    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Preferences</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #111827;">Email Preferences</h1>
    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">${displayName} (${account.email})</p>

    <form method="POST" action="/api/messages/preferences?token=${token}" style="margin: 0;">
      <div style="margin-bottom: 24px;">
        <label style="display: flex; align-items: center; margin-bottom: 12px;">
          <input type="checkbox" name="marketing" ${emailPreferences.marketing ? 'checked' : ''} style="margin-right: 8px;">
          <span style="color: #374151; font-size: 15px;">Marketing & Promotional Emails</span>
        </label>
        <label style="display: flex; align-items: center; margin-bottom: 12px;">
          <input type="checkbox" name="transactional" ${emailPreferences.transactional ? 'checked' : ''} style="margin-right: 8px;">
          <span style="color: #374151; font-size: 15px;">Transactional Emails (Account Updates)</span>
        </label>
      </div>

      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500; font-size: 14px;">Email Frequency</label>
        <select name="frequency" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
          <option value="daily" ${emailPreferences.frequency === 'daily' ? 'selected' : ''}>Daily</option>
          <option value="weekly" ${emailPreferences.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
          <option value="monthly" ${emailPreferences.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
        </select>
      </div>

      <button type="submit" style="width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 500; font-size: 15px; cursor: pointer;">
        Save Preferences
      </button>

      <a href="/api/messages/unsubscribe?token=${token}" style="display: block; margin-top: 16px; text-align: center; color: #dc2626; text-decoration: underline; font-size: 14px;">
        Unsubscribe from All Emails
      </a>
    </form>

    <div style="margin-top: 32px; padding-top: 32px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        Questions? Contact us at support@wordis-bond.com
      </p>
    </div>
  </div>
</body>
</html>`
    )
  } catch (error) {
    logger.error('Email preferences error', {
      error: (error as Error)?.message,
      accountId: decoded.accountId,
    })
    return c.html('<h1>Error loading preferences</h1>', 500)
  } finally {
    await db.end()
  }
})

/**
 * POST /api/messages/preferences?token={jwt}
 * 
 * Save email preferences.
 */
unsubscribeRoutes.post('/preferences', async (c) => {
  const token = c.req.query('token')

  if (!token) {
    return c.html('<h1>Invalid preferences link</h1>', 400)
  }

  const decoded = await verifyUnsubscribeToken(token, c.env.AUTH_SECRET)

  if (!decoded) {
    return c.html('<h1>Invalid or expired preferences link</h1>', 400)
  }

  const db = getDb(c.env)

  try {
    const formData = await c.req.formData()
    const marketing = formData.get('marketing') === 'on'
    const transactional = formData.get('transactional') === 'on'
    const frequency = formData.get('frequency') || 'weekly'

    // Update account preferences
    await db.query(
      `UPDATE collection_accounts
       SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2 AND organization_id = $3`,
      [
        JSON.stringify({
          email_preferences: {
            marketing,
            transactional,
            frequency,
          },
        }),
        decoded.accountId,
        decoded.organizationId,
      ]
    )

    // Audit log
    writeAuditLog(
      db,
      {
        organizationId: decoded.organizationId,
        userId: 'system',
        resourceType: 'accounts',
        resourceId: decoded.accountId,
        action: 'email:preferences_updated',
        newValue: { marketing, transactional, frequency },
      },
      c.env.KV
    )

    logger.info('Email preferences updated', {
      accountId: decoded.accountId,
      marketing,
      transactional,
      frequency,
    })

    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preferences Saved</title>
  <meta http-equiv="refresh" content="3;url=/api/messages/preferences?token=${token}">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center;">
    <span style="font-size: 48px;">✅</span>
    <h1 style="margin: 16px 0; font-size: 24px; color: #111827;">Preferences Saved</h1>
    <p style="margin: 0; color: #6b7280;">Your email preferences have been updated successfully.</p>
    <p style="margin: 16px 0 0 0; color: #9ca3af; font-size: 14px;">Redirecting back to preferences...</p>
  </div>
</body>
</html>`
    )
  } catch (error) {
    logger.error('Save preferences error', {
      error: (error as Error)?.message,
      accountId: decoded.accountId,
    })
    return c.html('<h1>Error saving preferences</h1>', 500)
  } finally {
    await db.end()
  }
})
