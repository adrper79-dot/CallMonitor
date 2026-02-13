/**
 * Stripe Data Sync Utility
 *
 * Syncs Stripe data into mirror tables for improved performance and reliability.
 * Used for backfilling existing data and periodic sync operations.
 *
 * Mirror Tables:
 * - stripe_invoices: Invoice data with status, amounts, URLs
 * - stripe_payment_methods: Payment method details
 * - stripe_subscriptions: Subscription data with plans and periods
 */

import { getDb } from './db'
import { logger } from './logger'

export interface StripeSyncOptions {
  organizationId?: string
  force?: boolean // Force sync even if data exists
  limit?: number // Limit number of records to sync
}

/**
 * Sync all Stripe data for an organization into mirror tables
 */
export async function syncStripeData(options: StripeSyncOptions = {}) {
  const { organizationId, force = false, limit = 100 } = options

  if (!process.env.STRIPE_SECRET_KEY) {
    logger.warn('STRIPE_SECRET_KEY not configured, skipping Stripe sync')
    return { success: false, error: 'Stripe not configured' }
  }

  const db = getDb(process.env as any)
  try {
    // Get all organizations with Stripe customer IDs
    let orgQuery = 'SELECT id, stripe_customer_id FROM organizations WHERE stripe_customer_id IS NOT NULL'
    let params: any[] = []

    if (organizationId) {
      orgQuery += ' AND id = $1'
      params.push(organizationId)
    }

    const orgs = await db.query(orgQuery, params)

    if (orgs.rows.length === 0) {
      return { success: true, message: 'No organizations with Stripe customers found' }
    }

    let totalSynced = 0

    for (const org of orgs.rows) {
      try {
        const customerId = org.stripe_customer_id
        logger.info('Syncing Stripe data for organization', { organizationId: org.id, customerId })

        // Sync invoices
        const invoicesSynced = await syncInvoicesForCustomer(db, org.id, customerId, { force, limit })
        totalSynced += invoicesSynced

        // Sync payment methods
        const paymentMethodsSynced = await syncPaymentMethodsForCustomer(db, org.id, customerId, { force })
        totalSynced += paymentMethodsSynced

        // Sync subscriptions
        const subscriptionsSynced = await syncSubscriptionsForCustomer(db, org.id, customerId, { force })
        totalSynced += subscriptionsSynced

      } catch (err) {
        logger.error('Failed to sync Stripe data for organization', {
          organizationId: org.id,
          error: String(err)
        })
      }
    }

    logger.info('Stripe data sync completed', { totalSynced })
    return { success: true, totalSynced }

  } catch (err: any) {
    logger.error('Stripe data sync failed', { error: err?.message })
    return { success: false, error: err?.message }
  } finally {
    await db.end()
  }
}

/**
 * Sync invoices for a specific customer
 */
async function syncInvoicesForCustomer(
  db: any,
  organizationId: string,
  customerId: string,
  options: { force?: boolean; limit?: number }
) {
  const { force = false, limit = 100 } = options

  try {
    // Check if we already have recent invoice data
    if (!force) {
      const recentCount = await db.query(
        `SELECT COUNT(*) as count FROM stripe_invoices
         WHERE organization_id = $1 AND updated_at > NOW() - INTERVAL '1 hour'`,
        [organizationId]
      )
      if (recentCount.rows[0].count > 0) {
        logger.info('Skipping invoice sync - recent data exists', { organizationId })
        return 0
      }
    }

    // Fetch invoices from Stripe
    const response = await fetch(
      `https://api.stripe.com/v1/invoices?customer=${customerId}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
      }
    )

    if (!response.ok) {
      throw new Error(`Stripe API error: ${response.status}`)
    }

    const data: any = await response.json()
    let synced = 0

    for (const invoice of data.data || []) {
      try {
        await db.query(
          `INSERT INTO stripe_invoices (
            organization_id, stripe_invoice_id, stripe_customer_id, stripe_subscription_id,
            status, amount_due_cents, amount_paid_cents, currency,
            invoice_date, due_date, paid_at, hosted_invoice_url, invoice_pdf_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (stripe_invoice_id) DO UPDATE SET
            status = EXCLUDED.status,
            amount_paid_cents = EXCLUDED.amount_paid_cents,
            paid_at = EXCLUDED.paid_at,
            hosted_invoice_url = EXCLUDED.hosted_invoice_url,
            invoice_pdf_url = EXCLUDED.invoice_pdf_url,
            updated_at = NOW()`,
          [
            organizationId,
            invoice.id,
            invoice.customer,
            invoice.subscription,
            invoice.status,
            invoice.amount_due,
            invoice.amount_paid,
            invoice.currency,
            invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
            invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
            invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
            invoice.hosted_invoice_url,
            invoice.invoice_pdf,
          ]
        )
        synced++
      } catch (err) {
        logger.warn('Failed to sync invoice', { invoiceId: invoice.id, error: String(err) })
      }
    }

    logger.info('Synced invoices for customer', { organizationId, customerId, synced })
    return synced

  } catch (err) {
    logger.error('Failed to sync invoices for customer', { organizationId, customerId, error: String(err) })
    return 0
  }
}

/**
 * Sync payment methods for a specific customer
 */
async function syncPaymentMethodsForCustomer(
  db: any,
  organizationId: string,
  customerId: string,
  options: { force?: boolean }
) {
  const { force = false } = options

  try {
    // Check if we already have recent payment method data
    if (!force) {
      const recentCount = await db.query(
        `SELECT COUNT(*) as count FROM stripe_payment_methods
         WHERE organization_id = $1 AND updated_at > NOW() - INTERVAL '1 hour'`,
        [organizationId]
      )
      if (recentCount.rows[0].count > 0) {
        logger.info('Skipping payment method sync - recent data exists', { organizationId })
        return 0
      }
    }

    // Fetch payment methods from Stripe
    const response = await fetch(
      `https://api.stripe.com/v1/payment_methods?customer=${customerId}&type=card&limit=10`,
      {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
      }
    )

    if (!response.ok) {
      throw new Error(`Stripe API error: ${response.status}`)
    }

    const data: any = await response.json()
    let synced = 0

    for (const pm of data.data || []) {
      try {
        await db.query(
          `INSERT INTO stripe_payment_methods (
            organization_id, stripe_customer_id, stripe_payment_method_id,
            type, card_brand, card_last4, card_exp_month, card_exp_year
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (stripe_payment_method_id) DO UPDATE SET
            card_brand = EXCLUDED.card_brand,
            card_last4 = EXCLUDED.card_last4,
            card_exp_month = EXCLUDED.card_exp_month,
            card_exp_year = EXCLUDED.card_exp_year,
            updated_at = NOW()`,
          [
            organizationId,
            customerId,
            pm.id,
            pm.type,
            pm.card?.brand,
            pm.card?.last4,
            pm.card?.exp_month,
            pm.card?.exp_year,
          ]
        )
        synced++
      } catch (err) {
        logger.warn('Failed to sync payment method', { paymentMethodId: pm.id, error: String(err) })
      }
    }

    logger.info('Synced payment methods for customer', { organizationId, customerId, synced })
    return synced

  } catch (err) {
    logger.error('Failed to sync payment methods for customer', { organizationId, customerId, error: String(err) })
    return 0
  }
}

/**
 * Sync subscriptions for a specific customer
 */
async function syncSubscriptionsForCustomer(
  db: any,
  organizationId: string,
  customerId: string,
  options: { force?: boolean }
) {
  const { force = false } = options

  try {
    // Check if we already have recent subscription data
    if (!force) {
      const recentCount = await db.query(
        `SELECT COUNT(*) as count FROM stripe_subscriptions
         WHERE organization_id = $1 AND updated_at > NOW() - INTERVAL '1 hour'`,
        [organizationId]
      )
      if (recentCount.rows[0].count > 0) {
        logger.info('Skipping subscription sync - recent data exists', { organizationId })
        return 0
      }
    }

    // Fetch subscriptions from Stripe
    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customerId}&limit=10`,
      {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
      }
    )

    if (!response.ok) {
      throw new Error(`Stripe API error: ${response.status}`)
    }

    const data: any = await response.json()
    let synced = 0

    for (const subscription of data.data || []) {
      try {
        const price = subscription.items.data[0]?.price
        await db.query(
          `INSERT INTO stripe_subscriptions (
            organization_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
            plan, status, current_period_start, current_period_end, cancel_at_period_end,
            canceled_at, amount_cents, currency, interval, trial_start, trial_end
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (stripe_subscription_id) DO UPDATE SET
            status = EXCLUDED.status,
            current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end,
            cancel_at_period_end = EXCLUDED.cancel_at_period_end,
            canceled_at = EXCLUDED.canceled_at,
            updated_at = NOW()`,
          [
            organizationId,
            subscription.customer,
            subscription.id,
            price?.id,
            price?.metadata?.plan || 'free', // Map price to plan name
            subscription.status,
            new Date(subscription.current_period_start * 1000).toISOString(),
            new Date(subscription.current_period_end * 1000).toISOString(),
            subscription.cancel_at_period_end,
            subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            price?.unit_amount || 0,
            price?.currency || 'usd',
            price?.recurring?.interval || 'month',
            subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
            subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          ]
        )
        synced++
      } catch (err) {
        logger.warn('Failed to sync subscription', { subscriptionId: subscription.id, error: String(err) })
      }
    }

    logger.info('Synced subscriptions for customer', { organizationId, customerId, synced })
    return synced

  } catch (err) {
    logger.error('Failed to sync subscriptions for customer', { organizationId, customerId, error: String(err) })
    return 0
  }
}

/**
 * Clean up old mirror data to prevent table bloat
 * Removes data older than the specified retention period
 */
export async function cleanupOldStripeData(retentionDays: number = 90) {
  const db = getDb(process.env as any)
  try {
    logger.info('Starting cleanup of old Stripe mirror data', { retentionDays })

    // Clean up old invoices (keep successful ones longer)
    const invoiceCleanup = await db.query(
      `DELETE FROM stripe_invoices
       WHERE updated_at < NOW() - INTERVAL '${retentionDays} days'
       AND status NOT IN ('paid', 'open')`, // Keep recent paid/open invoices
    )

    // Clean up old payment methods (keep active ones)
    const pmCleanup = await db.query(
      `DELETE FROM stripe_payment_methods
       WHERE updated_at < NOW() - INTERVAL '${retentionDays} days'
       AND is_default = false`, // Keep default payment methods
    )

    // Clean up old subscriptions (keep active ones)
    const subCleanup = await db.query(
      `DELETE FROM stripe_subscriptions
       WHERE updated_at < NOW() - INTERVAL '${retentionDays} days'
       AND status NOT IN ('active', 'trialing')`, // Keep active subscriptions
    )

    const totalCleaned = (invoiceCleanup.rowCount ?? 0) + (pmCleanup.rowCount ?? 0) + (subCleanup.rowCount ?? 0)

    logger.info('Cleaned up old Stripe mirror data', {
      invoices: invoiceCleanup.rowCount,
      paymentMethods: pmCleanup.rowCount,
      subscriptions: subCleanup.rowCount,
      total: totalCleaned
    })

    return { success: true, cleaned: totalCleaned }

  } catch (err: any) {
    logger.error('Failed to cleanup old Stripe data', { error: err?.message })
    return { success: false, error: err?.message }
  } finally {
    await db.end()
  }
}

/**
 * Validate mirror data consistency
 * Checks for orphaned records and data integrity issues
 */
export async function validateStripeMirrorData() {
  const db = getDb(process.env as any)
  try {
    logger.info('Starting validation of Stripe mirror data')

    const issues: string[] = []

    // Check for invoices without valid organization
    const orphanedInvoices = await db.query(
      `SELECT COUNT(*) as count FROM stripe_invoices si
       LEFT JOIN organizations o ON si.organization_id = o.id
       WHERE o.id IS NULL`
    )
    if (orphanedInvoices.rows[0].count > 0) {
      issues.push(`Found ${orphanedInvoices.rows[0].count} orphaned invoices`)
    }

    // Check for payment methods without valid organization
    const orphanedPMs = await db.query(
      `SELECT COUNT(*) as count FROM stripe_payment_methods spm
       LEFT JOIN organizations o ON spm.organization_id = o.id
       WHERE o.id IS NULL`
    )
    if (orphanedPMs.rows[0].count > 0) {
      issues.push(`Found ${orphanedPMs.rows[0].count} orphaned payment methods`)
    }

    // Check for subscriptions without valid organization
    const orphanedSubs = await db.query(
      `SELECT COUNT(*) as count FROM stripe_subscriptions ss
       LEFT JOIN organizations o ON ss.organization_id = o.id
       WHERE o.id IS NULL`
    )
    if (orphanedSubs.rows[0].count > 0) {
      issues.push(`Found ${orphanedSubs.rows[0].count} orphaned subscriptions`)
    }

    // Check for data consistency (customer IDs match)
    const inconsistentInvoices = await db.query(
      `SELECT COUNT(*) as count FROM stripe_invoices si
       JOIN organizations o ON si.organization_id = o.id
       WHERE si.stripe_customer_id != o.stripe_customer_id`
    )
    if (inconsistentInvoices.rows[0].count > 0) {
      issues.push(`Found ${inconsistentInvoices.rows[0].count} invoices with inconsistent customer IDs`)
    }

    if (issues.length === 0) {
      logger.info('Stripe mirror data validation passed')
      return { success: true, valid: true }
    } else {
      logger.warn('Stripe mirror data validation found issues', { issues })
      return { success: true, valid: false, issues }
    }

  } catch (err: any) {
    logger.error('Failed to validate Stripe mirror data', { error: err?.message })
    return { success: false, error: err?.message }
  } finally {
    await db.end()
  }
}