/**
 * Email Service — Resend API Integration
 *
 * Provides transactional email sending via Resend.
 * Used for password reset, team invites, and call sharing.
 *
 * @see https://resend.com/docs/api-reference/emails/send-email
 */

import { logger } from './logger'

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Word Is Bond <noreply@voxsouth.online>'

/**
 * Send an email via Resend API.
 *
 * Fire-and-forget pattern: callers should `.catch(() => {})` if
 * email failure should not block the user-facing response.
 */
export async function sendEmail(apiKey: string, params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, html, text, from, replyTo } = params

  if (!apiKey) {
    logger.warn('sendEmail: RESEND_API_KEY not configured, skipping')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || DEFAULT_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(text && { text }),
        ...(replyTo && { reply_to: replyTo }),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      logger.error('sendEmail: Resend API error', { status: res.status, body })
      return { success: false, error: `Resend API ${res.status}: ${body}` }
    }

    const data = (await res.json()) as { id: string }
    logger.info('sendEmail: sent', { to: Array.isArray(to) ? to : [to], id: data.id })
    return { success: true, id: data.id }
  } catch (err: any) {
    logger.error('sendEmail: network error', { error: err?.message })
    return { success: false, error: err?.message || 'Network error' }
  }
}

// ─── Email Templates ─────────────────────────────────────────────────────────

/**
 * Password reset email HTML template.
 */
export function passwordResetEmailHtml(resetUrl: string, expiresMinutes: number = 60): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:32px 32px 24px;text-align:center;">
      <h1 style="margin:0;font-size:20px;color:#111827;font-weight:600;">Reset Your Password</h1>
    </td></tr>
    <tr><td style="padding:0 32px 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      <p>You requested a password reset for your Word Is Bond account. Click the button below to set a new password.</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;text-align:center;">
      <a href="${resetUrl}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;font-size:15px;">
        Reset Password
      </a>
    </td></tr>
    <tr><td style="padding:0 32px 24px;color:#6b7280;font-size:13px;line-height:1.5;">
      <p>This link expires in ${expiresMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>
      <p style="margin-top:12px;word-break:break-all;color:#9ca3af;font-size:12px;">${resetUrl}</p>
    </td></tr>
    <tr><td style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center;color:#9ca3af;font-size:12px;">
      Word Is Bond — The System of Record for Business Conversations
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Team invite email HTML template.
 */
export function teamInviteEmailHtml(
  inviteUrl: string,
  organizationName: string,
  inviterName: string,
  role: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:32px 32px 24px;text-align:center;">
      <h1 style="margin:0;font-size:20px;color:#111827;font-weight:600;">You're Invited</h1>
    </td></tr>
    <tr><td style="padding:0 32px 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Word Is Bond as a <strong>${role}</strong>.</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;text-align:center;">
      <a href="${inviteUrl}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;font-size:15px;">
        Accept Invitation
      </a>
    </td></tr>
    <tr><td style="padding:0 32px 24px;color:#6b7280;font-size:13px;line-height:1.5;">
      <p>This invitation expires in 7 days.</p>
    </td></tr>
    <tr><td style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center;color:#9ca3af;font-size:12px;">
      Word Is Bond — The System of Record for Business Conversations
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Call share email HTML template.
 * Used when an operator shares call artifacts (recording, transcript, summary) via email.
 */
export function callShareEmailHtml(
  callId: string,
  senderName: string,
  callDate: string,
  callSummary: string | null,
  appUrl: string = 'https://voxsouth.online'
): string {
  const reviewUrl = `${appUrl}/review?callId=${callId}`
  const summaryBlock = callSummary
    ? `<p style="margin:8px 0;padding:12px;background:#f3f4f6;border-radius:8px;font-size:14px;line-height:1.5;">${callSummary}</p>`
    : ''
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:32px 32px 24px;text-align:center;">
      <h1 style="margin:0;font-size:20px;color:#111827;font-weight:600;">Call Record Shared With You</h1>
    </td></tr>
    <tr><td style="padding:0 32px 16px;color:#4b5563;font-size:15px;line-height:1.6;">
      <p><strong>${senderName}</strong> shared a call record from <strong>${callDate}</strong> with you.</p>
      ${summaryBlock}
    </td></tr>
    <tr><td style="padding:0 32px 24px;text-align:center;">
      <a href="${reviewUrl}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;font-size:15px;">
        Review Call
      </a>
    </td></tr>
    <tr><td style="padding:0 32px 24px;color:#6b7280;font-size:13px;line-height:1.5;">
      <p>You need a Word Is Bond account to view this call. If you don't have one, contact the sender.</p>
    </td></tr>
    <tr><td style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center;color:#9ca3af;font-size:12px;">
      Word Is Bond — The System of Record for Business Conversations
    </td></tr>
  </table>
</body>
</html>`
}
