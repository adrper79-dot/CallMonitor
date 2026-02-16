'use client'

/**
 * /accounts/disputes — Account-level dispute view (agent perspective)
 *
 * Shows accounts with active disputes so agents know
 * which accounts require special handling during calls.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Search, FileWarning, Clock } from 'lucide-react'

interface DisputedAccount {
  id: string
  account_id: string
  account_name: string
  dispute_type: string
  status: string
  filed_at: string
  days_remaining: number
}

export default function AccountDisputesPage() {
  const [disputes, setDisputes] = useState<DisputedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchDisputes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/compliance/disputes?limit=100')
      const data = res.data || res.disputes || []
      setDisputes(
        data.map((d: any) => {
          const deadline = new Date(d.deadline || d.filed_at || d.created_at)
          if (!d.deadline) deadline.setDate(deadline.getDate() + 30)
          return {
            id: d.id,
            account_id: d.account_id,
            account_name: d.account_name || 'Unknown',
            dispute_type: d.type || d.dispute_type || 'General',
            status: d.status || 'open',
            filed_at: d.filed_at || d.created_at,
            days_remaining: Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          }
        })
      )
    } catch (err: any) {
      logger.warn('Disputes not available', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDisputes() }, [fetchDisputes])

  const filtered = search
    ? disputes.filter((d) => d.account_name.toLowerCase().includes(search.toLowerCase()))
    : disputes

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileWarning className="w-5 h-5 text-amber-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Disputed Accounts</h1>
          </div>
          <p className="text-sm text-gray-500">Accounts with active disputes — handle with care</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDisputes} className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by account name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 outline-none"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileWarning className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">
              {disputes.length === 0 ? 'No disputed accounts' : 'No matches'}
            </p>
          </div>
        ) : (
          filtered.map((d) => (
            <Card key={d.id} className={d.days_remaining <= 5 ? 'border-red-200 dark:border-red-800' : ''}>
              <CardContent className="p-3 flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${d.days_remaining <= 5 ? 'text-red-500' : 'text-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/accounts/${d.account_id}`}
                    prefetch={false}
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600"
                  >
                    {d.account_name}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px]">{d.dispute_type}</Badge>
                    <span className="text-[10px] text-gray-400">{d.status}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-medium ${d.days_remaining <= 5 ? 'text-red-600' : 'text-gray-500'}`}>
                    <Clock className="w-3 h-3 inline mr-0.5" />
                    {d.days_remaining > 0 ? `${d.days_remaining}d left` : 'Overdue'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
