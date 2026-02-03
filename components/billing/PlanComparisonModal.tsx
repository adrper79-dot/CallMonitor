/**
 * Plan Comparison Modal
 * 
 * Shows detailed plan comparison for upgrade decisions
 * Displays features, limits, and pricing for all plans
 * 
 * Features:
 * - Side-by-side plan comparison
 * - Highlight current plan
 * - Emphasize upgrade benefits
 * - Direct upgrade CTA
 * 
 * @module components/billing/PlanComparisonModal
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Check, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface Plan {
  id: string
  name: string
  price: number
  interval: 'month' | 'year'
  features: string[]
  limits: {
    calls: number
    users: number
    storage: string
    support: string
  }
  popular?: boolean
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      'Up to 100 calls/month',
      '1 user',
      'Basic call recording',
      'Email support',
      '7 days call retention',
    ],
    limits: {
      calls: 100,
      users: 1,
      storage: '1 GB',
      support: 'Email',
    },
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    interval: 'month',
    features: [
      'Up to 1,000 calls/month',
      '5 users',
      'Advanced transcription',
      'Basic analytics',
      '30 days retention',
      'Priority email support',
    ],
    limits: {
      calls: 1000,
      users: 5,
      storage: '10 GB',
      support: 'Priority Email',
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 149,
    interval: 'month',
    popular: true,
    features: [
      'Up to 5,000 calls/month',
      '20 users',
      'AI sentiment analysis',
      'Custom reports',
      'Campaign management',
      '90 days retention',
      'Phone & email support',
    ],
    limits: {
      calls: 5000,
      users: 20,
      storage: '50 GB',
      support: 'Phone & Email',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499,
    interval: 'month',
    features: [
      'Unlimited calls',
      'Unlimited users',
      'Real-time translation',
      'Custom integrations',
      'Dedicated account manager',
      'Unlimited retention',
      '24/7 phone support',
      'SLA guarantee',
    ],
    limits: {
      calls: -1, // Unlimited
      users: -1, // Unlimited
      storage: 'Unlimited',
      support: '24/7 Phone',
    },
  },
]

interface PlanComparisonModalProps {
  currentPlanId: string
  onUpgrade: (planId: string) => Promise<void>
  children?: React.ReactNode
}

export function PlanComparisonModal({
  currentPlanId,
  onUpgrade,
  children,
}: PlanComparisonModalProps) {
  const [open, setOpen] = useState(false)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const handleUpgrade = async (planId: string) => {
    try {
      setUpgrading(planId)
      await onUpgrade(planId)
      setOpen(false)
    } catch (error) {
      logger.error('Plan upgrade failed', error, { planId, currentPlanId })
    } finally {
      setUpgrading(null)
    }
  }

  const getCurrentPlanIndex = () => {
    return plans.findIndex((p) => p.id === currentPlanId)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            Compare Plans
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose Your Plan</DialogTitle>
          <DialogDescription>
            Select the plan that best fits your business needs
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-4 gap-6 py-6">
          {plans.map((plan, index) => {
            const isCurrent = plan.id === currentPlanId
            const canUpgrade = index > getCurrentPlanIndex()
            const isDowngrade = index < getCurrentPlanIndex()

            return (
              <div
                key={plan.id}
                className={cn(
                  'relative rounded-lg border p-6 space-y-4',
                  plan.popular && 'border-primary shadow-lg',
                  isCurrent && 'bg-muted'
                )}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}

                {isCurrent && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                  >
                    Current Plan
                  </Badge>
                )}

                <div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.interval}</span>
                  </div>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button disabled className="w-full">
                    Current Plan
                  </Button>
                ) : canUpgrade ? (
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={upgrading !== null}
                    className="w-full"
                  >
                    {upgrading === plan.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Upgrading...
                      </>
                    ) : (
                      <>Upgrade to {plan.name}</>
                    )}
                  </Button>
                ) : isDowngrade ? (
                  <Button variant="outline" disabled className="w-full">
                    Downgrade to {plan.name}
                  </Button>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="border-t pt-6">
          <h4 className="font-semibold mb-4">Detailed Comparison</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="text-center py-2">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Monthly Calls</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-2">
                      {plan.limits.calls === -1
                        ? 'Unlimited'
                        : plan.limits.calls.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2">Team Members</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-2">
                      {plan.limits.users === -1
                        ? 'Unlimited'
                        : plan.limits.users}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2">Storage</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-2">
                      {plan.limits.storage}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2">Support</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-2">
                      {plan.limits.support}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
