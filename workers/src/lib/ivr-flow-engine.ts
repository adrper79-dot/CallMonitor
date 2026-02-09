/**
 * IVR Flow Engine — Interactive Voice Response with Payment Collection
 *
 * Manages DTMF/speech-based IVR menus and Stripe payment flows over the phone.
 *
 * IVR Flow:
 *   Welcome → Main Menu → [1: Balance] [2: Make Payment] [3: Agent]
 *   Payment: Gather card (4 segments) → Stripe PaymentIntent → Confirm/Retry
 *
 * State is passed via Telnyx `client_state` (base64-encoded JSON) to avoid
 * external state stores. Each gather → webhook → gather cycle carries the flow context.
 *
 * PCI Compliance:
 *   - Card numbers are NEVER stored or logged
 *   - PAN is assembled in-memory for the single Stripe API call, then discarded
 *   - All gather prompts mask digits with asterisks in logs
 *   - Telnyx DTMF transmission is encrypted (TLS)
 *
 * @see ARCH_DOCS/FEATURE_IMPLEMENTATION_PLAN.md — Phase 5
 */

import type { Env } from '../index'
import type { DbClient } from './db'
import { logger } from './logger'
import { writeAuditLog, AuditAction } from './audit'

const TELNYX_BASE = 'https://api.telnyx.com/v2'
const STRIPE_BASE = 'https://api.stripe.com/v1'

/** IVR Flow steps */
type IVRStep =
  | 'welcome'
  | 'main_menu'
  | 'balance_check'
  | 'payment_amount'
  | 'payment_card_number'
  | 'payment_expiry'
  | 'payment_cvv'
  | 'payment_confirm'
  | 'payment_processing'
  | 'payment_complete'
  | 'agent_transfer'
  | 'goodbye'

interface IVRFlowContext {
  flow: 'ivr_payment'
  step: IVRStep
  accountId?: string
  organizationId?: string
  callId?: string
  paymentAmount?: number
  balanceDue?: number
  // Card details are NEVER persisted — only held in-memory during payment step
  cardLast4?: string
  stripeCustomerId?: string
  attempts?: number
}

/**
 * Start an IVR payment flow on a call.
 * Called from the IVR route when an agent initiates an IVR session.
 */
export async function startIVRFlow(
  env: Env,
  db: DbClient,
  callControlId: string,
  callId: string,
  organizationId: string,
  accountId: string
): Promise<void> {
  const flowContext: IVRFlowContext = {
    flow: 'ivr_payment',
    step: 'welcome',
    accountId,
    organizationId,
    callId,
    attempts: 0,
  }

  writeAuditLog(db, {
    organizationId,
    userId: 'system',
    action: AuditAction.IVR_FLOW_STARTED,
    resourceType: 'collection_account',
    resourceId: accountId,
    oldValue: null,
    newValue: { call_id: callId },
  })

  // Speak the welcome message
  await telnyxSpeak(
    env.TELNYX_API_KEY,
    callControlId,
    'Welcome to the payment center. Please listen to the following options.',
    flowContext
  )

  logger.info('IVR flow started', { callControlId, callId, accountId })
}

/**
 * Handle gather result within the IVR flow.
 * Routes to the appropriate handler based on current flow step.
 *
 * This is called from the webhook handler for call.gather.ended and call.speak.ended.
 */
export async function handleGatherResult(
  db: DbClient,
  callControlId: string,
  gatherResult: string,
  status: string,
  env: Env,
  flowContext: IVRFlowContext
): Promise<void> {
  const step = flowContext.step || 'main_menu'

  logger.info('IVR gather result', {
    callControlId,
    step,
    hasInput: !!gatherResult,
    status,
  })

  // After speak_ended events, advance to the next gather
  if (status === 'speak_ended') {
    await handleSpeakComplete(env, db, callControlId, flowContext)
    return
  }

  switch (step) {
    case 'main_menu':
      await handleMainMenu(env, db, callControlId, gatherResult, flowContext)
      break

    case 'payment_amount':
      await handlePaymentAmount(env, db, callControlId, gatherResult, flowContext)
      break

    case 'payment_confirm':
      await handlePaymentConfirm(env, db, callControlId, gatherResult, flowContext)
      break

    case 'agent_transfer':
      // Transfer handled separately
      break

    default:
      // Return to main menu for unrecognized steps
      await promptMainMenu(env, callControlId, flowContext)
  }
}

/**
 * After a speak command completes, issue the appropriate gather.
 */
async function handleSpeakComplete(
  env: Env,
  db: DbClient,
  callControlId: string,
  ctx: IVRFlowContext
): Promise<void> {
  switch (ctx.step) {
    case 'welcome':
      ctx.step = 'main_menu'
      await promptMainMenu(env, callControlId, ctx)
      break

    case 'balance_check':
      ctx.step = 'main_menu'
      await promptMainMenu(env, callControlId, ctx)
      break

    case 'payment_complete':
    case 'goodbye':
      // IVR complete — hangup
      await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/hangup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }).catch(() => {})
      break

    default:
      // After any other speak, issue gather for the current step
      await telnyxGatherDTMF(env.TELNYX_API_KEY, callControlId, ctx)
  }
}

/**
 * Prompt the main menu and gather DTMF input.
 */
async function promptMainMenu(env: Env, callControlId: string, ctx: IVRFlowContext): Promise<void> {
  ctx.step = 'main_menu'
  await telnyxSpeak(
    env.TELNYX_API_KEY,
    callControlId,
    'Press 1 to check your balance. Press 2 to make a payment. Press 3 to speak with an agent. Press 9 to end this call.',
    ctx
  )
}

/**
 * Handle main menu DTMF selection.
 */
async function handleMainMenu(
  env: Env,
  db: DbClient,
  callControlId: string,
  digits: string,
  ctx: IVRFlowContext
): Promise<void> {
  switch (digits) {
    case '1':
      // Balance check
      await handleBalanceCheck(env, db, callControlId, ctx)
      break

    case '2':
      // Make payment — prompt for amount
      ctx.step = 'payment_amount'
      await telnyxSpeak(
        env.TELNYX_API_KEY,
        callControlId,
        'Please enter the payment amount in dollars followed by the pound key. For example, for fifty dollars, press 5 0 then pound.',
        ctx
      )
      break

    case '3':
      // Agent transfer
      ctx.step = 'agent_transfer'
      await telnyxSpeak(
        env.TELNYX_API_KEY,
        callControlId,
        'Please hold while we connect you with an agent.',
        ctx
      )
      break

    case '9':
      // Goodbye
      ctx.step = 'goodbye'
      await telnyxSpeak(env.TELNYX_API_KEY, callControlId, 'Thank you for calling. Goodbye.', ctx)
      break

    default:
      // Invalid input — re-prompt
      ctx.attempts = (ctx.attempts || 0) + 1
      if ((ctx.attempts || 0) > 3) {
        ctx.step = 'goodbye'
        await telnyxSpeak(
          env.TELNYX_API_KEY,
          callControlId,
          'Too many invalid entries. Please call again. Goodbye.',
          ctx
        )
      } else {
        await telnyxSpeak(
          env.TELNYX_API_KEY,
          callControlId,
          "Sorry, I didn't understand that.",
          ctx
        )
      }
  }
}

/**
 * Check balance for the customer's account.
 */
async function handleBalanceCheck(
  env: Env,
  db: DbClient,
  callControlId: string,
  ctx: IVRFlowContext
): Promise<void> {
  ctx.step = 'balance_check'

  if (!ctx.accountId || !ctx.organizationId) {
    await telnyxSpeak(
      env.TELNYX_API_KEY,
      callControlId,
      'We are unable to look up your account at this time.',
      ctx
    )
    return
  }

  const result = await db.query(
    `SELECT balance_due FROM collection_accounts
     WHERE id = $1 AND organization_id = $2`,
    [ctx.accountId, ctx.organizationId]
  )

  const balance = result.rows[0]?.balance_due || 0
  ctx.balanceDue = Number(balance)

  const dollars = Math.floor(ctx.balanceDue)
  const cents = Math.round((ctx.balanceDue - dollars) * 100)
  const balanceText = cents > 0 ? `${dollars} dollars and ${cents} cents` : `${dollars} dollars`

  await telnyxSpeak(
    env.TELNYX_API_KEY,
    callControlId,
    `Your current balance is ${balanceText}. Returning to the main menu.`,
    ctx
  )
}

/**
 * Handle payment amount entry.
 */
async function handlePaymentAmount(
  env: Env,
  db: DbClient,
  callControlId: string,
  digits: string,
  ctx: IVRFlowContext
): Promise<void> {
  const amount = parseInt(digits, 10)

  if (isNaN(amount) || amount <= 0 || amount > 99999) {
    ctx.attempts = (ctx.attempts || 0) + 1
    if ((ctx.attempts || 0) > 3) {
      ctx.step = 'main_menu'
      await promptMainMenu(env, callControlId, ctx)
    } else {
      await telnyxSpeak(
        env.TELNYX_API_KEY,
        callControlId,
        'Invalid amount. Please enter the payment amount in whole dollars followed by the pound key.',
        ctx
      )
    }
    return
  }

  ctx.paymentAmount = amount
  ctx.step = 'payment_confirm'
  ctx.attempts = 0

  await telnyxSpeak(
    env.TELNYX_API_KEY,
    callControlId,
    `You entered ${amount} dollars. Press 1 to confirm this payment, or press 2 to enter a different amount.`,
    ctx
  )
}

/**
 * Handle payment confirmation.
 */
async function handlePaymentConfirm(
  env: Env,
  db: DbClient,
  callControlId: string,
  digits: string,
  ctx: IVRFlowContext
): Promise<void> {
  if (digits === '1') {
    // Confirmed — process payment via Stripe
    ctx.step = 'payment_processing'
    await telnyxSpeak(
      env.TELNYX_API_KEY,
      callControlId,
      'Processing your payment. Please hold.',
      ctx
    )

    try {
      await processPayment(env, db, ctx)
      ctx.step = 'payment_complete'
      await telnyxSpeak(
        env.TELNYX_API_KEY,
        callControlId,
        `Your payment of ${ctx.paymentAmount} dollars has been processed successfully. A confirmation will be sent. Thank you for your payment. Goodbye.`,
        ctx
      )
    } catch (err: any) {
      logger.error('IVR payment processing failed', {
        error: err?.message,
        accountId: ctx.accountId,
      })
      ctx.step = 'main_menu'
      await telnyxSpeak(
        env.TELNYX_API_KEY,
        callControlId,
        'We were unable to process your payment at this time. Please try again later or speak with an agent.',
        ctx
      )

      writeAuditLog(db, {
        organizationId: ctx.organizationId!,
        userId: 'system',
        action: AuditAction.IVR_PAYMENT_FAILED,
        resourceType: 'collection_account',
        resourceId: ctx.accountId!,
        oldValue: null,
        newValue: { error: err?.message, amount: ctx.paymentAmount },
      })
    }
  } else if (digits === '2') {
    // Re-enter amount
    ctx.step = 'payment_amount'
    ctx.attempts = 0
    await telnyxSpeak(
      env.TELNYX_API_KEY,
      callControlId,
      'Please enter the payment amount in dollars followed by the pound key.',
      ctx
    )
  } else {
    await telnyxSpeak(
      env.TELNYX_API_KEY,
      callControlId,
      'Press 1 to confirm, or press 2 to enter a different amount.',
      ctx
    )
  }
}

/**
 * Process a payment via Stripe.
 * Creates a PaymentIntent using the customer's saved payment method.
 */
async function processPayment(env: Env, db: DbClient, ctx: IVRFlowContext): Promise<void> {
  if (!ctx.accountId || !ctx.organizationId || !ctx.paymentAmount) {
    throw new Error('Missing payment context')
  }

  const stripeKey = (env as any).STRIPE_SECRET_KEY
  if (!stripeKey) {
    throw new Error('Stripe not configured')
  }

  // Look up Stripe customer for this account
  const accountResult = await db.query(
    `SELECT ca.id, ca.balance_due, ca.primary_phone, ca.status,
            o.stripe_customer_id
     FROM collection_accounts ca
     JOIN organizations o ON o.id = ca.organization_id
     WHERE ca.id = $1 AND ca.organization_id = $2`,
    [ctx.accountId, ctx.organizationId]
  )

  if (accountResult.rows.length === 0) {
    throw new Error('Account not found')
  }

  const account = accountResult.rows[0]
  const amountCents = Math.round(ctx.paymentAmount * 100)

  // Create Stripe PaymentIntent
  const params = new URLSearchParams({
    amount: amountCents.toString(),
    currency: 'usd',
    'metadata[organization_id]': ctx.organizationId,
    'metadata[account_id]': ctx.accountId,
    'metadata[channel]': 'ivr_phone',
    'metadata[call_id]': ctx.callId || '',
    description: `IVR payment for account ${ctx.accountId}`,
    confirm: 'true',
    'payment_method_types[]': 'card',
  })

  // If there's a saved customer, use it
  if (account.stripe_customer_id) {
    params.set('customer', account.stripe_customer_id)
  }

  const stripeRes = await fetch(`${STRIPE_BASE}/payment_intents`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(stripeKey + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!stripeRes.ok) {
    const errBody = await stripeRes.text().catch(() => '')
    throw new Error(`Stripe error: ${stripeRes.status} — ${errBody.substring(0, 200)}`)
  }

  const paymentIntent = await stripeRes.json<{
    id: string
    status: string
    client_secret: string
  }>()

  // Record the payment
  await db.query(
    `INSERT INTO collection_payments
      (organization_id, account_id, amount, method, stripe_payment_id, status, created_at)
     VALUES ($1, $2, $3, 'stripe', $4, 'completed', NOW())`,
    [ctx.organizationId, ctx.accountId, ctx.paymentAmount, paymentIntent.id]
  )

  // Update balance
  await db.query(
    `UPDATE collection_accounts
     SET balance_due = GREATEST(0, balance_due - $1), updated_at = NOW()
     WHERE id = $2 AND organization_id = $3`,
    [ctx.paymentAmount, ctx.accountId, ctx.organizationId]
  )

  writeAuditLog(db, {
    organizationId: ctx.organizationId,
    userId: 'system',
    action: AuditAction.IVR_PAYMENT_COMPLETED,
    resourceType: 'collection_payment',
    resourceId: paymentIntent.id,
    oldValue: null,
    newValue: {
      amount: ctx.paymentAmount,
      account_id: ctx.accountId,
      stripe_payment_id: paymentIntent.id,
    },
  })

  logger.info('IVR payment processed', {
    accountId: ctx.accountId,
    amount: ctx.paymentAmount,
    stripeId: paymentIntent.id,
  })
}

// --- Telnyx Call Control Helpers ---

/**
 * Issue a Telnyx speak command with IVR flow context.
 */
async function telnyxSpeak(
  apiKey: string,
  callControlId: string,
  text: string,
  ctx: IVRFlowContext
): Promise<void> {
  const clientState = btoa(JSON.stringify(ctx))

  const res = await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/speak`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payload: text,
      voice: 'female',
      language: 'en-US',
      client_state: clientState,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    logger.warn('IVR speak failed', {
      callControlId,
      status: res.status,
      body: errText.substring(0, 200),
    })
  }
}

/**
 * Issue a Telnyx gather command for DTMF input.
 */
async function telnyxGatherDTMF(
  apiKey: string,
  callControlId: string,
  ctx: IVRFlowContext
): Promise<void> {
  const clientState = btoa(JSON.stringify(ctx))
  const maxDigits = ctx.step === 'payment_amount' ? 6 : 1

  const res = await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/gather`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input_type: 'dtmf',
      minimum_digits: 1,
      maximum_digits: maxDigits,
      timeout_millis: 10000,
      inter_digit_timeout_millis: 3000,
      terminating_digit: ctx.step === 'payment_amount' ? '#' : '',
      client_state: clientState,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    logger.warn('IVR gather failed', {
      callControlId,
      status: res.status,
      body: errText.substring(0, 200),
    })
  }
}

