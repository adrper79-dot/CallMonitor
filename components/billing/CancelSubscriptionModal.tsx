/**
 * Subscription Cancellation Modal
 * 
 * Confirmation dialog for subscription cancellation
 * Shows what features will be lost and when
 * 
 * Features:
 * - Feature loss preview
 * - Prorated refund information
 * - Effective date display
 * - Cancellation confirmation
 * 
 * @module components/billing/CancelSubscriptionModal
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Loader2, XCircle } from 'lucide-react'

interface CancelSubscriptionModalProps {
  subscriptionId: string
  currentPlan: string
  billingPeriodEnd: string
  proratedAmount?: number
  onCancel: () => Promise<void>
  children?: React.ReactNode
}

const featuresByPlan: Record<string, string[]> = {
  starter: [
    'Advanced transcription',
    'Basic analytics',
    '30 days call retention',
    'Priority email support',
  ],
  professional: [
    'AI sentiment analysis',
    'Custom reports',
    'Campaign management',
    '90 days call retention',
    'Phone & email support',
  ],
  enterprise: [
    'Real-time translation',
    'Custom integrations',
    'Dedicated account manager',
    'Unlimited retention',
    '24/7 phone support',
    'SLA guarantee',
  ],
}

export function CancelSubscriptionModal({
  subscriptionId,
  currentPlan,
  billingPeriodEnd,
  proratedAmount,
  onCancel,
  children,
}: CancelSubscriptionModalProps) {
  const [open, setOpen] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const featuresLost = featuresByPlan[currentPlan.toLowerCase()] || []
  const effectiveDate = new Date(billingPeriodEnd).toLocaleDateString()

  const handleCancel = async () => {
    try {
      setCanceling(true)
      await onCancel()
      setOpen(false)
      setConfirmed(false)
    } catch (error) {
      console.error('Cancellation failed:', error)
    } finally {
      setCanceling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="destructive" size="sm">
            Cancel Subscription
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancel Subscription
          </DialogTitle>
          <DialogDescription>
            This action will cancel your subscription at the end of the current billing
            period
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Effective Date */}
          <Alert>
            <AlertDescription>
              Your subscription will remain active until{' '}
              <strong>{effectiveDate}</strong>, then downgrade to the Free plan.
            </AlertDescription>
          </Alert>

          {/* Prorated Refund (if applicable) */}
          {proratedAmount && proratedAmount > 0 && (
            <Alert>
              <AlertDescription>
                You will receive a prorated refund of{' '}
                <strong>${proratedAmount.toFixed(2)}</strong> for the unused portion of
                your subscription.
              </AlertDescription>
            </Alert>
          )}

          {/* Features Lost */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              You will lose access to:
            </h4>
            <ul className="space-y-1 ml-6">
              {featuresLost.map((feature, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  • {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Free Plan Limits */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-sm mb-2">Free Plan Limits:</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>• 100 calls per month</p>
              <p>• 1 user</p>
              <p>• 7 days call retention</p>
              <p>• Email support only</p>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-3 bg-muted p-3 rounded-lg">
            <input
              type="checkbox"
              id="confirm-cancel"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="confirm-cancel" className="text-sm cursor-pointer">
              I understand that I will lose access to premium features and my plan will
              downgrade to Free on {effectiveDate}
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={canceling}>
            Keep Subscription
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={!confirmed || canceling}
          >
            {canceling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Canceling...
              </>
            ) : (
              'Confirm Cancellation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
