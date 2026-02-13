'use client'

/**
 * /accounts/[id] — Account detail page
 *
 * Full account view with tabbed sections:
 * - Overview (balance, status, contact info)
 * - Call History
 * - Payment History
 * - Compliance Log
 * - Notes
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/components/AuthProvider'
import { apiGet, apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Phone, CreditCard, FileText, Shield,
  Clock, DollarSign, Calendar, User, Mail, MapPin,
  AlertTriangle, CheckCircle, ExternalLink, Plus,
  CalendarClock, MessageSquare, TrendingUp,
} from 'lucide-react'

interface AccountDetail {
  id: string
  external_id: string | null
  name: string
  balance_due: string
  primary_phone: string
  secondary_phone: string | null
  email: string | null
  address: string | null
  status: string
  notes: string | null
  promise_date: string | null
  promise_amount: string | null
  last_contacted_at: string | null
  created_at: string
  updated_at: string
  days_past_due?: number
  likelihood_score?: number
  contact_count_7day?: number
}

interface CallRecord {
  id: string
  started_at: string
  duration_seconds: number
  disposition: string | null
  agent_name: string | null
}

interface PaymentRecord {
  id: string
  amount: number
  status: string
  type: string
  created_at: string
}

type Tab = 'overview' | 'calls' | 'payments' | 'compliance' | 'notes'

export default function AccountDetailClient() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const accountId = params.id as string

  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [noteText, setNoteText] = useState('')

  const fetchAccount = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    try {
      const data = await apiGet(`/api/collections/${accountId}`)
      setAccount(data.data || data.account || data)
    } catch (err: any) {
      logger.error('Failed to load account', { error: err?.message, accountId })
    } finally {
      setLoading(false)
    }
  }, [accountId])

  const fetchCalls = useCallback(async () => {
    try {
      const data = await apiGet(`/api/calls?account_id=${accountId}&limit=20`)
      setCalls(data.data || data.calls || [])
    } catch { /* non-critical */ }
  }, [accountId])

  const fetchPayments = useCallback(async () => {
    try {
      const data = await apiGet(`/api/payments?account_id=${accountId}&limit=20`)
      setPayments(data.data || data.payments || [])
    } catch { /* non-critical */ }
  }, [accountId])

  useEffect(() => { fetchAccount() }, [fetchAccount])

  useEffect(() => {
    if (activeTab === 'calls') fetchCalls()
    if (activeTab === 'payments') fetchPayments()
  }, [activeTab, fetchCalls, fetchPayments])

  const handleAddNote = async () => {
    if (!noteText.trim() || !accountId) return
    try {
      await apiPost(`/api/collections/${accountId}/notes`, {
        content: noteText.trim(),
      })
      setNoteText('')
      fetchAccount() // Refresh to see updated notes
    } catch (err: any) {
      logger.error('Failed to add note', { error: err?.message })
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
    { key: 'calls', label: 'Calls', icon: <Phone className="w-4 h-4" /> },
    { key: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
    { key: 'compliance', label: 'Compliance', icon: <Shield className="w-4 h-4" /> },
    { key: 'notes', label: 'Notes', icon: <FileText className="w-4 h-4" /> },
  ]

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-6" />
        <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="text-center py-12 text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Account not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{account.name}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <Badge variant="secondary">{account.status}</Badge>
            {account.external_id && <span>ID: {account.external_id}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/work/call?account=${accountId}`}>
            <Button className="bg-green-600 hover:bg-green-700 text-white gap-1.5" size="sm">
              <Phone className="w-4 h-4" />
              Call
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Balance Due</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${parseFloat(account.balance_due || '0').toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Days Overdue</p>
            <p className={`text-2xl font-bold ${(account.days_past_due || 0) > 60 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
              {account.days_past_due || '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">AI Score</p>
            <p className="text-2xl font-bold text-amber-600">
              {account.likelihood_score !== undefined ? `${account.likelihood_score}%` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Contacts (7d)</p>
            <p className={`text-2xl font-bold ${(account.contact_count_7day || 0) >= 6 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
              {account.contact_count_7day ?? '—'}/7
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-gray-100">{account.primary_phone}</span>
                {account.secondary_phone && (
                  <span className="text-gray-500 ml-2">({account.secondary_phone})</span>
                )}
              </div>
              {account.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900 dark:text-gray-100">{account.email}</span>
                </div>
              )}
              {account.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900 dark:text-gray-100">{account.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Added {new Date(account.created_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {account.last_contacted_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>Last contact: {new Date(account.last_contacted_at).toLocaleString()}</span>
                </div>
              )}
              {account.promise_date && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <CalendarClock className="w-4 h-4" />
                  <span>Promise: ${account.promise_amount} by {new Date(account.promise_date).toLocaleDateString()}</span>
                </div>
              )}
              {account.notes && (
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-700 dark:text-gray-300">
                  {account.notes}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'calls' && (
        <Card>
          <CardContent className="p-0">
            {calls.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Phone className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium">No call history</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {calls.map((call) => (
                  <div key={call.id} className="flex items-center gap-3 p-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {call.disposition || 'No disposition'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(call.started_at).toLocaleString()}
                        {call.duration_seconds > 0 && ` • ${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}`}
                        {call.agent_name && ` • ${call.agent_name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'payments' && (
        <Card>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium">No payment history</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {payments.map((pmt) => (
                  <div key={pmt.id} className="flex items-center gap-3 p-3">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        ${pmt.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {pmt.type} • {new Date(pmt.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{pmt.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'compliance' && (
        <Card>
          <CardContent className="p-4">
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium">Compliance log</p>
              <p className="text-xs">FDCPA, TCPA, and state regulation audit trail</p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'notes' && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-4">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this account..."
                className="w-full p-3 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim()} className="gap-1">
                  <Plus className="w-4 h-4" />
                  Add Note
                </Button>
              </div>
            </div>
            {account.notes ? (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm text-gray-700 dark:text-gray-300">
                {account.notes}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500 py-4">No notes yet</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
