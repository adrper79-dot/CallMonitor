'use client'

/**
 * DNCManager — Do Not Call list management
 *
 * CRUD for DNC entries: add phone numbers, import CSV, search, remove.
 * Posts to /api/dnc (worker route needs creation — Phase 3).
 * For now, uses a local mock or attempts real API.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  PhoneOff, Search, Plus, Trash2, Upload, Download,
  RefreshCw, AlertTriangle, CheckCircle, Phone,
} from 'lucide-react'

interface DNCEntry {
  id: string
  phone_number: string
  reason: string
  source: 'manual' | 'consumer_request' | 'federal_dnc' | 'state_dnc' | 'litigation'
  added_by?: string
  expires_at?: string
  created_at: string
}

const sourceColors: Record<string, string> = {
  manual: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  consumer_request: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  federal_dnc: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  state_dnc: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  litigation: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
}

export default function DNCManager() {
  const [entries, setEntries] = useState<DNCEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newReason, setNewReason] = useState('')
  const [newSource, setNewSource] = useState<DNCEntry['source']>('manual')
  const [adding, setAdding] = useState(false)
  const [checkPhone, setCheckPhone] = useState('')
  const [checkResult, setCheckResult] = useState<'clear' | 'blocked' | null>(null)

  const fetchDNC = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/dnc?limit=200')
      const data = res.data || res.entries || []
      setEntries(
        data.map((e: any) => ({
          id: e.id,
          phone_number: e.phone_number || e.phone,
          reason: e.reason || '',
          source: e.source || 'manual',
          added_by: e.added_by,
          expires_at: e.expires_at,
          created_at: e.created_at,
        }))
      )
    } catch (err: any) {
      // DNC route may not exist yet — show empty state
      logger.warn('DNC endpoint not available', { error: err?.message })
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDNC() }, [fetchDNC])

  const handleAdd = async () => {
    if (!newPhone.trim()) return
    setAdding(true)
    try {
      await apiPost('/api/dnc', {
        phone_number: newPhone.replace(/\D/g, ''),
        reason: newReason,
        source: newSource,
      })
      setNewPhone('')
      setNewReason('')
      setShowAdd(false)
      fetchDNC()
    } catch (err: any) {
      logger.error('Failed to add DNC entry', { error: err?.message })
      alert('Failed to add DNC entry. The /api/dnc route may not be available yet.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this number from the DNC list?')) return
    try {
      await apiDelete(`/api/dnc/${id}`)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err: any) {
      logger.error('Failed to remove DNC entry', { error: err?.message })
    }
  }

  const handleCheck = () => {
    const cleaned = checkPhone.replace(/\D/g, '')
    const found = entries.some((e) => e.phone_number.includes(cleaned))
    setCheckResult(found ? 'blocked' : 'clear')
  }

  const filtered = entries.filter((e) => {
    if (!search) return true
    return e.phone_number.includes(search.replace(/\D/g, '')) || e.reason.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-4">
      {/* Quick Check */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick DNC Check</p>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-xs">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                placeholder="Enter phone number..."
                value={checkPhone}
                onChange={(e) => { setCheckPhone(e.target.value); setCheckResult(null) }}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button size="sm" onClick={handleCheck} disabled={!checkPhone.trim()}>Check</Button>
            {checkResult === 'blocked' && (
              <Badge className="bg-red-50 text-red-700 dark:bg-red-900/20 gap-1">
                <PhoneOff className="w-3 h-3" /> Blocked
              </Badge>
            )}
            {checkResult === 'clear' && (
              <Badge className="bg-green-50 text-green-700 dark:bg-green-900/20 gap-1">
                <CheckCircle className="w-3 h-3" /> Clear
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search DNC list..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={fetchDNC} className="gap-1 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Number
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <Card className="border-primary-200 dark:border-primary-800">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Add to DNC List</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="tel"
                placeholder="Phone number"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Reason"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={newSource}
                onChange={(e) => setNewSource(e.target.value as DNCEntry['source'])}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              >
                <option value="manual">Manual</option>
                <option value="consumer_request">Consumer Request</option>
                <option value="federal_dnc">Federal DNC</option>
                <option value="state_dnc">State DNC</option>
                <option value="litigation">Litigation</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={adding || !newPhone.trim()} className="gap-1 text-xs">
                {adding ? 'Adding...' : 'Add'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} className="text-xs">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Entries</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Consumer Requests</p>
            <p className="text-2xl font-bold text-blue-600">{entries.filter((e) => e.source === 'consumer_request').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Federal DNC</p>
            <p className="text-2xl font-bold text-red-600">{entries.filter((e) => e.source === 'federal_dnc').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Litigation</p>
            <p className="text-2xl font-bold text-purple-600">{entries.filter((e) => e.source === 'litigation').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Phone</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Reason</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Source</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Added</th>
                  <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="py-2.5 px-4">
                        <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500 text-sm">
                      <PhoneOff className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      {entries.length === 0
                        ? 'DNC list is empty. Add numbers or the /api/dnc route may not be deployed yet.'
                        : 'No entries match your search'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 px-4 font-mono text-xs text-gray-900 dark:text-gray-100">
                        {entry.phone_number.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
                      </td>
                      <td className="py-2 px-4 text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{entry.reason || '—'}</td>
                      <td className="py-2 px-4">
                        <Badge className={`text-[10px] ${sourceColors[entry.source] || sourceColors.manual}`}>
                          {entry.source.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-2 px-4 text-xs text-gray-500">{new Date(entry.created_at).toLocaleDateString()}</td>
                      <td className="py-2 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          onClick={() => handleRemove(entry.id)}
                          title="Remove from DNC"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
