/**
 * Reports Page
 * 
 * Report generation and management UI
 * Features: Generate reports, view history, export
 * RBAC: All can view, Owner/Admin can generate
 */

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { Loader2, FileText, Download, Plus } from 'lucide-react'
import { logger } from '@/lib/logger'

interface GeneratedReport {
  id: string
  name: string
  file_format: string
  file_size_bytes: number
  status: 'generating' | 'completed' | 'failed'
  generated_at: string
  generation_duration_ms: number
}

export default function ReportsPage() {
  const { data: session } = useSession()
  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const userId = (session?.user as any)?.id

  useEffect(() => {
    if (userId) {
      fetchOrganization()
    }
  }, [userId])

  useEffect(() => {
    if (organizationId) {
      fetchReports()
    }
  }, [organizationId])

  const fetchOrganization = async () => {
    try {
      const res = await fetch(`/api/users/${userId}/organization`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch organization')
      const data = await res.json()
      setOrganizationId(data.organization_id)
    } catch (err) {
      logger.error('Error fetching organization', err, { userId })
      setError('Failed to load organization')
    }
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/reports`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch reports')
      const data = await res.json()
      setReports(data.reports || [])
    } catch (err) {
      logger.error('Error fetching reports', err)
      setError('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    try {
      setGenerating(true)
      setError(null)

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Call Volume Report - ${new Date().toLocaleDateString()}`,
          report_type: 'call_volume',
          filters: {
            date_range: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString()
            }
          },
          metrics: ['total_calls', 'successful_calls', 'avg_duration'],
          file_format: 'json'
        }),
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to generate report')

      await fetchReports()
    } catch (err) {
      logger.error('Error generating report', err)
      setError('Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = (reportId: string, format: string) => {
    window.open(`/api/reports/${reportId}/export?format=${format}`, '_blank')
  }

  const getStatusBadge = (status: GeneratedReport['status']) => {
    const variants = {
      generating: { label: 'Generating', variant: 'default' as const },
      completed: { label: 'Completed', variant: 'success' as const },
      failed: { label: 'Failed', variant: 'error' as const },
    }
    const config = variants[status]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (!session || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-500">Please sign in to access reports.</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell organizationName={undefined} userEmail={session?.user?.email || undefined}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Report Builder</h1>
            <p className="text-sm text-gray-500 mt-1">
              Generate custom reports and analytics
            </p>
          </div>
          <Button onClick={handleGenerateReport} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Reports</CardTitle>
            <CardDescription>
              View and download your generated reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-sm font-medium">No reports yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate your first report to get started
                </p>
                <Button onClick={handleGenerateReport} disabled={generating} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="uppercase">
                            {report.file_format}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
                        <TableCell>{formatDate(report.generated_at)}</TableCell>
                        <TableCell>
                          {report.generation_duration_ms ? 
                            `${(report.generation_duration_ms / 1000).toFixed(2)}s` : 
                            '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {report.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(report.id, report.file_format)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
