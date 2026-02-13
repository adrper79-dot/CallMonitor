'use client'

/**
 * Quick Action Modals — Payment Link, Note, Callback, Dispute
 *
 * Standalone modal components for agent quick actions in the Cockpit.
 * Each modal is self-contained with its own API call and validation.
 */

import React, { useState } from 'react'
import { apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CreditCard, FileText, CalendarClock, AlertTriangle,
  X, Send, Check, Loader2,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Shared modal wrapper
// ─────────────────────────────────────────────

function ModalOverlay({
  title,
  icon,
  onClose,
  children,
}: {
  title: string
  icon: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle className="text-base">{title}</CardTitle>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
// Payment Link Modal
// ─────────────────────────────────────────────

export function PaymentLinkModal({
  accountId,
  accountName,
  balanceDue,
  onClose,
}: {
  accountId: string
  accountName: string
  balanceDue: number
  onClose: () => void
}) {
  const [amount, setAmount] = useState(balanceDue.toString())
  const [method, setMethod] = useState<'sms' | 'email'>('sms')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    setSending(true)
    try {
      await apiPost('/api/payments/link', {
        account_id: accountId,
        amount: parseFloat(amount),
        delivery_method: method,
      })
      setSent(true)
      logger.info('Payment link sent', { accountId, amount, method })
      setTimeout(onClose, 1500)
    } catch (err: any) {
      logger.error('Payment link failed', { error: err?.message })
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <ModalOverlay title="Payment Link Sent" icon={<Check className="w-5 h-5 text-green-600" />} onClose={onClose}>
        <div className="text-center py-4">
          <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Payment link sent to {accountName} via {method}.</p>
        </div>
      </ModalOverlay>
    )
  }

  return (
    <ModalOverlay title="Send Payment Link" icon={<CreditCard className="w-5 h-5 text-green-600" />} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{accountName}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Amount ($)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800"
            step="0.01"
            min="0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Delivery</label>
          <div className="flex gap-2">
            {(['sms', 'email'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                  method === m
                    ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/20 dark:border-primary-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={handleSend} disabled={sending || !amount} className="w-full gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Payment Link
        </Button>
      </div>
    </ModalOverlay>
  )
}

// ─────────────────────────────────────────────
// Add Note Modal
// ─────────────────────────────────────────────

export function AddNoteModal({
  accountId,
  callId,
  onClose,
}: {
  accountId: string
  callId: string | null
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!note.trim()) return
    setSaving(true)
    try {
      await apiPost('/api/notes', {
        account_id: accountId,
        call_id: callId,
        content: note.trim(),
      })
      setSaved(true)
      logger.info('Note saved', { accountId, callId })
      setTimeout(onClose, 1000)
    } catch (err: any) {
      logger.error('Note save failed', { error: err?.message })
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <ModalOverlay title="Note Saved" icon={<Check className="w-5 h-5 text-green-600" />} onClose={onClose}>
        <div className="text-center py-4">
          <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Note saved successfully.</p>
        </div>
      </ModalOverlay>
    )
  }

  return (
    <ModalOverlay title="Add Note" icon={<FileText className="w-5 h-5 text-blue-600" />} onClose={onClose}>
      <div className="space-y-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter note about this account or call..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 resize-none"
          autoFocus
        />
        <Button onClick={handleSave} disabled={saving || !note.trim()} className="w-full gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Save Note
        </Button>
      </div>
    </ModalOverlay>
  )
}

// ─────────────────────────────────────────────
// Schedule Callback Modal
// ─────────────────────────────────────────────

export function ScheduleCallbackModal({
  accountId,
  accountName,
  onClose,
}: {
  accountId: string
  accountName: string
  onClose: () => void
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [notes, setNotes] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [scheduled, setScheduled] = useState(false)

  const handleSchedule = async () => {
    if (!date || !time) return
    setScheduling(true)
    try {
      await apiPost('/api/callbacks', {
        account_id: accountId,
        scheduled_for: `${date}T${time}:00Z`,
        notes: notes.trim() || null,
      })
      setScheduled(true)
      logger.info('Callback scheduled', { accountId, date, time })
      setTimeout(onClose, 1500)
    } catch (err: any) {
      logger.error('Callback schedule failed', { error: err?.message })
    } finally {
      setScheduling(false)
    }
  }

  if (scheduled) {
    return (
      <ModalOverlay title="Callback Scheduled" icon={<Check className="w-5 h-5 text-green-600" />} onClose={onClose}>
        <div className="text-center py-4">
          <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Callback for {accountName} scheduled.</p>
        </div>
      </ModalOverlay>
    )
  }

  return (
    <ModalOverlay title="Schedule Callback" icon={<CalendarClock className="w-5 h-5 text-purple-600" />} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{accountName}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-800"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-800"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for callback..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-800"
          />
        </div>
        <Button onClick={handleSchedule} disabled={scheduling || !date} className="w-full gap-2">
          {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
          Schedule
        </Button>
      </div>
    </ModalOverlay>
  )
}

// ─────────────────────────────────────────────
// File Dispute Modal
// ─────────────────────────────────────────────

export function FileDisputeModal({
  accountId,
  accountName,
  callId,
  onClose,
}: {
  accountId: string
  accountName: string
  callId: string | null
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [type, setType] = useState<'billing' | 'identity' | 'amount' | 'other'>('billing')
  const [filing, setFiling] = useState(false)
  const [filed, setFiled] = useState(false)

  const handleFile = async () => {
    if (!reason.trim()) return
    setFiling(true)
    try {
      await apiPost('/api/disputes', {
        account_id: accountId,
        call_id: callId,
        type,
        reason: reason.trim(),
      })
      setFiled(true)
      logger.info('Dispute filed', { accountId, type })
      setTimeout(onClose, 1500)
    } catch (err: any) {
      logger.error('Dispute file failed', { error: err?.message })
    } finally {
      setFiling(false)
    }
  }

  if (filed) {
    return (
      <ModalOverlay title="Dispute Filed" icon={<Check className="w-5 h-5 text-green-600" />} onClose={onClose}>
        <div className="text-center py-4">
          <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Dispute filed for {accountName}.</p>
        </div>
      </ModalOverlay>
    )
  }

  return (
    <ModalOverlay title="File Dispute" icon={<AlertTriangle className="w-5 h-5 text-amber-600" />} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{accountName}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Dispute Type</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'billing' as const, label: 'Billing Error' },
              { value: 'identity' as const, label: 'Not My Debt' },
              { value: 'amount' as const, label: 'Wrong Amount' },
              { value: 'other' as const, label: 'Other' },
            ]).map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                  type === t.value
                    ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the dispute reason..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 resize-none"
            autoFocus
          />
        </div>
        <Button onClick={handleFile} disabled={filing || !reason.trim()} className="w-full gap-2">
          {filing ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
          File Dispute
        </Button>
      </div>
    </ModalOverlay>
  )
}

// ─────────────────────────────────────────────
// Transfer Call Modal
// ─────────────────────────────────────────────

export function TransferCallModal({
  callId,
  onClose,
  onTransfer,
}: {
  callId: string
  onClose: () => void
  onTransfer: (to: string) => Promise<void>
}) {
  const [target, setTarget] = useState('')
  const [transferring, setTransferring] = useState(false)

  const handleTransfer = async () => {
    if (!target.trim()) return
    setTransferring(true)
    try {
      await onTransfer(target.trim())
      onClose()
    } catch (err: any) {
      logger.error('Transfer failed', { error: err?.message })
    } finally {
      setTransferring(false)
    }
  }

  return (
    <ModalOverlay title="Transfer Call" icon={<Send className="w-5 h-5 text-blue-600" />} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Transfer to (phone or extension)</label>
          <input
            type="tel"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="+1234567890 or ext. 101"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-800"
            autoFocus
          />
        </div>
        <Button onClick={handleTransfer} disabled={transferring || !target.trim()} className="w-full gap-2">
          {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Transfer
        </Button>
      </div>
    </ModalOverlay>
  )
}
