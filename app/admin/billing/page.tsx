'use client'

/**
 * /admin/billing — Subscription & billing management
 *
 * Composes existing billing components: SubscriptionManager, PaymentMethodManager,
 * InvoiceHistory, UsageDisplay, BillingActions, PlanComparisonTable.
 */

import React, { useState, useEffect } from 'react'
import { CreditCard, Receipt, BarChart3, Settings } from 'lucide-react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import dynamic from 'next/dynamic'

const SubscriptionManager = dynamic(() => import('@/components/settings/SubscriptionManager').then(mod => mod.SubscriptionManager), { ssr: false })
const PaymentMethodManager = dynamic(() => import('@/components/settings/PaymentMethodManager').then(mod => mod.PaymentMethodManager), { ssr: false })
const InvoiceHistory = dynamic(() => import('@/components/settings/InvoiceHistory').then(mod => mod.InvoiceHistory), { ssr: false })
const UsageDisplay = dynamic(() => import('@/components/settings/UsageDisplay').then(mod => mod.UsageDisplay), { ssr: false })

type Tab = 'subscription' | 'methods' | 'invoices' | 'usage'
type Role = 'owner' | 'admin' | 'operator' | 'analyst' | 'viewer'

export default function AdminBillingPage() {
  const { data: session } = useSession()
  const [tab, setTab] = useState<Tab>('subscription')
  const [orgId, setOrgId] = useState('')
  const [plan, setPlan] = useState('base')
  const [role, setRole] = useState<Role>('admin')

  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return
    apiGet(`/api/users/${userId}/organization`)
      .then((data: any) => {
        if (data.organization?.id) setOrgId(data.organization.id)
        if (data.organization?.plan) setPlan(data.organization.plan)
        if (data.role) setRole(data.role as Role)
      })
      .catch((err: any) => logger.error('Failed to load org for billing', err))
  }, [session])

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'subscription', label: 'Subscription', icon: <CreditCard className="w-4 h-4" /> },
    { key: 'methods', label: 'Payment Methods', icon: <Settings className="w-4 h-4" /> },
    { key: 'invoices', label: 'Invoices', icon: <Receipt className="w-4 h-4" /> },
    { key: 'usage', label: 'Usage', icon: <BarChart3 className="w-4 h-4" /> },
  ]

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Billing & Plans</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage subscription, payments, and usage</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'subscription' && <SubscriptionManager organizationId={orgId} role={role} />}
      {tab === 'methods' && <PaymentMethodManager organizationId={orgId} role={role} />}
      {tab === 'invoices' && <InvoiceHistory organizationId={orgId} role={role} />}
      {tab === 'usage' && <UsageDisplay organizationId={orgId} plan={plan} />}
    </div>
  )
}
