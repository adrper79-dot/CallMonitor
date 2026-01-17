# Billing UI: Complete Implementation Guide

**Feature:** Billing UI Completion (30% → 100%)  
**Priority:** 🔴 HIGHEST - Revenue Infrastructure  
**Estimated Effort:** 8-12 hours  
**Backend Status:** ✅ 100% Complete  
**Frontend Status:** ⚠️ 30% Complete

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Implementation Tasks](#implementation-tasks)
4. [Component Specifications](#component-specifications)
5. [API Integration](#api-integration)
6. [Testing Requirements](#testing-requirements)
7. [Deployment Checklist](#deployment-checklist)

---

## Executive Summary

### What We Have (Backend 100% ✅)

**Database Tables:**
- `stripe_subscriptions` - Complete subscription state tracking
- `stripe_payment_methods` - Card/bank account storage
- `stripe_invoices` - Invoice history and PDFs
- `stripe_events` - Webhook event log

**API Endpoints:**
- `POST /api/billing/checkout` - Create checkout session
- `POST /api/billing/portal` - Access Stripe portal
- `GET /api/billing/subscription` - Get subscription details
- `POST /api/billing/cancel` - Cancel subscription
- `GET /api/billing/invoices` - Invoice history
- `GET /api/billing/payment-methods` - List payment methods

**Service Layer:**
- `lib/services/stripeService.ts` - Complete Stripe integration
  * getOrCreateCustomer()
  * createCheckoutSession()
  * createBillingPortalSession()
  * getSubscription()
  * cancelSubscription()
  * reactivateSubscription()
  * updateSubscription()

**Webhook Handler:**
- `app/api/webhooks/stripe/route.ts`
  * Processes all Stripe events with idempotency
  * Auto-syncs subscriptions, payment methods, invoices
  * Updates organizations.plan field automatically

### What We Need (Frontend 70% ❌)

**Missing Components:**
1. **SubscriptionManager** - Display subscription status, renewal date, cancel/reactivate
2. **PaymentMethodManager** - List payment methods with default badge
3. **InvoiceHistory** - Table with pagination, PDF downloads
4. **PlanComparisonTable** - Interactive plan comparison with upgrade CTAs

**Existing Component:**
- ✅ `components/settings/BillingActions.tsx` - Basic upgrade/manage buttons
- ✅ `components/settings/UsageDisplay.tsx` - Usage meters (can be imported)

---

## Current State Analysis

### Backend Architecture (100% Complete)

#### Database Schema

```sql
-- stripe_subscriptions
id                      uuid PRIMARY KEY
organization_id         uuid REFERENCES organizations(id)
stripe_customer_id      text
stripe_subscription_id  text UNIQUE
stripe_price_id         text
plan                    text CHECK (plan IN ('free', 'pro', 'business', 'enterprise'))
status                  text CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing', etc.))
current_period_start    timestamptz
current_period_end      timestamptz
cancel_at_period_end    boolean
canceled_at             timestamptz
amount_cents            integer
currency                text DEFAULT 'usd'
interval                text CHECK (interval IN ('month', 'year'))
trial_start             timestamptz
trial_end               timestamptz
created_at              timestamptz
updated_at              timestamptz

-- stripe_payment_methods
id                          uuid PRIMARY KEY
organization_id             uuid REFERENCES organizations(id)
stripe_customer_id          text
stripe_payment_method_id    text UNIQUE
type                        text CHECK (type IN ('card', 'bank_account', 'sepa_debit', 'us_bank_account'))
is_default                  boolean
card_brand                  text
card_last4                  text
card_exp_month              integer
card_exp_year               integer
bank_name                   text
bank_last4                  text
created_at                  timestamptz
updated_at                  timestamptz

-- stripe_invoices
id                      uuid PRIMARY KEY
organization_id         uuid REFERENCES organizations(id)
stripe_invoice_id       text UNIQUE
stripe_customer_id      text
stripe_subscription_id  text
status                  text CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible'))
amount_due_cents        integer
amount_paid_cents       integer
currency                text DEFAULT 'usd'
invoice_date            date
due_date                date
paid_at                 timestamptz
invoice_pdf_url         text
hosted_invoice_url      text
created_at              timestamptz

-- stripe_events
id                  uuid PRIMARY KEY
stripe_event_id     text UNIQUE
event_type          text
organization_id     uuid REFERENCES organizations(id)
data                jsonb
processed           boolean DEFAULT false
error_message       text
created_at          timestamptz
processed_at        timestamptz

-- Auto-sync function
CREATE FUNCTION sync_organization_plan()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE organizations
  SET plan = NEW.plan
  WHERE id = NEW.organization_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER sync_org_plan_on_subscription_change
  AFTER INSERT OR UPDATE ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_organization_plan();
```

#### Stripe Service Methods

**File:** `lib/services/stripeService.ts`

```typescript
// Customer Management
export async function getOrCreateCustomer(params: CreateCustomerParams): Promise<string>

// Checkout
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<string>

// Portal Access
export async function createBillingPortalSession(organizationId: string, returnUrl: string): Promise<string>

// Subscription Management
export async function getSubscription(organizationId: string): Promise<Subscription | null>
export async function cancelSubscription(organizationId: string): Promise<void>
export async function reactivateSubscription(organizationId: string): Promise<void>
export async function updateSubscription(organizationId: string, newPriceId: string): Promise<void>

// Invoices
export async function getInvoices(organizationId: string, limit: number): Promise<Invoice[]>

// Payment Methods
export async function getPaymentMethods(organizationId: string): Promise<PaymentMethod[]>
```

### Frontend Gap Analysis

#### Existing: BillingActions.tsx (30% Complete)

**File:** `components/settings/BillingActions.tsx` (175 lines)

**What It Does:**
- ✅ Displays "Upgrade" button for free users → redirects to Stripe checkout
- ✅ Displays "Manage Subscription" button for paid users → redirects to Stripe portal
- ✅ Shows static plan comparison cards (Pro $49, Business $149, Enterprise custom)
- ✅ RBAC enforcement (disables buttons for non-owner/admin)

**What It Doesn't Do:**
- ❌ Display current subscription details (plan, status, renewal date, amount)
- ❌ Show payment methods on file
- ❌ Display invoice history
- ❌ Show subscription status badges (active, trialing, past_due, canceled)
- ❌ Cancel/reactivate subscription without leaving app
- ❌ Change plan (upgrade/downgrade) without portal
- ❌ Display usage-based billing information
- ❌ Show trial period countdown

#### Missing Components (70%)

1. **SubscriptionManager Component** - 0%
   - Display: Current plan, status badge, renewal date, billing amount
   - Actions: Cancel subscription, reactivate, manage (portal)
   - Notices: Trial countdown, cancellation warning
   - Estimated: 3-4 hours

2. **PaymentMethodManager Component** - 0%
   - Display: List of payment methods (card/bank)
   - Show: Default badge, card brand, last 4 digits, expiry
   - Actions: Add/remove/set default (via Stripe portal)
   - Estimated: 2-3 hours

3. **InvoiceHistory Component** - 0%
   - Display: Invoice table with date, status, amount
   - Actions: Download PDF, view hosted invoice
   - Pagination: Last 12 invoices
   - Estimated: 2 hours

4. **PlanComparisonTable Component** - 0%
   - Display: Interactive plan cards (Pro, Business, Enterprise)
   - Toggle: Monthly/yearly billing
   - Actions: Select plan → checkout
   - Highlight: Current plan, popular plan
   - Estimated: 1-2 hours

---

## Implementation Tasks

### Task 1: SubscriptionManager Component (3-4 hours)

**File:** `components/billing/SubscriptionManager.tsx` (NEW)

**Purpose:** Comprehensive subscription status display with self-service actions

**Features:**
- Fetch and display current subscription via `GET /api/billing/subscription`
- Show plan name, status badge, billing amount, renewal date
- Display trial period countdown if in trial
- Show cancellation notice if subscription ending
- Cancel button → `POST /api/billing/cancel` (with confirmation)
- Manage button → `POST /api/billing/portal` (redirect to Stripe)
- Handle free plan state (no subscription)

**Component Code:**

```tsx
"use client"

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatCurrency } from '@/lib/utils'

interface Subscription {
  id: string
  plan: string
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at: string | null
  amount_cents: number
  currency: string
  interval: string
  trial_end: string | null
}

interface SubscriptionManagerProps {
  organizationId: string
  canManage: boolean  // owner/admin only
}

export function SubscriptionManager({ organizationId, canManage }: SubscriptionManagerProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubscription()
  }, [organizationId])

  async function fetchSubscription() {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/subscription', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch subscription')
      const data = await res.json()
      setSubscription(data.subscription || null)
    } catch (err: any) {
      console.error('Failed to load subscription:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!canManage) return
    
    const confirmed = confirm(
      'Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period.'
    )
    if (!confirmed) return

    try {
      setCanceling(true)
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to cancel subscription')
      await fetchSubscription()
    } catch (err: any) {
      alert('Failed to cancel subscription: ' + err.message)
    } finally {
      setCanceling(false)
    }
  }

  async function handleManageSubscription() {
    if (!canManage) return

    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to create portal session')
      const { url } = await res.json()
      window.location.href = url
    } catch (err: any) {
      alert('Failed to open billing portal: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Subscription</h3>
        <p className="text-gray-600 text-sm mb-4">
          You are currently on the Free plan. Upgrade to unlock premium features.
        </p>
        {canManage && (
          <Button
            onClick={() => window.location.href = '/pricing'}
            className="bg-primary-600 text-white hover:bg-primary-700"
          >
            View Plans
          </Button>
        )}
      </div>
    )
  }

  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const isTrialing = subscription.status === 'trialing'
  const isCanceled = subscription.cancel_at_period_end

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 capitalize">
              {subscription.plan} Plan
            </h3>
            <Badge variant={isActive ? 'default' : 'destructive'} className={
              isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }>
              {subscription.status}
            </Badge>
            {isTrialing && (
              <Badge variant="default" className="bg-blue-100 text-blue-700">
                Trial
              </Badge>
            )}
            {isCanceled && (
              <Badge variant="destructive">Canceling</Badge>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {formatCurrency(subscription.amount_cents, subscription.currency)} / {subscription.interval}
          </p>
        </div>
        {canManage && !isCanceled && (
          <Button
            variant="outline"
            onClick={handleManageSubscription}
          >
            Manage
          </Button>
        )}
      </div>

      {/* Billing Cycle */}
      <div className="grid grid-cols-2 gap-4 py-4 border-t border-gray-200">
        <div>
          <span className="text-xs text-gray-500 block mb-1">Current Period</span>
          <span className="text-sm text-gray-900">
            {formatDate(subscription.current_period_start)}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-500 block mb-1">
            {isCanceled ? 'Cancels On' : 'Renews On'}
          </span>
          <span className="text-sm text-gray-900">
            {formatDate(subscription.current_period_end)}
          </span>
        </div>
      </div>

      {/* Trial Notice */}
      {isTrialing && subscription.trial_end && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-700">
            <strong>Trial Period:</strong> Your trial ends on {formatDate(subscription.trial_end)}.
            You will be charged {formatCurrency(subscription.amount_cents, subscription.currency)} on that date.
          </p>
        </div>
      )}

      {/* Cancelation Notice */}
      {isCanceled && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-xs text-amber-700">
            <strong>Subscription Canceled:</strong> Your subscription will end on {formatDate(subscription.current_period_end)}.
            You will retain access until then.
          </p>
        </div>
      )}

      {/* Actions */}
      {canManage && !isCanceled && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleCancel}
            disabled={canceling}
            className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {canceling ? 'Canceling...' : 'Cancel Subscription'}
          </button>
        </div>
      )}
    </div>
  )
}
```

**Dependencies:**
- `@/components/ui/badge` - Badge component for status display
- `@/components/ui/button` - Button component
- `@/lib/utils` - formatDate(), formatCurrency() helpers

**API Calls:**
- `GET /api/billing/subscription` - Fetch subscription details
- `POST /api/billing/cancel` - Cancel subscription
- `POST /api/billing/portal` - Open billing portal

**RBAC:**
- Owner/Admin: Can manage subscription (cancel, portal access)
- Operator/Viewer: Read-only display

---

### Task 2: PaymentMethodManager Component (2-3 hours)

**File:** `components/billing/PaymentMethodManager.tsx` (NEW)

**Purpose:** Display and manage payment methods

```tsx
"use client"

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PaymentMethod {
  id: string
  type: string
  is_default: boolean
  card_brand?: string
  card_last4?: string
  card_exp_month?: number
  card_exp_year?: number
  bank_name?: string
  bank_last4?: string
}

interface PaymentMethodManagerProps {
  organizationId: string
  canManage: boolean
}

export function PaymentMethodManager({ organizationId, canManage }: PaymentMethodManagerProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPaymentMethods()
  }, [organizationId])

  async function fetchPaymentMethods() {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/payment-methods', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch payment methods')
      const data = await res.json()
      setPaymentMethods(data.payment_methods || [])
    } catch (err: any) {
      console.error('Failed to load payment methods:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleManagePaymentMethods() {
    if (!canManage) return

    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to create portal session')
      const { url } = await res.json()
      window.location.href = url
    } catch (err: any) {
      alert('Failed to open billing portal: ' + err.message)
    }
  }

  function getCardIcon(brand?: string) {
    const icons: Record<string, string> = {
      visa: '💳',
      mastercard: '💳',
      amex: '💳',
      discover: '💳'
    }
    return icons[brand?.toLowerCase() || ''] || '💳'
  }

  function getCardDisplayName(brand?: string) {
    if (!brand) return 'Card'
    return brand.charAt(0).toUpperCase() + brand.slice(1)
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
        {canManage && (
          <Button
            variant="outline"
            onClick={handleManagePaymentMethods}
          >
            Manage
          </Button>
        )}
      </div>

      {paymentMethods.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm mb-4">No payment methods on file</p>
          {canManage && (
            <Button
              onClick={handleManagePaymentMethods}
              className="bg-primary-600 text-white hover:bg-primary-700"
            >
              Add Payment Method
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getCardIcon(pm.card_brand)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {pm.type === 'card' && pm.card_brand && (
                      <>
                        {getCardDisplayName(pm.card_brand)} •••• {pm.card_last4}
                      </>
                    )}
                    {pm.type === 'bank_account' && pm.bank_name && (
                      <>
                        {pm.bank_name} •••• {pm.bank_last4}
                      </>
                    )}
                  </p>
                  {pm.type === 'card' && pm.card_exp_month && pm.card_exp_year && (
                    <p className="text-xs text-gray-500">
                      Expires {String(pm.card_exp_month).padStart(2, '0')}/{pm.card_exp_year}
                    </p>
                  )}
                </div>
              </div>
              {pm.is_default && (
                <Badge variant="default" className="bg-green-100 text-green-700">
                  Default
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

### Task 3: InvoiceHistory Component (2 hours)

**File:** `components/billing/InvoiceHistory.tsx` (NEW)

**Purpose:** Display invoice history with download links

```tsx
"use client"

import { useState, useEffect } from 'react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Invoice {
  id: string
  stripe_invoice_id: string
  status: string
  amount_due_cents: number
  amount_paid_cents: number
  currency: string
  invoice_date: string
  due_date: string | null
  paid_at: string | null
  invoice_pdf_url: string | null
  hosted_invoice_url: string | null
}

interface InvoiceHistoryProps {
  organizationId: string
}

export function InvoiceHistory({ organizationId }: InvoiceHistoryProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoices()
  }, [organizationId])

  async function fetchInvoices() {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/invoices?limit=12', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch invoices')
      const data = await res.json()
      setInvoices(data.invoices || [])
    } catch (err: any) {
      console.error('Failed to load invoices:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getStatusBadgeColor(status: string) {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700'
      case 'open': return 'bg-blue-100 text-blue-700'
      case 'draft': return 'bg-gray-100 text-gray-700'
      default: return 'bg-red-100 text-red-700'
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice History</h3>

      {invoices.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No invoices yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(invoice.invoice_date)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <Badge className={getStatusBadgeColor(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-medium">
                    {formatCurrency(invoice.amount_due_cents, invoice.currency)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm space-x-3">
                    {invoice.invoice_pdf_url && (
                      <a
                        href={invoice.invoice_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        PDF
                      </a>
                    )}
                    {invoice.hosted_invoice_url && (
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        View
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

---

### Task 4: PlanComparisonTable Component (1-2 hours)

**File:** `components/billing/PlanComparisonTable.tsx` (NEW)

**Purpose:** Interactive plan comparison with upgrade CTAs

```tsx
"use client"

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Plan {
  id: string
  name: string
  price_monthly: number
  price_yearly: number
  stripe_price_id_monthly: string
  stripe_price_id_yearly: string
  features: string[]
  popular?: boolean
}

const PLANS: Plan[] = [
  {
    id: 'pro',
    name: 'Pro',
    price_monthly: 49,
    price_yearly: 470,
    stripe_price_id_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || '',
    stripe_price_id_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || '',
    features: [
      '500 calls/month',
      '2,000 minutes',
      '10 team members',
      'AI transcription',
      'Basic analytics',
      'Webhooks',
      'Email support'
    ]
  },
  {
    id: 'business',
    name: 'Business',
    price_monthly: 149,
    price_yearly: 1430,
    stripe_price_id_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY || '',
    stripe_price_id_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY || '',
    features: [
      '2,000 calls/month',
      '10,000 minutes',
      '25 team members',
      'Live translation',
      'Voice cloning',
      'AI survey bot',
      'Advanced analytics',
      'Priority support'
    ],
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_monthly: 0,
    price_yearly: 0,
    stripe_price_id_monthly: '',
    stripe_price_id_yearly: '',
    features: [
      'Unlimited calls',
      'Unlimited minutes',
      'Unlimited team members',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
      'Custom AI prompts',
      'Account manager'
    ]
  }
]

interface PlanComparisonTableProps {
  currentPlan: string
  onSelectPlan: (priceId: string) => void
  canManage: boolean
}

export function PlanComparisonTable({ currentPlan, onSelectPlan, canManage }: PlanComparisonTableProps) {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Compare Plans</h3>
        
        {/* Billing Interval Toggle */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className={`text-sm ${billingInterval === 'monthly' ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'yearly' : 'monthly')}
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
            role="switch"
            aria-checked={billingInterval === 'yearly'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingInterval === 'yearly' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm ${billingInterval === 'yearly' ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
            Yearly
            <span className="ml-1 text-green-600 text-xs">(Save 20%)</span>
          </span>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan.toLowerCase()
          const isEnterprise = plan.id === 'enterprise'
          const price = billingInterval === 'monthly' ? plan.price_monthly : plan.price_yearly
          const priceId = billingInterval === 'monthly' ? plan.stripe_price_id_monthly : plan.stripe_price_id_yearly

          return (
            <div
              key={plan.id}
              className={`border-2 rounded-lg p-6 relative ${
                plan.popular ? 'border-primary-600 shadow-lg' : 'border-gray-200'
              } ${isCurrent ? 'bg-gray-50' : 'bg-white'}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary-600 text-white">
                    Most Popular
                  </Badge>
                </div>
              )}

              <div className="mb-4">
                <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                <div className="mt-2">
                  {isEnterprise ? (
                    <span className="text-2xl font-bold text-gray-900">Custom</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-gray-900">${price}</span>
                      <span className="text-gray-500 ml-2">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
                    </>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <Button disabled className="w-full" variant="secondary">
                  Current Plan
                </Button>
              ) : isEnterprise ? (
                <Button
                  className="w-full bg-primary-600 text-white hover:bg-primary-700"
                  onClick={() => window.location.href = 'mailto:sales@wordisbond.com'}
                >
                  Contact Sales
                </Button>
              ) : (
                <Button
                  onClick={() => onSelectPlan(priceId)}
                  disabled={!canManage}
                  className={`w-full ${
                    canManage
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  {canManage ? 'Upgrade' : 'Contact Admin'}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

---

### Task 5: Integrate into Settings Page (1 hour)

**File:** `app/settings/page.tsx`

**Changes:**

```tsx
// Add imports at top
import { SubscriptionManager } from '@/components/billing/SubscriptionManager'
import { PaymentMethodManager } from '@/components/billing/PaymentMethodManager'
import { InvoiceHistory } from '@/components/billing/InvoiceHistory'
import { PlanComparisonTable } from '@/components/billing/PlanComparisonTable'
import { UsageDisplay } from '@/components/settings/UsageDisplay'

// Replace billing tab content
{activeTab === 'billing' && (
  <div className="space-y-6">
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Billing & Subscription</h2>
      <p className="text-sm text-gray-600">
        Manage your plan, payment methods, and invoices.
      </p>
    </div>

    {/* Current Subscription */}
    <SubscriptionManager 
      organizationId={organizationId}
      canManage={canEdit}
    />

    {/* Usage Meters */}
    <UsageDisplay 
      organizationId={organizationId}
      plan={plan}
    />

    {/* Payment Methods */}
    <PaymentMethodManager 
      organizationId={organizationId}
      canManage={canEdit}
    />

    {/* Invoice History */}
    <InvoiceHistory 
      organizationId={organizationId}
    />

    {/* Plan Comparison */}
    <PlanComparisonTable 
      currentPlan={plan}
      onSelectPlan={async (priceId) => {
        if (!canEdit) return
        try {
          const res = await fetch('/api/billing/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceId }),
            credentials: 'include',
          })
          if (!res.ok) throw new Error('Failed to create checkout session')
          const { url } = await res.json()
          window.location.href = url
        } catch (err: any) {
          alert('Failed to upgrade plan: ' + err.message)
        }
      }}
      canManage={canEdit}
    />
  </div>
)}
```

---

## Testing Requirements

### Manual Testing Checklist

#### Subscription Manager
- [ ] Free plan displays "No Active Subscription" with upgrade CTA
- [ ] Pro plan displays subscription details (plan, status, amount, dates)
- [ ] Active subscription shows "Renews On" date
- [ ] Trial subscription shows trial countdown and "Trial" badge
- [ ] Canceled subscription shows "Cancels On" and "Canceling" badge
- [ ] Cancel button prompts confirmation dialog
- [ ] Cancel successfully updates status and displays notice
- [ ] Manage button redirects to Stripe portal
- [ ] Owner/admin can manage, operator/viewer cannot

#### Payment Method Manager
- [ ] Displays "No payment methods" for new accounts
- [ ] Lists all payment methods (cards, bank accounts)
- [ ] Shows card brand icon and last 4 digits
- [ ] Displays expiration date for cards
- [ ] Shows "Default" badge on default payment method
- [ ] Manage button redirects to Stripe portal
- [ ] Can add payment method via portal
- [ ] Can set default via portal
- [ ] Changes sync back to app after portal session

#### Invoice History
- [ ] Displays "No invoices yet" for new accounts
- [ ] Lists invoices in reverse chronological order
- [ ] Shows correct status badges (Paid, Open, Failed)
- [ ] Displays formatted amounts with currency
- [ ] PDF download link works
- [ ] Hosted invoice link works
- [ ] Table is responsive on mobile

#### Plan Comparison Table
- [ ] Displays all plans (Pro, Business, Enterprise)
- [ ] Monthly/yearly toggle works
- [ ] Yearly shows "Save 20%" label
- [ ] Current plan shows "Current Plan" disabled button
- [ ] Other plans show "Upgrade" button
- [ ] Enterprise shows "Contact Sales" button
- [ ] Popular plan has special styling
- [ ] Upgrade button triggers checkout flow
- [ ] Non-privileged users see "Contact Admin"

### Integration Testing

- [ ] Upgrade from Free to Pro completes successfully
- [ ] Subscription status updates in database
- [ ] Organizations.plan field updates automatically (trigger)
- [ ] Webhook processes subscription.created event
- [ ] Cancel subscription completes successfully
- [ ] Reactivate subscription via portal works
- [ ] Change plan (Pro → Business) works
- [ ] Invoice generated and appears in history
- [ ] Payment method added via portal syncs to database
- [ ] Default payment method changes sync

### Edge Cases

- [ ] Expired card shows warning
- [ ] Failed payment shows past_due status
- [ ] Dunning retries work correctly
- [ ] Subscription ends gracefully on non-payment
- [ ] Plan downgrade proration calculates correctly
- [ ] Trial cancellation doesn't charge
- [ ] Multiple payment methods display correctly
- [ ] Large invoice list paginates
- [ ] Concurrent updates don't cause race conditions

---

## Deployment Checklist

### Pre-Deployment

- [ ] All components created and tested locally
- [ ] Stripe price IDs configured in .env
  ```
  NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_xxx
  NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=price_xxx
  NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY=price_xxx
  NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY=price_xxx
  ```
- [ ] formatCurrency() and formatDate() helpers implemented in lib/utils.ts
- [ ] Badge and Button components exist and are styled
- [ ] TypeScript compilation passes with no errors
- [ ] ESLint/Prettier pass

### Deployment Steps

1. **Merge to Development Branch**
   ```bash
   git checkout -b feature/billing-ui-complete
   git add .
   git commit -m "feat: complete billing UI implementation"
   git push origin feature/billing-ui-complete
   ```

2. **Deploy to Staging**
   - Verify Stripe webhook endpoint configured (staging mode)
   - Test full billing flow end-to-end
   - Verify all components load correctly
   - Test RBAC enforcement

3. **Deploy to Production**
   - Switch Stripe to production mode
   - Configure production webhook endpoint
   - Update Stripe price IDs in production .env
   - Monitor error logs for 24 hours
   - Verify first production subscription works

### Post-Deployment

- [ ] Monitor Sentry/error logs for billing-related errors
- [ ] Verify webhook events processing successfully
- [ ] Check subscription syncs correctly
- [ ] Verify trial periods work
- [ ] Test payment failure handling
- [ ] Monitor Stripe dashboard for anomalies

### Rollback Plan

If issues arise:
1. Revert deployment to previous version
2. Stripe subscriptions remain intact (backend unchanged)
3. Users can still access billing portal via direct link
4. Fix issues and redeploy

---

## Architecture Compliance

### MASTER_ARCHITECTURE.txt Alignment

✅ **Call-Rooted Design:** Billing supports call-based usage metering  
✅ **Voice-First:** Billing enables voice features (transcription, translation, cloning)  
✅ **Plan Gating:** Components respect plan tiers (free, pro, business, enterprise)  
✅ **Audit Logging:** All billing actions logged via writeAudit()  
✅ **RBAC Enforcement:** Owner/admin only for billing management  
✅ **Error Handling:** Try-catch with AppError, user-friendly messages  
✅ **Professional Design:** Navy primary color, semantic badges, consistent spacing  

### Professional Design System v3.0

✅ **Colors:** Navy primary (#1e40af), green success, red destructive, amber warning  
✅ **Typography:** Sans-serif, clear hierarchy, accessible contrast  
✅ **Spacing:** Consistent padding/margins (px-4, py-3, gap-3, space-y-6)  
✅ **Components:** Badge, Button with variant system  
✅ **Animations:** Subtle transitions (hover:bg-gray-50, transition-colors)  
✅ **Responsiveness:** Mobile-first grid layouts (grid-cols-1 md:grid-cols-3)  

---

## Summary

**Billing UI Completion:**
- Create 4 new components (SubscriptionManager, PaymentMethodManager, InvoiceHistory, PlanComparisonTable)
- Integrate into settings page
- Leverage 100% complete backend infrastructure
- Estimated: 8-12 hours

**Impact:**
- Revenue enablement: Customers can self-manage subscriptions
- Reduced support burden: Self-service for common billing tasks
- Improved UX: In-app billing management without leaving to Stripe portal
- Plan changes: Seamless upgrade/downgrade flows

**Next Steps:**
1. Start with SubscriptionManager (highest value, 3-4h)
2. Add PaymentMethodManager (2-3h)
3. Add InvoiceHistory (2h)
4. Add PlanComparisonTable (1-2h)
5. Integrate into settings page (1h)
6. Test thoroughly (2-3h)
7. Deploy to production

**Total Time:** 8-12 hours development + 2-3 hours testing = **10-15 hours**
