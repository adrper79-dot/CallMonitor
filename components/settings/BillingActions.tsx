"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'

interface BillingActionsProps {
  organizationId: string
  plan: string
  role: string | null
}

export function BillingActions({ organizationId, plan, role }: BillingActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManageBilling = role === 'owner' || role === 'admin'

  // Handle upgrade/downgrade
  const handleManageSubscription = async () => {
    if (!canManageBilling) {
      setError('Only owners and admins can manage billing')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // If user has no plan, go to checkout
      if (plan === 'free') {
        // For now, default to Pro plan - could show plan selector modal
        const proPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly'
        
        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId: proPriceId }),
          credentials: 'include',
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to create checkout session')
        }

        const { url } = await res.json()
        window.location.href = url
      } else {
        // If user has a plan, go to billing portal
        const res = await fetch('/api/billing/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to create portal session')
        }

        const { url } = await res.json()
        window.location.href = url
      }
    } catch (err: any) {
      logger.error('Billing action failed', err, { organizationId, plan })
      setError(err.message || 'Failed to manage subscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleManageSubscription}
        disabled={loading || !canManageBilling}
        className={`w-full py-3 rounded-md font-medium transition-colors ${
          canManageBilling
            ? 'bg-primary-600 hover:bg-primary-700 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? 'Loading...' : plan === 'free' ? 'Upgrade Plan' : 'Manage Subscription'}
      </button>

      {!canManageBilling && (
        <p className="text-xs text-gray-500 text-center">
          Contact your organization owner to manage billing
        </p>
      )}

      {/* Plan comparison */}
      {plan === 'free' && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Available Plans</h3>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">Pro</span>
                <span className="text-sm text-gray-600">$49/mo</span>
              </div>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>✓ 500 calls/month</li>
                <li>✓ 2,000 minutes</li>
                <li>✓ AI transcription</li>
                <li>✓ Basic analytics</li>
              </ul>
            </div>
            
            <div className="bg-primary-50 rounded-md p-4 border-2 border-primary-600">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">Business</span>
                  <Badge variant="default" className="text-xs">Popular</Badge>
                </div>
                <span className="text-sm text-gray-600">$149/mo</span>
              </div>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>✓ 2,000 calls/month</li>
                <li>✓ 10,000 minutes</li>
                <li>✓ Live translation</li>
                <li>✓ Advanced analytics</li>
                <li>✓ Priority support</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">Enterprise</span>
                <span className="text-sm text-gray-600">Custom</span>
              </div>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>✓ Unlimited calls</li>
                <li>✓ Unlimited minutes</li>
                <li>✓ Custom integrations</li>
                <li>✓ Dedicated support</li>
                <li>✓ SLA guarantee</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
