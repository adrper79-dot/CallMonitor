# Revenue Infrastructure Implementation Plan

**Date:** January 16, 2026  
**Status:** READY FOR EXECUTION  
**Agent:** Sonnet 4.5  
**Objective:** Enable revenue generation via usage metering + Stripe billing

---

## 📋 Executive Summary

**Current State:** Platform has plan gates in code but no billing integration → $0 MRR  
**Target State:** Usage metering + Stripe integration → Path to $20k MRR  
**Success Criteria:** First paid customer within 2 sprints

**Critical Path:**
```
Usage Metering → Stripe Integration → Revenue
        ↓                ↓
   Plan Limits    Subscription Flow
        ↓                ↓
   User Value      Payment Processing
```

---

## 🎯 Architecture Compliance Checklist

All implementations must adhere to:

✅ **Call-Rooted Design** - Usage metering tracks calls, not abstract "credits"  
✅ **System of Record** - Database is authoritative for usage/billing data  
✅ **Audit Logging** - All plan changes, payments, and usage events logged  
✅ **Graceful Degradation** - Plan limits enforced but never break existing calls  
✅ **RBAC Enforcement** - Only owner/admin can manage billing  
✅ **Error Handling** - Use AppError pattern per ERROR_HANDLING_REVIEW.md  
✅ **Rate Limiting** - Apply to all new API endpoints  

**Reference:** [ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt](ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt)

---

## 🚀 Phase 1: Usage Metering Foundation

### **Objective:** Track calls and minutes per organization to enable accurate billing

### **1.1 Database Schema**

**File:** `supabase/migrations/20260116_usage_metering.sql`

```sql
-- Usage Records Table
-- Tracks all billable usage events per organization
-- Per ARCH_DOCS: Call-rooted design - usage tied to calls

CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  
  -- Usage metrics
  metric TEXT NOT NULL CHECK (metric IN ('call', 'minute', 'transcription', 'translation', 'ai_run')),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost_cents INTEGER, -- For historical pricing tracking
  
  -- Billing period tracking
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_usage_records_org_period 
  ON public.usage_records(organization_id, billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_usage_records_call 
  ON public.usage_records(call_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_metric 
  ON public.usage_records(organization_id, metric);

-- RLS Policies
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's usage"
  ON public.usage_records FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members
      WHERE user_id = auth.uid()
    )
  );

-- Only service role can insert usage records
CREATE POLICY "Service role can insert usage"
  ON public.usage_records FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Usage Limits Table
-- Defines plan limits for enforcement
CREATE TABLE IF NOT EXISTS public.usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT NOT NULL UNIQUE,
  
  -- Monthly limits
  calls_per_month INTEGER NOT NULL DEFAULT 0,
  minutes_per_month INTEGER NOT NULL DEFAULT 0,
  transcriptions_per_month INTEGER NOT NULL DEFAULT 0,
  translations_per_month INTEGER NOT NULL DEFAULT 0,
  
  -- Feature flags
  can_record BOOLEAN NOT NULL DEFAULT false,
  can_transcribe BOOLEAN NOT NULL DEFAULT false,
  can_translate BOOLEAN NOT NULL DEFAULT false,
  can_use_secret_shopper BOOLEAN NOT NULL DEFAULT false,
  
  -- Overage handling
  allow_overage BOOLEAN NOT NULL DEFAULT false,
  overage_rate_cents INTEGER, -- Cost per unit over limit
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed usage limits for each plan
INSERT INTO public.usage_limits (plan, calls_per_month, minutes_per_month, transcriptions_per_month, translations_per_month, can_record, can_transcribe, can_translate, can_use_secret_shopper, allow_overage) VALUES
  ('free', 0, 0, 0, 0, false, false, false, false, false),
  ('pro', 500, 5000, 500, 0, true, true, false, false, true),
  ('business', 2000, 20000, 2000, 2000, true, true, true, true, true),
  ('enterprise', 999999, 999999, 999999, 999999, true, true, true, true, true)
ON CONFLICT (plan) DO NOTHING;

COMMENT ON TABLE public.usage_records IS 'Tracks billable usage events per organization';
COMMENT ON TABLE public.usage_limits IS 'Defines plan limits for usage enforcement';
```

**Validation Criteria:**
- [ ] Tables created without errors
- [ ] RLS policies active
- [ ] Indexes created
- [ ] Seed data inserted for all plans

---

### **1.2 Usage Tracking Service**

**File:** `lib/services/usageTracker.ts`

```typescript
/**
 * Usage Tracking Service
 * 
 * Tracks billable usage events per organization.
 * Per ARCH_DOCS: Call-rooted design - usage tied to calls.
 * 
 * @see ERROR_HANDLING_REVIEW.md - Uses AppError for structured errors
 * @see MASTER_ARCHITECTURE.txt - System of record compliance
 */

import { createClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors/AppError'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, serviceKey)

export type UsageMetric = 'call' | 'minute' | 'transcription' | 'translation' | 'ai_run'

interface TrackUsageParams {
  organizationId: string
  callId?: string
  metric: UsageMetric
  quantity: number
  metadata?: Record<string, any>
}

interface UsageSummary {
  calls: number
  minutes: number
  transcriptions: number
  translations: number
  period_start: string
  period_end: string
}

/**
 * Track a usage event
 * 
 * Per ARCH_DOCS: Audit logging for all usage events
 */
export async function trackUsage(params: TrackUsageParams): Promise<void> {
  const { organizationId, callId, metric, quantity, metadata } = params

  try {
    // Get current billing period (calendar month)
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const { error } = await supabaseAdmin
      .from('usage_records')
      .insert({
        organization_id: organizationId,
        call_id: callId,
        metric,
        quantity,
        billing_period_start: periodStart.toISOString(),
        billing_period_end: periodEnd.toISOString(),
        metadata: metadata || {}
      })

    if (error) {
      logger.error('Failed to track usage', error, { organizationId, metric, quantity })
      throw new AppError({
        code: 'USAGE_TRACKING_FAILED',
        message: `Failed to track ${metric} usage`,
        user_message: 'Unable to record usage. Please contact support.',
        severity: 'HIGH',
        retriable: true,
        context: { organizationId, metric, quantity }
      })
    }

    logger.info('Usage tracked', { organizationId, metric, quantity, callId })

  } catch (err: any) {
    if (err instanceof AppError) throw err
    throw new AppError({
      code: 'USAGE_TRACKING_ERROR',
      message: 'Unexpected error tracking usage',
      user_message: 'Unable to record usage. Please contact support.',
      severity: 'HIGH',
      retriable: true,
      context: { error: err.message }
    })
  }
}

/**
 * Get usage summary for current billing period
 * 
 * Used in Settings → Billing tab to show usage
 */
export async function getUsageSummary(organizationId: string): Promise<UsageSummary> {
  try {
    // Get current billing period
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const { data: records, error } = await supabaseAdmin
      .from('usage_records')
      .select('metric, quantity')
      .eq('organization_id', organizationId)
      .gte('billing_period_start', periodStart.toISOString())
      .lte('billing_period_end', periodEnd.toISOString())

    if (error) {
      throw new AppError({
        code: 'USAGE_FETCH_FAILED',
        message: 'Failed to fetch usage summary',
        user_message: 'Unable to load usage data.',
        severity: 'MEDIUM',
        retriable: true
      })
    }

    // Aggregate by metric
    const summary: UsageSummary = {
      calls: 0,
      minutes: 0,
      transcriptions: 0,
      translations: 0,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString()
    }

    records?.forEach(record => {
      if (record.metric === 'call') summary.calls += record.quantity
      if (record.metric === 'minute') summary.minutes += record.quantity
      if (record.metric === 'transcription') summary.transcriptions += record.quantity
      if (record.metric === 'translation') summary.translations += record.quantity
    })

    return summary

  } catch (err: any) {
    if (err instanceof AppError) throw err
    throw new AppError({
      code: 'USAGE_SUMMARY_ERROR',
      message: 'Failed to generate usage summary',
      user_message: 'Unable to load usage data.',
      severity: 'MEDIUM',
      retriable: true
    })
  }
}

/**
 * Check if organization has exceeded usage limits
 * 
 * Used before executing calls to enforce plan limits
 */
export async function checkUsageLimits(
  organizationId: string,
  plan: string,
  metric: UsageMetric
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Get plan limits
    const { data: limits, error: limitsError } = await supabaseAdmin
      .from('usage_limits')
      .select('*')
      .eq('plan', plan.toLowerCase())
      .single()

    if (limitsError || !limits) {
      logger.warn('Plan limits not found, allowing usage', { plan })
      return { allowed: true } // Fail open for now
    }

    // Get current usage
    const usage = await getUsageSummary(organizationId)

    // Check specific metric
    if (metric === 'call' && usage.calls >= limits.calls_per_month) {
      return { 
        allowed: false, 
        reason: `Monthly call limit reached (${limits.calls_per_month} calls)` 
      }
    }

    if (metric === 'minute' && usage.minutes >= limits.minutes_per_month) {
      return { 
        allowed: false, 
        reason: `Monthly minute limit reached (${limits.minutes_per_month} minutes)` 
      }
    }

    if (metric === 'transcription' && usage.transcriptions >= limits.transcriptions_per_month) {
      return { 
        allowed: false, 
        reason: `Monthly transcription limit reached (${limits.transcriptions_per_month})` 
      }
    }

    if (metric === 'translation' && usage.translations >= limits.translations_per_month) {
      return { 
        allowed: false, 
        reason: `Monthly translation limit reached (${limits.translations_per_month})` 
      }
    }

    return { allowed: true }

  } catch (err: any) {
    logger.error('Error checking usage limits', err, { organizationId, plan, metric })
    // Fail open to avoid breaking calls
    return { allowed: true }
  }
}
```

**Validation Criteria:**
- [ ] TypeScript compiles without errors
- [ ] Exports all required functions
- [ ] Uses AppError for structured error handling
- [ ] Includes audit logging via logger

---

### **1.3 Integration into Call Flow**

**File:** `app/actions/calls/startCallHandler.ts`

**Changes Required:**

1. Import usage tracker at top of file
2. Track call usage after SignalWire call initiated
3. Track minute usage when call completes (in webhook handler)

```typescript
// Add to imports
import { trackUsage, checkUsageLimits } from '@/lib/services/usageTracker'

// Add before placing call (around line 350)
// Check usage limits before executing call
const usageCheck = await checkUsageLimits(organization_id, org.plan, 'call')
if (!usageCheck.allowed) {
  const err = new AppError({
    code: 'USAGE_LIMIT_EXCEEDED',
    message: usageCheck.reason || 'Usage limit exceeded',
    user_message: usageCheck.reason || 'Your monthly call limit has been reached. Please upgrade your plan.',
    severity: 'MEDIUM',
    retriable: false
  })
  await writeAuditError('calls', callId, err.toJSON())
  throw err
}

// Add after successful call placement (around line 270)
// Track call usage
await trackUsage({
  organizationId: organization_id,
  callId,
  metric: 'call',
  quantity: 1,
  metadata: {
    phone_number,
    flow_type: 'outbound',
    plan: org.plan
  }
})
```

**File:** `app/api/webhooks/signalwire/route.ts`

**Add to call completion handler:**

```typescript
// When call ends, track duration
if (event.call_state === 'ended' && event.call_id) {
  const duration = event.call_duration // in seconds
  const minutes = Math.ceil(duration / 60)
  
  await trackUsage({
    organizationId: call.organization_id,
    callId: call.id,
    metric: 'minute',
    quantity: minutes,
    metadata: {
      duration_seconds: duration,
      call_state: 'ended'
    }
  })
}
```

**Validation Criteria:**
- [ ] Usage tracked on every call start
- [ ] Limits enforced before call placement
- [ ] Minutes tracked when call ends
- [ ] Existing call flow not broken

---

### **1.4 Usage Display UI**

**File:** `app/api/usage/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server'
import { requireAuth, success, Errors } from '@/lib/api/utils'
import { getUsageSummary } from '@/lib/services/usageTracker'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/usage
 * Get usage summary for current billing period
 */
async function handleGET() {
  const ctx = await requireAuth()
  if (ctx instanceof NextResponse) return ctx

  try {
    const summary = await getUsageSummary(ctx.orgId)
    return success({ usage: summary })
  } catch (err: any) {
    return Errors.internal(err)
  }
}

export const GET = withRateLimit(handleGET, {
  identifier: (req: Request) => getClientIP(req),
  config: {
    maxAttempts: 60,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000
  }
})
```

**File:** `app/settings/page.tsx`

**Update Billing tab to display usage:**

```typescript
// Add to SettingsPageContent component state
const [usage, setUsage] = useState<any>(null)

// Add useEffect to fetch usage
useEffect(() => {
  if (activeTab === 'billing' && organizationId) {
    fetch('/api/usage', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setUsage(data.usage)
        }
      })
  }
}, [activeTab, organizationId])

// Update the billing tab UI (replace "—" placeholders)
<div className="bg-gray-50 rounded-md p-4">
  <p className="text-sm text-gray-500">Calls this month</p>
  <p className="text-xl font-semibold text-gray-900">
    {usage?.calls || 0}
  </p>
</div>
<div className="bg-gray-50 rounded-md p-4">
  <p className="text-sm text-gray-500">Minutes used</p>
  <p className="text-xl font-semibold text-gray-900">
    {usage?.minutes || 0}
  </p>
</div>
```

**Validation Criteria:**
- [ ] API endpoint returns usage data
- [ ] Settings page displays real usage numbers
- [ ] Data updates when tab changes
- [ ] No errors in console

---

## 🚀 Phase 2: Stripe Integration

### **Objective:** Enable subscription management and payment processing

### **2.1 Database Schema for Billing**

**File:** `supabase/migrations/20260117_stripe_billing.sql`

```sql
-- Stripe Subscriptions Tracking
-- Links Stripe subscription IDs to organizations

CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Stripe identifiers
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_payment_method_id TEXT,
  
  -- Subscription details
  plan TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
  
  -- Billing period
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoices for record-keeping
CREATE TABLE IF NOT EXISTS public.stripe_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  
  -- Invoice details
  amount_due_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  
  -- Dates
  invoice_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  
  -- Download URL
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_subs_org 
  ON public.stripe_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_customer 
  ON public.stripe_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_org 
  ON public.stripe_invoices(organization_id);

-- RLS Policies
ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_invoices ENABLE ROW LEVEL SECURITY;

-- Only owners can view billing info
CREATE POLICY "Owners can view subscription"
  ON public.stripe_subscriptions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Owners can view invoices"
  ON public.stripe_invoices FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Add updated_at trigger for subscriptions
CREATE OR REPLACE FUNCTION update_stripe_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stripe_subscriptions_updated_at
  BEFORE UPDATE ON public.stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_subscriptions_updated_at();

COMMENT ON TABLE public.stripe_subscriptions IS 'Tracks Stripe subscription state per organization';
COMMENT ON TABLE public.stripe_invoices IS 'Historical record of Stripe invoices';
```

**Validation Criteria:**
- [ ] Tables created successfully
- [ ] RLS policies enforced (only owners can view)
- [ ] Triggers active

---

### **2.2 Stripe Service Layer**

**File:** `lib/services/stripeService.ts`

```typescript
/**
 * Stripe Service
 * 
 * Handles all Stripe API interactions.
 * Per ARCH_DOCS: System of record - Supabase tracks subscription state.
 * 
 * @see ERROR_HANDLING_REVIEW.md - Uses AppError
 */

import Stripe from 'stripe'
import { AppError } from '@/lib/errors/AppError'
import { logger } from '@/lib/logger'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, serviceKey)

export type PlanTier = 'pro' | 'business' | 'enterprise'

// Stripe Price IDs (set in Stripe Dashboard)
const STRIPE_PRICES: Record<PlanTier, string> = {
  pro: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
  business: process.env.STRIPE_PRICE_BUSINESS || 'price_business_monthly',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_monthly'
}

/**
 * Create Stripe checkout session for plan upgrade
 */
export async function createCheckoutSession(params: {
  organizationId: string
  plan: PlanTier
  successUrl: string
  cancelUrl: string
  customerEmail?: string
}): Promise<{ sessionId: string; url: string }> {
  const { organizationId, plan, successUrl, cancelUrl, customerEmail } = params

  try {
    // Check if customer already exists
    const { data: existing } = await supabaseAdmin
      .from('stripe_subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', organizationId)
      .single()

    let customerId = existing?.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          organization_id: organizationId
        }
      })
      customerId = customer.id
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRICES[plan],
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organization_id: organizationId,
        plan
      }
    })

    logger.info('Stripe checkout session created', { 
      organizationId, 
      plan, 
      sessionId: session.id 
    })

    return {
      sessionId: session.id,
      url: session.url!
    }

  } catch (err: any) {
    logger.error('Failed to create Stripe checkout session', err, { organizationId, plan })
    throw new AppError({
      code: 'STRIPE_CHECKOUT_FAILED',
      message: 'Failed to create checkout session',
      user_message: 'Unable to start checkout. Please try again.',
      severity: 'HIGH',
      retriable: true
    })
  }
}

/**
 * Handle successful subscription (called from webhook)
 */
export async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const organizationId = subscription.metadata.organization_id
  const plan = subscription.metadata.plan

  if (!organizationId || !plan) {
    throw new AppError({
      code: 'SUBSCRIPTION_MISSING_METADATA',
      message: 'Subscription missing organization_id or plan',
      severity: 'HIGH',
      retriable: false
    })
  }

  try {
    // Update organizations table
    await supabaseAdmin
      .from('organizations')
      .update({ plan: plan.toLowerCase() })
      .eq('id', organizationId)

    // Store subscription details
    await supabaseAdmin
      .from('stripe_subscriptions')
      .upsert({
        organization_id: organizationId,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        plan: plan.toLowerCase(),
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      }, {
        onConflict: 'organization_id'
      })

    // Audit log the plan change
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        organization_id: organizationId,
        system_id: 'stripe',
        resource_type: 'subscriptions',
        resource_id: subscription.id,
        action: 'subscription_created',
        after: {
          plan,
          status: subscription.status,
          subscription_id: subscription.id
        }
      })

    logger.info('Subscription created', { organizationId, plan, subscriptionId: subscription.id })

  } catch (err: any) {
    logger.error('Failed to handle subscription created', err, { organizationId, plan })
    throw err
  }
}

/**
 * Handle subscription cancellation
 */
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const organizationId = subscription.metadata.organization_id

  if (!organizationId) return

  try {
    // Downgrade to free plan
    await supabaseAdmin
      .from('organizations')
      .update({ plan: 'free' })
      .eq('id', organizationId)

    // Update subscription status
    await supabaseAdmin
      .from('stripe_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)

    // Audit log
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        organization_id: organizationId,
        system_id: 'stripe',
        resource_type: 'subscriptions',
        resource_id: subscription.id,
        action: 'subscription_deleted',
        before: { plan: subscription.metadata.plan },
        after: { plan: 'free' }
      })

    logger.info('Subscription canceled', { organizationId, subscriptionId: subscription.id })

  } catch (err: any) {
    logger.error('Failed to handle subscription deleted', err, { organizationId })
    throw err
  }
}

/**
 * Create Stripe Customer Portal session
 * Allows users to manage their subscription
 */
export async function createPortalSession(params: {
  organizationId: string
  returnUrl: string
}): Promise<{ url: string }> {
  const { organizationId, returnUrl } = params

  try {
    const { data: sub } = await supabaseAdmin
      .from('stripe_subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', organizationId)
      .single()

    if (!sub?.stripe_customer_id) {
      throw new AppError({
        code: 'NO_STRIPE_CUSTOMER',
        message: 'No Stripe customer found',
        user_message: 'You do not have an active subscription.',
        severity: 'MEDIUM',
        retriable: false
      })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnUrl
    })

    return { url: session.url }

  } catch (err: any) {
    logger.error('Failed to create portal session', err, { organizationId })
    throw err
  }
}
```

**Validation Criteria:**
- [ ] Stripe SDK initialized correctly
- [ ] All functions use AppError for errors
- [ ] Audit logging on all subscription changes
- [ ] TypeScript types correct

---

### **2.3 Stripe Webhook Handler**

**File:** `app/api/webhooks/stripe/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logger } from '@/lib/logger'
import { handleSubscriptionCreated, handleSubscriptionDeleted } from '@/lib/services/stripeService'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    logger.error('Stripe webhook signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        logger.info('Checkout completed', { sessionId: session.id })
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCreated(subscription)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCreated(subscription) // Same handler
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        logger.info('Invoice paid', { invoiceId: invoice.id })
        // Store invoice record if needed
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        logger.error('Invoice payment failed', undefined, { invoiceId: invoice.id })
        // Handle failed payment (notify user, etc.)
        break
      }

      default:
        logger.info('Unhandled Stripe event', { type: event.type })
    }

    return NextResponse.json({ received: true })

  } catch (err: any) {
    logger.error('Error processing Stripe webhook', err, { eventType: event.type })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
```

**Validation Criteria:**
- [ ] Webhook signature verification works
- [ ] All subscription events handled
- [ ] Errors logged properly
- [ ] Returns 200 OK to Stripe

---

### **2.4 Billing API Endpoints**

**File:** `app/api/billing/checkout/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { requireRole, success, Errors } from '@/lib/api/utils'
import { createCheckoutSession } from '@/lib/services/stripeService'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/checkout
 * Create Stripe checkout session
 * RBAC: Owner only
 */
async function handlePOST(req: Request) {
  const ctx = await requireRole(['owner'])
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json()
    const { plan } = body

    if (!['pro', 'business', 'enterprise'].includes(plan)) {
      return Errors.badRequest('Invalid plan')
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { sessionId, url } = await createCheckoutSession({
      organizationId: ctx.orgId,
      plan,
      successUrl: `${appUrl}/settings?tab=billing&success=true`,
      cancelUrl: `${appUrl}/settings?tab=billing&canceled=true`
    })

    return success({ session_id: sessionId, url })

  } catch (err: any) {
    return Errors.internal(err)
  }
}

export const POST = withRateLimit(handlePOST, {
  identifier: (req: Request) => getClientIP(req),
  config: {
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000
  }
})
```

**File:** `app/api/billing/portal/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { requireRole, success, Errors } from '@/lib/api/utils'
import { createPortalSession } from '@/lib/services/stripeService'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/portal
 * Create Stripe customer portal session
 * RBAC: Owner only
 */
async function handlePOST(req: Request) {
  const ctx = await requireRole(['owner'])
  if (ctx instanceof NextResponse) return ctx

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { url } = await createPortalSession({
      organizationId: ctx.orgId,
      returnUrl: `${appUrl}/settings?tab=billing`
    })

    return success({ url })

  } catch (err: any) {
    return Errors.internal(err)
  }
}

export const POST = withRateLimit(handlePOST, {
  identifier: (req: Request) => getClientIP(req),
  config: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000
  }
})
```

**Validation Criteria:**
- [ ] Endpoints require owner role
- [ ] Rate limiting applied
- [ ] Error handling uses standard patterns

---

### **2.5 Billing UI Updates**

**File:** `app/settings/page.tsx`

**Update Billing tab with upgrade buttons:**

```typescript
// Add to imports
import { useRouter } from 'next/navigation'

// Inside SettingsPageContent component
const router = useRouter()
const [upgrading, setUpgrading] = useState(false)

async function handleUpgrade(plan: string) {
  setUpgrading(true)
  try {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ plan })
    })
    
    const data = await res.json()
    
    if (data.success && data.url) {
      // Redirect to Stripe Checkout
      window.location.href = data.url
    } else {
      alert('Failed to start checkout: ' + (data.error?.message || 'Unknown error'))
    }
  } catch (err) {
    alert('Failed to start checkout')
  } finally {
    setUpgrading(false)
  }
}

async function handleManageSubscription() {
  try {
    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      credentials: 'include'
    })
    
    const data = await res.json()
    
    if (data.success && data.url) {
      window.location.href = data.url
    }
  } catch (err) {
    alert('Failed to open billing portal')
  }
}

// Update "Manage Subscription" button
<button 
  onClick={handleManageSubscription}
  className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors"
>
  Manage Subscription
</button>

// Update plan cards with upgrade buttons
{[
  { name: 'Pro', price: '$49/mo', features: ['Recording', 'Transcription', 'Survey'], planKey: 'pro' },
  { name: 'Business', price: '$149/mo', features: ['+ Translation', '+ Secret Shopper', '+ Voice Cloning'], planKey: 'business' },
  { name: 'Enterprise', price: 'Custom', features: ['+ SSO', '+ API Access', '+ Dedicated Support'], planKey: 'enterprise' },
].map(p => (
  <div key={p.name} className="bg-gray-50 rounded-md p-4 border border-gray-200">
    <p className="font-semibold text-gray-900">{p.name}</p>
    <p className="text-xl font-bold text-primary-600 my-2">{p.price}</p>
    <ul className="text-sm text-gray-600 space-y-1 mb-3">
      {p.features.map(f => (
        <li key={f}>✓ {f}</li>
      ))}
    </ul>
    {plan !== p.planKey && p.planKey !== 'enterprise' && (
      <button
        onClick={() => handleUpgrade(p.planKey)}
        disabled={upgrading}
        className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-50"
      >
        {upgrading ? 'Loading...' : `Upgrade to ${p.name}`}
      </button>
    )}
    {p.planKey === 'enterprise' && (
      <a 
        href="mailto:sales@wordisbond.com"
        className="block w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm rounded-md font-medium text-center transition-colors"
      >
        Contact Sales
      </a>
    )}
  </div>
))}
```

**Validation Criteria:**
- [ ] Upgrade buttons trigger Stripe Checkout
- [ ] Manage Subscription opens portal
- [ ] Loading states display correctly
- [ ] Enterprise shows contact sales

---

## 🚀 Phase 3: Live Translation Config UI

### **Objective:** Allow users to configure SignalWire AI Agent ID for live translation

### **3.1 Database Schema Update**

**File:** `supabase/migrations/20260117_ai_agent_config.sql`

```sql
-- Add ai_agent_id to voice_configs table
ALTER TABLE public.voice_configs 
  ADD COLUMN IF NOT EXISTS ai_agent_id TEXT;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_voice_configs_agent 
  ON public.voice_configs(ai_agent_id) 
  WHERE ai_agent_id IS NOT NULL;

COMMENT ON COLUMN public.voice_configs.ai_agent_id IS 
  'SignalWire AI Agent ID for live translation (Business plan feature)';
```

---

### **3.2 API Endpoint for AI Config**

**File:** `app/api/voice/ai-config/route.ts`

```typescript
import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole, success, Errors } from '@/lib/api/utils'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/voice/ai-config
 * Get AI Agent configuration
 */
async function handleGET() {
  const ctx = await requireRole(['owner', 'admin'])
  if (ctx instanceof NextResponse) return ctx

  const { data, error } = await supabaseAdmin
    .from('voice_configs')
    .select('ai_agent_id, translation_enabled, translation_from, translation_to')
    .eq('organization_id', ctx.orgId)
    .single()

  if (error && error.code !== 'PGRST116') {
    return Errors.internal(error)
  }

  return success({ 
    ai_agent_id: data?.ai_agent_id || null,
    translation_enabled: data?.translation_enabled || false,
    translation_from: data?.translation_from || null,
    translation_to: data?.translation_to || null
  })
}

/**
 * PUT /api/voice/ai-config
 * Update AI Agent configuration
 * RBAC: Owner/Admin only
 */
async function handlePUT(req: Request) {
  const ctx = await requireRole(['owner', 'admin'])
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json()
    const { ai_agent_id, translation_enabled, translation_from, translation_to } = body

    // Validate ai_agent_id format (UUID or SignalWire ID)
    if (ai_agent_id && !/^[a-zA-Z0-9-_]+$/.test(ai_agent_id)) {
      return Errors.badRequest('Invalid AI Agent ID format')
    }

    // Check if plan allows live translation
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', ctx.orgId)
      .single()

    if (!['business', 'enterprise'].includes(org?.plan || '')) {
      return Errors.forbidden('Live translation requires Business or Enterprise plan')
    }

    // Upsert voice config
    const { error } = await supabaseAdmin
      .from('voice_configs')
      .upsert({
        organization_id: ctx.orgId,
        ai_agent_id: ai_agent_id || null,
        translation_enabled: translation_enabled || false,
        translation_from: translation_from || null,
        translation_to: translation_to || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'organization_id'
      })

    if (error) {
      return Errors.internal(error)
    }

    // Audit log
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        organization_id: ctx.orgId,
        user_id: ctx.userId,
        resource_type: 'voice_configs',
        resource_id: ctx.orgId,
        action: 'update',
        after: { ai_agent_id, translation_enabled, translation_from, translation_to }
      })

    logger.info('AI config updated', { orgId: ctx.orgId, ai_agent_id })

    return success({ message: 'AI configuration updated' })

  } catch (err: any) {
    return Errors.internal(err)
  }
}

export const GET = withRateLimit(handleGET, {
  identifier: (req: Request) => getClientIP(req),
  config: { maxAttempts: 60, windowMs: 60 * 1000, blockMs: 60 * 1000 }
})

export const PUT = withRateLimit(handlePUT, {
  identifier: (req: Request) => getClientIP(req),
  config: { maxAttempts: 20, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 }
})
```

---

### **3.3 UI Component**

**File:** `app/settings/page.tsx`

**Add to AI Control tab:**

```typescript
// Add to state
const [aiConfig, setAiConfig] = useState<any>(null)
const [savingAiConfig, setSavingAiConfig] = useState(false)

// Fetch AI config
useEffect(() => {
  if (activeTab === 'ai-control' && organizationId) {
    fetch('/api/voice/ai-config', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setAiConfig(data)
        }
      })
  }
}, [activeTab, organizationId])

async function handleSaveAiConfig(agentId: string) {
  setSavingAiConfig(true)
  try {
    const res = await fetch('/api/voice/ai-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ai_agent_id: agentId,
        translation_enabled: true
      })
    })
    
    const data = await res.json()
    
    if (data.success) {
      alert('AI Agent ID saved successfully')
    } else {
      alert('Failed to save: ' + (data.error?.message || 'Unknown error'))
    }
  } catch (err) {
    alert('Failed to save AI Agent ID')
  } finally {
    setSavingAiConfig(false)
  }
}

// Add to AI Control tab UI
<div className="bg-white rounded-md border border-gray-200 p-6">
  <h3 className="font-medium text-gray-900 mb-4">Live Translation Configuration</h3>
  {plan === 'business' || plan === 'enterprise' ? (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          SignalWire AI Agent ID
          <span className="ml-2 text-xs text-gray-500">(Business+ feature)</span>
        </label>
        <input
          type="text"
          value={aiConfig?.ai_agent_id || ''}
          onChange={(e) => setAiConfig({ ...aiConfig, ai_agent_id: e.target.value })}
          placeholder="Enter your SignalWire AI Agent ID"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
        <p className="text-xs text-gray-500 mt-1">
          Find this in your SignalWire dashboard under AI Agents
        </p>
      </div>
      <button
        onClick={() => handleSaveAiConfig(aiConfig?.ai_agent_id)}
        disabled={savingAiConfig || !aiConfig?.ai_agent_id}
        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
      >
        {savingAiConfig ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  ) : (
    <div className="text-sm text-gray-600">
      <p>Live translation requires Business or Enterprise plan.</p>
      <a href="#" className="text-primary-600 hover:text-primary-700 font-medium">
        Upgrade to unlock this feature
      </a>
    </div>
  )}
</div>
```

---

## 📋 Testing Checklist

### **Phase 1: Usage Metering**
- [ ] Migration runs successfully
- [ ] Usage tracked on call start
- [ ] Usage tracked on call end
- [ ] Limits enforced correctly
- [ ] Usage displays in Settings
- [ ] No breaking changes to existing calls

### **Phase 2: Stripe Integration**
- [ ] Checkout session creates successfully
- [ ] Redirects to Stripe Checkout
- [ ] Webhook receives events
- [ ] Subscription updates organization.plan
- [ ] Customer portal opens
- [ ] Downgrade to free works
- [ ] Audit logs record all changes

### **Phase 3: Live Translation Config**
- [ ] AI Agent ID saves to database
- [ ] Only shown to Business+ users
- [ ] Validation works correctly
- [ ] Config persists across sessions

---

## 🎯 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| First paid customer | 1 within 2 weeks | Check `stripe_subscriptions` table |
| MRR | $500 | Sum of active subscriptions |
| Usage tracking accuracy | 100% | Compare usage_records to actual calls |
| Checkout conversion | >50% | Track checkout sessions vs completed |
| Support tickets for billing | <5/week | Monitor support queue |

---

## 🚨 Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Webhook missed | Implement retry mechanism + manual reconciliation |
| Usage tracking failure | Fail open (allow call) + alert on repeated failures |
| Stripe API down | Show graceful error, queue operations |
| Plan limit abuse | Log all limit checks for audit trail |
| Incomplete checkout | Send follow-up email after 24h |

---

## 📝 Deployment Steps

1. **Deploy Phase 1:**
   ```bash
   # Run usage metering migration
   psql $DATABASE_URL -f supabase/migrations/20260116_usage_metering.sql
   
   # Deploy code
   git add .
   git commit -m "feat: Add usage metering"
   git push origin main
   
   # Verify in production
   # - Check usage tracking in logs
   # - Test limit enforcement with test org
   ```

2. **Deploy Phase 2:**
   ```bash
   # Set Stripe environment variables
   # - STRIPE_SECRET_KEY
   # - STRIPE_WEBHOOK_SECRET
   # - STRIPE_PRICE_PRO
   # - STRIPE_PRICE_BUSINESS
   # - STRIPE_PRICE_ENTERPRISE
   
   # Run billing migration
   psql $DATABASE_URL -f supabase/migrations/20260117_stripe_billing.sql
   
   # Deploy code
   git add .
   git commit -m "feat: Add Stripe billing integration"
   git push origin main
   
   # Configure Stripe webhook endpoint
   # URL: https://yourdomain.com/api/webhooks/stripe
   # Events: customer.subscription.*, invoice.*
   ```

3. **Deploy Phase 3:**
   ```bash
   # Run AI config migration
   psql $DATABASE_URL -f supabase/migrations/20260117_ai_agent_config.sql
   
   # Deploy code
   git add .
   git commit -m "feat: Add live translation config UI"
   git push origin main
   ```

---

## 🎓 Agent Instructions

**You are implementing this plan. Follow these rules:**

1. **One phase at a time** - Complete Phase 1 fully before Phase 2
2. **Test after each file** - Run type checks, look for errors
3. **Follow existing patterns** - Match code style in similar files
4. **Use AppError** - All errors must use AppError class
5. **Add audit logs** - Every state change needs audit log
6. **Rate limit APIs** - Use withRateLimit wrapper
7. **RBAC enforcement** - Use requireRole helper
8. **Never break existing code** - Test call flow still works

**When stuck:**
- Search for similar patterns in codebase
- Check ARCH_DOCS for guidance
- Ask for clarification before guessing

**Validation at each step:**
- TypeScript compiles
- No runtime errors in logs
- Database queries work
- UI displays correctly

---

## 📊 Progress Tracking

Create GitHub issues for each phase:
- [ ] Phase 1: Usage Metering Foundation
- [ ] Phase 2: Stripe Integration
- [ ] Phase 3: Live Translation Config UI

Mark complete when all validation criteria pass.

---

**END OF IMPLEMENTATION PLAN**

*This plan designed for autonomous agent execution while maintaining architectural standards and best practices.*
