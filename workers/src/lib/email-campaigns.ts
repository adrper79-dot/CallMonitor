/**
 * Email Campaign Helpers — CAN-SPAM Compliance & Templates
 *
 * Provides email campaign functionality including:
 * - CAN-SPAM compliantfooter generation
 * - Unsubscribe token generation/verification
 * - Pre-built email templates (payment reminder, settlement, etc.)
 * - Bulk email sending via Resend
 *
 * @see ARCH_DOCS/02-FEATURES/OMNICHANNEL_MESSAGING.md
 */

import { logger } from './logger'

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Word Is Bond <noreply@wordis-bond.com>'

export interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

/**
 * Generate unsubscribe JWT token.
 * Token includes: account_id, organization_id, email, expiry (30 days).
 * 
 * @param accountId - Account UUID
 * @param organizationId - Organization UUID
 * @param email - Email address
 * @param secret - AUTH_SECRET for JWT signing
 * @returns JWT token
 */
export async function generateUnsubscribeToken(
  accountId: string,
  organizationId: string,
  email: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  const payload = JSON.stringify({ accountId, organizationId, email, exp: expiresAt })
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )

  const token = btoa(payload) + '.' + btoa(String.fromCharCode(...new Uint8Array(signature)))
  return token
}

/**
 * Verify unsubscribe token.
 * 
 * @param token - JWT token from unsubscribe link
 * @param secret - AUTH_SECRET for verification
 * @returns Decoded payload or null if invalid/expired
 */
export async function verifyUnsubscribeToken(
  token: string,
  secret: string
): Promise<{ accountId: string; organizationId: string; email: string } | null> {
  try {
    const [payloadB64, signatureB64] = token.split('.')
    if (!payloadB64 || !signatureB64) return null

    const payload = atob(payloadB64)
    const data = JSON.parse(payload)

    // Check expiry
    if (data.exp < Date.now()) {
      logger.warn('Unsubscribe token expired', { token: token.substring(0, 20) })
      return null
    }

    // Verify signature
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(payload)
    )

    if (!valid) {
      logger.warn('Unsubscribe token signature invalid', { token: token.substring(0, 20) })
      return null
    }

    return { accountId: data.accountId, organizationId: data.organizationId, email: data.email }
  } catch (error) {
    logger.error('Unsubscribe token verification failed', { error: (error as Error)?.message })
    return null
  }
}

/**
 * CAN-SPAM compliant footer template.
 * Auto-injects required elements: company address, unsubscribe link.
 * 
 * @param organizationName - Company name
 * @param address - Physical mailing address (CAN-SPAM requirement)
 * @param phone - Company phone number
 * @param unsubscribeUrl - Unsubscribe link URL
 * @returns HTML footer
 */
export function canSpamFooter(
  organizationName: string,
  address: string,
  phone: string,
  unsubscribeUrl: string,
  preferencesUrl?: string
): string {
  const prefsLink = preferencesUrl
    ? ` | <a href="${preferencesUrl}" style="color: #0066cc; text-decoration: underline;">Email Preferences</a>`
    : ''

  return `
<div style="margin-top: 40px; padding: 20px; background: #f5f5f5; font-size: 12px; color: #666; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <p style="margin: 0 0 8px 0;"><strong>${organizationName}</strong></p>
  <p style="margin: 0 0 4px 0;">${address}</p>
  <p style="margin: 0 0 12px 0;">${phone}</p>
  <p style="margin: 0;">
    <a href="${unsubscribeUrl}" style="color: #0066cc; text-decoration: underline;">Unsubscribe</a>${prefsLink}
  </p>
</div>`
}

/**
 * Payment reminder email template.
 */
export function paymentReminderEmailHtml(params: {
  firstName: string
  lastName: string
  accountNumber: string
  balance: string
  dueDate: string
  paymentLink: string
  companyName: string
  companyAddress: string
  companyPhone: string
  unsubscribeLink: string
}): string {
  const {
    firstName,
    lastName,
    accountNumber,
    balance,
    dueDate,
    paymentLink,
    companyName,
    companyAddress,
    companyPhone,
    unsubscribeLink,
  } = params

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:32px 32px 24px;">
      <h1 style="margin:0 0 8px 0;font-size:24px;color:#111827;font-weight:600;">Payment Reminder</h1>
      <p style="margin:0;color:#6b7280;font-size:14px;">Account ${accountNumber}</p>
    </td></tr>
    <tr><td style="padding:0 32px 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      <p>Dear ${firstName} ${lastName},</p>
      <p>This is a friendly reminder that a payment of <strong>${balance}</strong> is due on <strong>${dueDate}</strong>.</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;text-align:center;">
      <a href="${paymentLink}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;font-size:15px;">
        Make a Payment
      </a>
    </td></tr>
    <tr><td style="padding:0 32px 24px;color:#6b7280;font-size:13px;line-height:1.5;">
      <p>If you've already made this payment, please disregard this message. If you have questions, please contact us.</p>
    </td></tr>
    ${canSpamFooter(companyName, companyAddress, companyPhone, unsubscribeLink)}
  </table>
</body>
</html>`
}

/**
 * Settlement offer email template.
 */
export function settlementOfferEmailHtml(params: {
  firstName: string
  lastName: string
  accountNumber: string
  originalBalance: string
  settlementAmount: string
  discountPercent: string
  expiryDate: string
  acceptLink: string
  companyName: string
  companyAddress: string
  companyPhone: string
  unsubscribeLink: string
}): string {
  const {
    firstName,
    lastName,
    accountNumber,
    originalBalance,
    settlementAmount,
    discountPercent,
    expiryDate,
    acceptLink,
    companyName,
    companyAddress,
    companyPhone,
    unsubscribeLink,
  } = params

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:32px 32px 24px;">
      <h1 style="margin:0 0 8px 0;font-size:24px;color:#111827;font-weight:600;">Special Settlement Offer</h1>
      <p style="margin:0;color:#6b7280;font-size:14px;">Account ${accountNumber}</p>
    </td></tr>
    <tr><td style="padding:0 32px 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      <p>Dear ${firstName} ${lastName},</p>
      <p>We're offering you a special settlement opportunity to resolve your account.</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;">
      <table width="100%" cellpadding="12" style="background:#f9fafb;border-radius:8px;">
        <tr>
          <td style="color:#6b7280;font-size:13px;">Original Balance:</td>
          <td style="text-align:right;color:#111827;font-weight:600;font-size:15px;">${originalBalance}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;">Settlement Amount:</td>
          <td style="text-align:right;color:#16a34a;font-weight:700;font-size:18px;">${settlementAmount}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;">You Save:</td>
          <td style="text-align:right;color:#16a34a;font-weight:600;font-size:15px;">${discountPercent}%</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 32px 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      <p><strong>This offer expires ${expiryDate}.</strong> Don't miss this opportunity to save.</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;text-align:center;">
      <a href="${acceptLink}" style="display:inline-block;padding:12px 32px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;font-size:15px;">
        Accept Settlement
      </a>
    </td></tr>
    ${canSpamFooter(companyName, companyAddress, companyPhone, unsubscribeLink)}
  </table>
</body>
</html>`
}

/**
 * Payment confirmation email template.
 */
export function paymentConfirmationEmailHtml(params: {
  firstName: string
  lastName: string
  accountNumber: string
  paymentAmount: string
  paymentDate: string
  remainingBalance: string
  nextPaymentDate?: string
  companyName: string
  companyAddress: string
  companyPhone: string
  unsubscribeLink: string
}): string {
  const {
    firstName,
    lastName,
    accountNumber,
    paymentAmount,
    paymentDate,
    remainingBalance,
    nextPaymentDate,
    companyName,
    companyAddress,
    companyPhone,
    unsubscribeLink,
  } = params

  const nextPaymentBlock = nextPaymentDate
    ? `<p>Your next payment of <strong>${remainingBalance}</strong> is due on <strong>${nextPaymentDate}</strong>.</p>`
    : '<p>Thank you for completing your payment plan.</p>'

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:32px 32px 24px;text-align:center;">
      <div style="display:inline-block;padding:16px;background:#10b981;border-radius:50%;margin-bottom:16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <h1 style="margin:0 0 8px 0;font-size:24px;color:#111827;font-weight:600;">Payment Received</h1>
      <p style="margin:0;color:#6b7280;font-size:14px;">Account ${accountNumber}</p>
    </td></tr>
    <tr><td style="padding:0 32px 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      <p>Dear ${firstName} ${lastName},</p>
      <p>Thank you! We received your payment of <strong>${paymentAmount}</strong> on <strong>${paymentDate}</strong>.</p>
      ${nextPaymentBlock}
    </td></tr>
    <tr><td style="padding:0 32px 24px;">
      <div style="padding:16px;background:#f0fdf4;border-left:4px solid #10b981;border-radius:8px;">
        <p style="margin:0;color:#15803d;font-size:14px;font-weight:600;">Remaining Balance: ${remainingBalance}</p>
      </div>
    </td></tr>
    ${canSpamFooter(companyName, companyAddress, companyPhone, unsubscribeLink)}
  </table>
</body>
</html>`
}

/**
 * Account update email template.
 */
export function accountUpdateEmailHtml(params: {
  firstName: string
  lastName: string
  accountNumber: string
  updateMessage: string
  contactPhone: string
  companyName: string
  companyAddress: string
  companyPhone: string
  unsubscribeLink: string
}): string {
  const {
    firstName,
    lastName,
    accountNumber,
    updateMessage,
    contactPhone,
    companyName,
    companyAddress,
    companyPhone,
    unsubscribeLink,
  } = params

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:32px 32px 24px;">
      <h1 style="margin:0 0 8px 0;font-size:24px;color:#111827;font-weight:600;">Important Account Update</h1>
      <p style="margin:0;color:#6b7280;font-size:14px;">Account ${accountNumber}</p>
    </td></tr>
    <tr><td style="padding:0 32px 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      <p>Dear ${firstName} ${lastName},</p>
      <p>${updateMessage}</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;color:#6b7280;font-size:13px;line-height:1.5;">
      <p>If you have questions, please contact us at <strong>${contactPhone}</strong>.</p>
    </td></tr>
    ${canSpamFooter(companyName, companyAddress, companyPhone, unsubscribeLink)}
  </table>
</body>
</html>`
}

/**
 * Send campaign email via Resend API.
 * Includes CAN-SPAM footer, tracking tags, and proper error handling.
 * 
 * @param apiKey - Resend API key
 * @param params - Email parameters
 * @returns Send result with message ID
 */
export async function sendCampaignEmail(
  apiKey: string,
  params: {
    to: string
    subject: string
    html: string
    from?: string
    fromName?: string
    replyTo?: string
    campaignId?: string
    accountId?: string
    organizationId?: string
    attachments?: Array<{ filename: string; content: string }>
  }
): Promise<SendEmailResult> {
  const { to, subject, html, from, fromName, replyTo, campaignId, accountId, organizationId, attachments } = params

  if (!apiKey) {
    logger.warn('sendCampaignEmail: RESEND_API_KEY not configured')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const fromEmail = from || DEFAULT_FROM
    const fromFormatted = fromName ? `${fromName} <${fromEmail.replace(/^.*<|>.*$/g, '')}>` : fromEmail

    const payload: any = {
      from: fromFormatted,
      to: [to],
      subject,
      html,
      text: html.replace(/<[^>]*>/g, ''), // Plain text fallback
    }

    if (replyTo) {
      payload.reply_to = replyTo
    }

    if (attachments && attachments.length > 0) {
      payload.attachments = attachments
    }

    // Add tracking tags for campaign analytics
    if (campaignId || accountId || organizationId) {
      payload.tags = []
      if (campaignId) payload.tags.push({ name: 'campaign_id', value: campaignId })
      if (accountId) payload.tags.push({ name: 'account_id', value: accountId })
      if (organizationId) payload.tags.push({ name: 'organization_id', value: organizationId })
    }

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.text()
      logger.error('sendCampaignEmail: Resend API error', { status: res.status, body: body.substring(0, 200) })
      
      // Check for rate limit
      if (res.status === 429) {
        return { success: false, error: 'Rate limit exceeded' }
      }

      return { success: false, error: `Resend API ${res.status}: ${body.substring(0, 100)}` }
    }

    const data = (await res.json()) as { id: string }
    logger.info('sendCampaignEmail: sent', { to, id: data.id, campaignId })
    return { success: true, id: data.id }
  } catch (err: any) {
    logger.error('sendCampaignEmail: network error', { error: err?.message })
    return { success: false, error: err?.message || 'Network error' }
  }
}

/**
 * Render template with variable replacement.
 * Variables format: {{variable_name}}
 * 
 * @param template - Template string with {{variables}}
 * @param vars - Object of variable replacements
 * @returns Rendered message
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  let rendered = template

  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    rendered = rendered.replace(regex, value || '')
  }

  // Remove any unreplaced variables
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, '')

  return rendered
}
