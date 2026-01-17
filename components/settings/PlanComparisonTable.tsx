/**
 * Plan Comparison Table Component
 * 
 * Interactive pricing table showing Free vs Pro plans with features.
 * Helps users understand benefits of upgrading.
 * 
 * Features:
 * - Side-by-side plan comparison
 * - Feature checkmarks and badges
 * - Upgrade CTA for free users
 * - Current plan indicator
 * - Responsive design
 * 
 * @module components/settings/PlanComparisonTable
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Check, X, Loader2, Crown, Zap } from 'lucide-react'

interface PlanFeature {
  name: string
  free: boolean | string
  pro: boolean | string
}

interface PlanComparisonTableProps {
  currentPlan: 'free' | 'pro' | 'enterprise'
  organizationId: string
  role: 'owner' | 'admin' | 'operator' | 'analyst' | 'viewer'
}

const features: PlanFeature[] = [
  { name: 'Calls per month', free: '10', pro: 'Unlimited' },
  { name: 'Call transcriptions', free: true, pro: true },
  { name: 'Real-time translation', free: false, pro: true },
  { name: 'AI sentiment analysis', free: false, pro: true },
  { name: 'Call recording', free: true, pro: true },
  { name: 'Quality scorecards', free: 'Basic', pro: 'Advanced' },
  { name: 'Team management', free: '3 users', pro: 'Unlimited' },
  { name: 'Analytics & reporting', free: 'Basic', pro: 'Advanced' },
  { name: 'Campaign management', free: false, pro: true },
  { name: 'Report builder', free: false, pro: true },
  { name: 'Custom webhooks', free: false, pro: true },
  { name: 'API access', free: 'Limited', pro: 'Full' },
  { name: 'Priority support', free: false, pro: true },
  { name: 'SLA guarantee', free: false, pro: true },
]

export function PlanComparisonTable({
  currentPlan,
  organizationId,
  role
}: PlanComparisonTableProps) {
  const router = useRouter()
  const [upgrading, setUpgrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManage = role === 'owner' || role === 'admin'
  const isFree = currentPlan === 'free'

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
        })
      })

      if (!res.ok) throw new Error('Failed to create checkout session')

      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      console.error('Error upgrading:', err)
      setError(err instanceof Error ? err.message : 'Failed to upgrade')
    } finally {
      setUpgrading(false)
    }
  }

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-green-600" />
      ) : (
        <X className="h-5 w-5 text-gray-400" />
      )
    }
    return <span className="text-sm font-medium">{value}</span>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare Plans</CardTitle>
        <CardDescription>
          Choose the plan that best fits your needs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Plan Headers */}
          <div className="grid grid-cols-3 gap-4">
            <div></div>
            {/* Free Plan Header */}
            <Card className={currentPlan === 'free' ? 'border-primary' : ''}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Free</CardTitle>
                  {currentPlan === 'free' && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-3xl font-bold">$0</div>
                  <div className="text-sm text-muted-foreground">/month</div>
                </div>
              </CardHeader>
            </Card>

            {/* Pro Plan Header */}
            <Card className={currentPlan === 'pro' ? 'border-primary' : 'border-primary/50'}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Pro</CardTitle>
                    <Crown className="h-5 w-5 text-yellow-500" />
                  </div>
                  {currentPlan === 'pro' && (
                    <Badge>Current</Badge>
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-3xl font-bold">$99</div>
                  <div className="text-sm text-muted-foreground">/month</div>
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* Features Comparison */}
          <div className="rounded-lg border">
            <div className="divide-y">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="grid grid-cols-3 gap-4 p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center">
                    <span className="text-sm font-medium">{feature.name}</span>
                  </div>
                  <div className="flex items-center justify-center">
                    {renderFeatureValue(feature.free)}
                  </div>
                  <div className="flex items-center justify-center">
                    {renderFeatureValue(feature.pro)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade CTA for Free Users */}
          {isFree && (
            <Card className="border-primary bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Unlock Pro Features</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Upgrade to Pro for unlimited calls, advanced analytics, campaign
                      management, and priority support.
                    </p>
                    <Button
                      onClick={handleUpgrade}
                      disabled={!canManage || upgrading}
                      className="mt-4"
                    >
                      {upgrading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Crown className="mr-2 h-4 w-4" />
                          Upgrade to Pro
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Need more? Contact us for Enterprise pricing with custom features and SLAs.
      </CardFooter>
    </Card>
  )
}
