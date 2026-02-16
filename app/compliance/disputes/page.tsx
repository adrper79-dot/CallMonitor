'use client'

/**
 * /compliance/disputes — Enhanced Dispute Management Portal
 *
 * Self-service dispute workflow with validation letter generation.
 * FDCPA requires 30-day validation period after dispute received.
 * Phase 2: Compliance portals with self-service dispute flows.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPatch } from '@/lib/apiClient'
import { useRBAC } from '@/hooks/useRBAC'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Scale, Search, RefreshCw, Clock, CheckCircle,
  AlertTriangle, FileText, ChevronRight, Download,
  Send, Eye, MessageSquare, Calendar, User,
  Shield, AlertCircle, FileCheck
} from 'lucide-react'
import Link from 'next/link'

interface Dispute {
  id: string
  account_id: string
  account_name: string
  type: string
  status: 'open' | 'investigating' | 'resolved' | 'escalated'
  description: string
  filed_at: string
  deadline: string
  days_remaining: number
  user_email?: string
  user_name?: string
  resolution_status?: string
  resolution_notes?: string
  resolved_at?: string
  resolved_by?: string
  restriction_code?: string
  violation_type?: string
  violation_context?: any
}

interface ValidationLetter {
  id: string
  dispute_id: string
  letter_type: 'initial' | 'followup' | 'final'
  content: string
  generated_at: string
  sent_at?: string
  status: 'draft' | 'sent' | 'delivered'
}

const statusColors: Record<string, string> = {
  open: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  investigating: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  resolved: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  escalated: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
}

export default function DisputesPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const { role } = useRBAC(organizationId)
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [validationLetter, setValidationLetter] = useState('')
  const [letterType, setLetterType] = useState<'initial' | 'followup' | 'final'>('initial')
  const [showLetterDialog, setShowLetterDialog] = useState(false)

  // Fetch organization ID for RBAC
  useEffect(() => {
    async function fetchOrg() {
      try {
        const data = await apiGet<{ organization?: { id: string } }>('/api/organizations/current')
        setOrganizationId(data.organization?.id || null)
      } catch (err) {
        logger.error('Failed to fetch organization', err)
      }
    }
    fetchOrg()
  }, [])

  const fetchDisputes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/compliance/disputes?limit=100')
      const data = res.data || res.disputes || []
      setDisputes(
        data.map((d: any) => {
          const deadline = new Date(d.deadline || d.filed_at)
          if (!d.deadline) deadline.setDate(deadline.getDate() + 30) // FDCPA 30-day window
          const daysRemaining = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          return {
            id: d.id,
            account_id: d.account_id,
            account_name: d.account_name || 'Unknown',
            type: d.type || d.dispute_type || d.violation_type || 'General',
            status: d.status || d.resolution_status || 'open',
            description: d.description || d.reason || d.violation_context?.reason || '',
            filed_at: d.filed_at || d.created_at,
            deadline: deadline.toISOString(),
            days_remaining: daysRemaining,
            user_email: d.user_email,
            user_name: d.user_name,
            resolution_status: d.resolution_status,
            resolution_notes: d.resolution_notes,
            resolved_at: d.resolved_at,
            resolved_by: d.resolved_by,
            restriction_code: d.restriction_code,
            violation_type: d.violation_type,
            violation_context: d.violation_context,
          }
        })
      )
    } catch (err: any) {
      logger.warn('Disputes endpoint not available', { error: err?.message })
      setDisputes([])
    } finally {
      setLoading(false)
    }
  }, [])

  const generateValidationLetter = useCallback(async (dispute: Dispute, type: 'initial' | 'followup' | 'final') => {
    // TODO: Implement validation letter generation
    // For now, show a placeholder
    setValidationLetter(`[VALIDATION LETTER - ${type.toUpperCase()}]\n\nDear Consumer,\n\nThis letter serves as validation of your dispute regarding account ${dispute.account_name}.\n\nUnder the Fair Debt Collection Practices Act (FDCPA), we are required to validate all information within 30 days of your dispute.\n\n[Account details and validation information would be included here]\n\nIf you have any questions, please contact us.\n\nSincerely,\nCompliance Team`)
    setLetterType(type)
    setShowValidationDialog(true)
  }, [])

  const updateDisputeStatus = useCallback(async (disputeId: string, status: string, notes?: string) => {
    // TODO: Implement dispute status update
    // For now, just refresh the list
    await fetchDisputes()
  }, [fetchDisputes])

  const downloadValidationLetter = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  useEffect(() => { fetchDisputes() }, [fetchDisputes])

  const filtered = filter === 'all'
    ? disputes.filter(d =>
        searchTerm === '' ||
        d.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : disputes.filter(d =>
        d.status === filter &&
        (searchTerm === '' ||
         d.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         d.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )

  const urgentCount = disputes.filter((d) => d.days_remaining <= 5 && d.status !== 'resolved').length

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Scale className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dispute Management</h1>
              <p className="text-sm text-gray-500">FDCPA-compliant dispute resolution workflow</p>
            </div>
          </div>
          {urgentCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600 font-medium">
                {urgentCount} dispute{urgentCount !== 1 ? 's' : ''} require{urgentCount === 1 ? 's' : ''} immediate attention
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDisputes} className="gap-1.5">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Enhanced Stats Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Total Disputes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{disputes.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-sm text-gray-500">Open</p>
              <p className="text-2xl font-bold text-red-600">{disputes.filter((d) => d.status === 'open').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-sm text-gray-500">Investigating</p>
              <p className="text-2xl font-bold text-amber-600">{disputes.filter((d) => d.status === 'investigating').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Resolved</p>
              <p className="text-2xl font-bold text-green-600">{disputes.filter((d) => d.status === 'resolved').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Urgent (≤5 days)</p>
              <p className="text-2xl font-bold text-purple-600">{urgentCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Enhanced Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search disputes by account name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          {['all', 'open', 'investigating', 'resolved', 'escalated'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f === 'all' ? 'All' : f}
            </Button>
          ))}
        </div>
      </div>

      {/* Enhanced Dispute List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <Scale className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {disputes.length === 0 ? 'No disputes on file' : 'No disputes match your criteria'}
            </h3>
            <p className="text-sm text-gray-500">
              {disputes.length === 0
                ? 'Consumer disputes will appear here when filed'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
          </Card>
        ) : (
          filtered.map((d) => (
            <Card
              key={d.id}
              className={`transition-all hover:shadow-md ${
                d.days_remaining <= 5 && d.status !== 'resolved'
                  ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                  : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        d.status === 'resolved' ? 'bg-green-100 dark:bg-green-900/20' :
                        d.status === 'investigating' ? 'bg-amber-100 dark:bg-amber-900/20' :
                        d.status === 'escalated' ? 'bg-purple-100 dark:bg-purple-900/20' :
                        'bg-red-100 dark:bg-red-900/20'
                      }`}>
                        {d.status === 'resolved' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                         d.status === 'investigating' ? <Clock className="w-5 h-5 text-amber-600" /> :
                         d.status === 'escalated' ? <AlertTriangle className="w-5 h-5 text-purple-600" /> :
                         <FileText className="w-5 h-5 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/accounts/${d.account_id}`}
                            prefetch={false}
                            className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-600 truncate"
                          >
                            {d.account_name}
                          </Link>
                          <Badge variant="secondary" className="text-xs">{d.type}</Badge>
                          <Badge
                            className={`text-xs ${
                              d.status === 'resolved' ? 'bg-green-100 text-green-700' :
                              d.status === 'investigating' ? 'bg-amber-100 text-amber-700' :
                              d.status === 'escalated' ? 'bg-purple-100 text-purple-700' :
                              'bg-red-100 text-red-700'
                            }`}
                          >
                            {d.status}
                          </Badge>
                          {d.days_remaining <= 5 && d.status !== 'resolved' && (
                            <Badge className="text-xs bg-red-100 text-red-700">
                              {d.days_remaining > 0 ? `${d.days_remaining}d left` : 'Overdue'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Filed {new Date(d.filed_at).toLocaleDateString()} •
                          {d.user_name && ` by ${d.user_name}`}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                      {d.description}
                    </p>

                    {/* Additional Context */}
                    {d.violation_context && (
                      <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <strong>Context:</strong> {typeof d.violation_context === 'string'
                            ? d.violation_context
                            : JSON.stringify(d.violation_context, null, 2)
                          }
                        </p>
                      </div>
                    )}

                    {/* Resolution Notes */}
                    {d.resolution_notes && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          <strong>Resolution:</strong> {d.resolution_notes}
                        </p>
                        {d.resolved_at && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            Resolved {new Date(d.resolved_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {role === 'manager' || role === 'admin' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDispute(d)}
                          className="gap-1.5"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Button>

                        {d.status !== 'resolved' && (
                          <Dialog open={showLetterDialog} onOpenChange={setShowLetterDialog}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => {
                                  setSelectedDispute(d)
                                  setShowLetterDialog(true)
                                }}
                              >
                                <FileCheck className="w-3 h-3" />
                                Generate Letter
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Generate Validation Letter</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium">Letter Type</label>
                                  <Select
                                    value={letterType}
                                    onValueChange={(value) => setLetterType(value as 'initial' | 'followup' | 'final')}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="initial">Initial Validation Letter</SelectItem>
                                      <SelectItem value="followup">Follow-up Letter</SelectItem>
                                      <SelectItem value="final">Final Resolution Letter</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => generateValidationLetter(d, letterType)}
                                    className="flex-1"
                                  >
                                    Generate {letterType.charAt(0).toUpperCase() + letterType.slice(1)} Letter
                                  </Button>
                                  {validationLetter && (
                                    <Button
                                      variant="outline"
                                      onClick={() => downloadValidationLetter(
                                        validationLetter,
                                        `validation-letter-${d.account_name}-${letterType}.txt`
                                      )}
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                                {validationLetter && (
                                  <textarea
                                    value={validationLetter}
                                    readOnly
                                    className="w-full min-h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 font-mono text-xs resize-none"
                                    rows={16}
                                  />
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        {d.status === 'open' && (
                          <Button
                            size="sm"
                            onClick={() => updateDisputeStatus(d.id, 'investigating')}
                            className="gap-1.5"
                          >
                            <Clock className="w-3 h-3" />
                            Start Investigation
                          </Button>
                        )}

                        {d.status === 'investigating' && (
                          <Button
                            size="sm"
                            onClick={() => updateDisputeStatus(d.id, 'resolved', 'Dispute validated and resolved')}
                            className="gap-1.5 bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Mark Resolved
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedDispute(d)}
                        className="gap-1.5"
                      >
                        <Eye className="w-3 h-3" />
                        View Details
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Compliance Footer */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              FDCPA Compliance Reminder
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              All disputes must be investigated within 30 days of receipt. Validation letters must include
              all account information, payment history, and supporting documentation. Consult legal counsel
              for complex disputes involving potential violations.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
