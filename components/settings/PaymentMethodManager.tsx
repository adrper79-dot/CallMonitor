/**
 * Payment Method Manager Component
 * 
 * Displays and manages payment methods attached to the subscription.
 * RBAC: Owner/Admin only
 * 
 * Features:
 * - List all payment methods
 * - Default payment method indicator
 * - Add new payment method (via Stripe portal)
 * - Remove payment method
 * - Card brand icons
 * - Last 4 digits display
 * 
 * @module components/settings/PaymentMethodManager
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Loader2, CreditCard, Plus, Trash2, CheckCircle } from 'lucide-react'
import { logger } from '@/lib/logger'

interface PaymentMethod {
  id: string
  card: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  }
  is_default: boolean
}

interface PaymentMethodManagerProps {
  organizationId: string
  role: 'owner' | 'admin' | 'operator' | 'analyst' | 'viewer'
}

export function PaymentMethodManager({ organizationId, role }: PaymentMethodManagerProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManage = role === 'owner' || role === 'admin'

  useEffect(() => {
    fetchPaymentMethods()
  }, [organizationId])

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/billing/payment-methods?orgId=${organizationId}`, {
        credentials: 'include'
      })

      if (!res.ok) {
        if (res.status === 404) {
          // No payment methods found
          setPaymentMethods([])
          return
        }
        throw new Error('Failed to fetch payment methods')
      }

      const data = await res.json()
      setPaymentMethods(data.paymentMethods || [])
    } catch (err) {
      logger.error('Error fetching payment methods', err, { organizationId })
      setError(err instanceof Error ? err.message : 'Failed to load payment methods')
    } finally {
      setLoading(false)
    }
  }

  const handleAddPaymentMethod = async () => {
    if (!canManage) return

    try {
      setAdding(true)
      setError(null)

      // Redirect to Stripe portal to add payment method
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
      setError(err instanceof Error ? err.message : 'Failed to add payment method')
    } finally {
      setAdding(false)
    }
  }

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    if (!canManage) return

    try {
      setRemoving(paymentMethodId)
      setError(null)

      const res = await fetch(`/api/billing/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to remove payment method')

      await fetchPaymentMethods()
    } catch (err) {
      logger.error('Error removing payment method', err, { organizationId, paymentMethodId })
      setError(err instanceof Error ? err.message : 'Failed to remove payment method')
    } finally {
      setRemoving(null)
    }
  }

  const getCardBrandIcon = (brand: string) => {
    // Return appropriate icon based on brand
    return <CreditCard className="h-5 w-5" />
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>Manage your payment methods</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Manage your payment methods</CardDescription>
          </div>
          <Button
            onClick={handleAddPaymentMethod}
            disabled={!canManage || adding}
            size="sm"
          >
            {adding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Payment Method
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {paymentMethods.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm font-medium">No payment methods</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a payment method to manage your subscription
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    {getCardBrandIcon(method.card.brand)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">
                          {method.card.brand} •••• {method.card.last4}
                        </p>
                        {method.is_default && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires {method.card.exp_month.toString().padStart(2, '0')}/
                        {method.card.exp_year}
                      </p>
                    </div>
                  </div>

                  {!method.is_default && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage || removing === method.id}
                        >
                          {removing === method.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove this payment method? This action
                            cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemovePaymentMethod(method.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
