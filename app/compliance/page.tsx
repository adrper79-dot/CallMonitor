'use client'

/**
 * /compliance — Compliance hub landing
 *
 * Tabs: Violations | Disputes | DNC | Audit Log
 */

import React, { useState } from 'react'
import { ShieldCheck, AlertTriangle, FileWarning, PhoneOff, ScrollText, Award } from 'lucide-react'
import dynamic from 'next/dynamic'

const ViolationDashboard = dynamic(() => import('@/components/compliance/ViolationDashboard'), { ssr: false })
const AuditLogBrowser = dynamic(() => import('@/components/compliance/AuditLogBrowser'), { ssr: false })
const DNCManager = dynamic(() => import('@/components/compliance/DNCManager'), { ssr: false })
const SOC2CertificationTracker = dynamic(() => import('@/components/compliance/SOC2CertificationTracker'), { ssr: false })

type Tab = 'violations' | 'disputes' | 'dnc' | 'audit' | 'soc2'

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>('violations')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'violations', label: 'Violations', icon: <AlertTriangle className="w-4 h-4" /> },
    { key: 'disputes', label: 'Disputes', icon: <FileWarning className="w-4 h-4" /> },
    { key: 'dnc', label: 'DNC List', icon: <PhoneOff className="w-4 h-4" /> },
    { key: 'audit', label: 'Audit Log', icon: <ScrollText className="w-4 h-4" /> },
    { key: 'soc2', label: 'SOC 2', icon: <Award className="w-4 h-4" /> },
  ]

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-primary-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Compliance Center</h1>
        </div>
        <p className="text-sm text-gray-500">FDCPA, TCPA & Reg F compliance management</p>
      </div>

      {/* Tab bar */}
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

      {tab === 'violations' && <ViolationDashboard />}
      {tab === 'disputes' && (
        <div className="text-center py-12 text-gray-500">
          <FileWarning className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium mb-1">Disputes module coming soon</p>
          <p className="text-xs text-gray-400">Worker route /api/disputes is a Phase 3 item</p>
        </div>
      )}
      {tab === 'dnc' && <DNCManager />}
      {tab === 'audit' && <AuditLogBrowser />}
      {tab === 'soc2' && <SOC2CertificationTracker />}
    </div>
  )
}
