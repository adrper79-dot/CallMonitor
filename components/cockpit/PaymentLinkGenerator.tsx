'use client'

/**
 * PaymentLinkGenerator — Generate & send Stripe payment links
 *
 * Used as a modal/sheet overlay in the Cockpit during active calls.
 * Creates a payment link and copies/sends it to the consumer.
 */

import React, { useState, useCallback } from 'react'
import { apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard, Link2, Copy, CheckCircle, Send,
  AlertTriangle, Loader2, DollarSign, X, Smartphone,
  Mail, MessageSquare,
} from 'lucide-react'

interface PaymentLinkGeneratorProps {
  accountId: string
  accountName: string
  balanceDue: number
  phone: string
  email?: string | null
  onClose: () => void
  onCreated?: (link: string) => void
}

type DeliveryMethod = 'sms' | 'email' | 'copy'

export default function PaymentLinkGenerator({
  accountId,
  accountName,
  balanceDue,
  phone,
  email,
  onClose,
  onCreated,
}: PaymentLinkGeneratorProps) {
  const [amount, setAmount] = useState(balanceDue.toString())
  const [description, setDescription] = useState(`Payment for account ${accountName}`)
  const [delivery, setDelivery] = useState<DeliveryMethod>('sms')
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quick amount presets
  const presets = [
    { label: 'Full', amount: balanceDue },
    { label: '50%', amount: Math.round(balanceDue * 0.5) },
    { label: '25%', amount: Math.round(balanceDue * 0.25) },
    { label: '$50', amount: 50 },
    { label: '$100', amount: 100 },
  ]

  const handleGenerate = useCallback(async () => {
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid amount')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/api/payments/links', {
        account_id: accountId,
        amount: parsedAmount,
        description,
        currency: 'usd',
      })

      const paymentLink = data.url || data.link || data.data?.url
      if (!paymentLink) throw new Error('No payment link returned')

      setLink(paymentLink)
      onCreated?.(paymentLink)
      logger.info('Payment link created', { accountId, amount: parsedAmount })
    } catch (err: any) {
      logger.error('Failed to create payment link', { error: err?.message })
      setError(err?.message || 'Failed to create payment link')
    } finally {
      setLoading(false)
    }
  }, [accountId, amount, description, onCreated])

  const handleCopy = () => {
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSend = useCallback(async () => {
    if (!link) return
    setSent(false)

    try {
      if (delivery === 'sms') {
        await apiPost('/api/messages/send', {
          to: phone,
          body: `Payment link for your account: ${link}`,
          account_id: accountId,
          type: 'payment_link',
        })
      } else if (delivery === 'email' && email) {
        await apiPost('/api/messages/email', {
          to: email,
          subject: `Payment Link - ${accountName}`,
          body: `Please use this link to make your payment: ${link}`,
          account_id: accountId,
          type: 'payment_link',
        })
      }
      setSent(true)
      logger.info('Payment link sent', { accountId, delivery })
    } catch (err: any) {
      logger.error('Failed to send payment link', { error: err?.message })
      setError(`Failed to send via ${delivery}: ${err?.message}`)
    }
  }, [link, delivery, phone, email, accountId, accountName])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            Send Payment Link
          </CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Info */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{accountName}</p>
            <p className="text-xs text-gray-500">
              Balance: ${balanceDue.toLocaleString()} • {phone}
            </p>
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</label>
            <div className="relative mt-1">
              <DollarSign className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 outline-none"
                min="1"
                step="0.01"
              />
            </div>
            {/* Quick presets */}
            <div className="flex gap-1.5 mt-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setAmount(p.amount.toString())}
                  className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                    parseFloat(amount) === p.amount
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* Generate Button */}
          {!link && (
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              Generate Payment Link
            </Button>
          )}

          {/* Link Result */}
          {link && (
            <div className="space-y-3">
              <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">Link Created</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 break-all font-mono">{link}</p>
              </div>

              {/* Delivery options */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setDelivery('sms')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors ${
                    delivery === 'sms' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-gray-200 dark:border-gray-700 text-gray-600'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  SMS
                </button>
                <button
                  onClick={() => setDelivery('email')}
                  disabled={!email}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    delivery === 'email' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-gray-200 dark:border-gray-700 text-gray-600'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </button>
                <button
                  onClick={() => { setDelivery('copy'); handleCopy() }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors ${
                    delivery === 'copy' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-gray-200 dark:border-gray-700 text-gray-600'
                  }`}
                >
                  {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Send button */}
              {delivery !== 'copy' && (
                <Button
                  onClick={handleSend}
                  disabled={sent}
                  className="w-full gap-1.5"
                  variant={sent ? 'outline' : 'default'}
                >
                  {sent ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Sent!
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send via {delivery === 'sms' ? 'SMS' : 'Email'}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
