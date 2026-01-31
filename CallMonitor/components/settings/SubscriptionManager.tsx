/**
 * Subscription Manager Component
 * 
 * Displays current subscription details with plan management.
 * RBAC: Owner/Admin only
 * 
 * Features:
 * - Subscription plan display
 * - Status badges (active, past_due, canceled, trialing)
 * - Renewal date or cancellation date
 * - Upgrade/downgrade actions
 * - Cancellation flow with confirmation
 * 
 * @module components/settings/SubscriptionManager
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Loader2, CreditCard, XCircle, CheckCircle } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Subscription {
  id: string
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'
  plan_id: string
  plan_name: string
  amount: number
  currency: string
  interval: 'month' | 'year'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at: string | null
  trial_end: string | null
}

interface SubscriptionManagerProps {
  organizationId: string
  role: 'owner' | 'admin' | 'operator' | 'analyst' | 'viewer'
}

export function SubscriptionManager({ organizationId, role }: SubscriptionManagerProps) {
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [canceling, setCanceling] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManage = role === 'owner' || role === 'admin'

  useEffect(() => {
    fetchSubscription()
  }, [organizationId])

  const fetchSubscription = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/billing/subscription?orgId=${organizationId}`, {
        credentials: 'include'
      })
      
      if (!res.ok) {
        if (res.status === 404) {
          // No subscription found (free plan)
          setSubscription(null)
          return
        }
        throw new Error('Failed to fetch subscription')
      }

      const data = await res.json()
      setSubscription(data.subscription)
    } catch (err) {
      logger.error('Error fetching subscription', err, { organizationId })
      setError(err instanceof Error ? err.message : 'Failed to load subscription')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    if (!canManage) return

    try {
      setUpgrading(true)
      setError(null)

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
          organizationId
        }),
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to create checkout session')

      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      logger.error('Error upgrading subscription', err, { organizationId })
      setError(err instanceof Error ? err.message : 'Failed to upgrade')
    } finally {
      setUpgrading(false)
    }
  }

  const handleManageSubscription = async () => {
    if (!canManage) return

    try {
      setUpgrading(true)
      setError(null)

      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to access billing portal')

      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      logger.error('Error accessing billing portal', err, { organizationId })
      setError(err instanceof Error ? err.message : 'Failed to access billing portal')
    } finally {
      setUpgrading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!canManage) return

    try {
      setCanceling(true)
      setError(null)

      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to cancel subscription')

      await fetchSubscription()
      router.refresh()
    } catch (err) {
      logger.error('Error canceling subscription', err, { organizationId })
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setCanceling(false)
    }
  }

  const getStatusBadge = (status: Subscription['status']) => {
    const variants = {
      active: { label: 'Active', variant: 'success' as const, icon: CheckCircle },
      trialing: { label: 'Trial', variant: 'default' as const, icon: CheckCircle },
      past_due: { label: 'Past Due', variant: 'error' as const, icon: XCircle },
      canceled: { label: 'Canceled', variant: 'secondary' as const, icon: XCircle },
      incomplete: { label: 'Incomplete', variant: 'error' as const, icon: XCircle },
    }

    const config = variants[status]
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Manage your subscription plan</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!subscription) {
    // Free plan
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>You're currently on the Free plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Free Plan</p>
                <p className="text-sm text-muted-foreground">
                  10 calls/month • Basic features
                </p>
              </div>
              <Badge variant="secondary">Free</Badge>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleUpgrade}
            disabled={!canManage || upgrading}
            className="w-full"
          >
            {upgrading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Paid subscription
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Subscription</span>
          {getStatusBadge(subscription.status)}
        </CardTitle>
        <CardDescription>Manage your subscription plan</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Plan Details */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Plan</span>
              <span className="text-sm">{subscription.plan_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Amount</span>
              <span className="text-sm font-semibold">
                {formatCurrency(subscription.amount, subscription.currency)}/
                {subscription.interval}
              </span>
            </div>
          </div>

          {/* Billing Period */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Period</span>
              <span className="text-sm text-muted-foreground">
                {formatDate(subscription.current_period_start)} -{' '}
                {formatDate(subscription.current_period_end)}
              </span>
            </div>

            {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Trial Ends</span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(subscription.trial_end)}
                </span>
              </div>
            )}

            {subscription.cancel_at_period_end ? (
              <div className="rounded-lg bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">
                  Subscription will be canceled on {formatDate(subscription.current_period_end)}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Next Billing Date</span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(subscription.current_period_end)}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          onClick={handleManageSubscription}
          disabled={!canManage || upgrading}
          variant="outline"
          className="flex-1"
        >
          {upgrading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Subscription
            </>
          )}
        </Button>

        {!subscription.cancel_at_period_end && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={!canManage || canceling}
              >
                {canceling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  'Cancel'
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel your subscription? You'll continue to have
                  access until {formatDate(subscription.current_period_end)}, then your plan
                  will revert to Free.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelSubscription}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Cancel Subscription
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  )
}
