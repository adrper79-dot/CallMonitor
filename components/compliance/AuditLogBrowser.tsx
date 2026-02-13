'use client'

/**
 * AuditLogBrowser — Paginated audit trail viewer
 *
 * Fetches from /api/audit (existing endpoint). Shows all system actions
 * with filtering by action type, user, date range.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ScrollText, Search, RefreshCw, ChevronLeft, ChevronRight,
  User, Clock, Filter, ArrowUpDown,
} from 'lucide-react'

interface AuditEntry {
  id: string
  user_id: string
  user_email?: string
  action: string
  resource_type: string
  resource_id?: string
  old_value?: any
  new_value?: any
  ip_address?: string
  created_at: string
}

const actionColors: Record<string, string> = {
  created: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  updated: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  deleted: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  login: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  logout: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  exported: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
}

function getActionColor(action: string): string {
  const lower = action.toLowerCase()
  for (const [key, color] of Object.entries(actionColors)) {
    if (lower.includes(key)) return color
  }
  return 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

export default function AuditLogBrowser() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const pageSize = 25

  const fetchAudit = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const res = await apiGet(`/api/audit?limit=${pageSize}&offset=${offset}${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      const data = res.data || res.entries || res.audit_logs || []
      const total = res.total || res.count || data.length
      setEntries(
        data.map((e: any) => ({
          id: e.id,
          user_id: e.user_id,
          user_email: e.user_email || e.email,
          action: e.action,
          resource_type: e.resource_type,
          resource_id: e.resource_id,
          old_value: e.old_value,
          new_value: e.new_value,
          ip_address: e.ip_address,
          created_at: e.created_at,
        }))
      )
      setTotalPages(Math.max(1, Math.ceil(total / pageSize)))
    } catch (err: any) {
      logger.error('Failed to fetch audit log', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchAudit() }, [fetchAudit])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchAudit()
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by action, user, resource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <Button variant="outline" size="sm" type="submit" className="gap-1 text-xs">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </Button>
        <Button variant="outline" size="sm" type="button" onClick={fetchAudit} className="gap-1 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </form>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Time</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">User</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Action</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Resource</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="py-2.5 px-4">
                        <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500 text-sm">
                      <ScrollText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      No audit entries found
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <React.Fragment key={entry.id}>
                      <tr
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                        onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                      >
                        <td className="py-2 px-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                              {entry.user_email || entry.user_id?.slice(0, 8)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          <Badge className={`text-[10px] ${getActionColor(entry.action)}`}>
                            {entry.action}
                          </Badge>
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-xs text-gray-600 dark:text-gray-400">{entry.resource_type}</span>
                          {entry.resource_id && (
                            <span className="text-[10px] text-gray-400 ml-1">#{entry.resource_id.slice(0, 8)}</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-400">
                          {entry.old_value || entry.new_value ? 'Click to expand' : '—'}
                        </td>
                      </tr>
                      {expanded === entry.id && (entry.old_value || entry.new_value) && (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              {entry.old_value && (
                                <div>
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Previous</p>
                                  <pre className="p-2 bg-white dark:bg-gray-900 rounded border text-[11px] overflow-x-auto max-h-32">
                                    {typeof entry.old_value === 'string' ? entry.old_value : JSON.stringify(entry.old_value, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {entry.new_value && (
                                <div>
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">New</p>
                                  <pre className="p-2 bg-white dark:bg-gray-900 rounded border text-[11px] overflow-x-auto max-h-32">
                                    {typeof entry.new_value === 'string' ? entry.new_value : JSON.stringify(entry.new_value, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                            {entry.ip_address && (
                              <p className="mt-2 text-[10px] text-gray-400">IP: {entry.ip_address}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
