/**
 * Report Generation Engine
 * 
 * Core logic for generating reports from various data sources
 * Supports multiple report types and export formats
 * 
 * @module lib/reports/generator
 */

import supabaseAdmin from '@/lib/supabaseAdmin'

export interface ReportFilters {
  date_range?: {
    start: string
    end: string
  }
  statuses?: string[]
  users?: string[]
  campaign_ids?: string[]
  tags?: string[]
}

export interface ReportMetric {
  name: string
  label: string
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max'
}

export interface ReportData {
  summary: Record<string, any>
  details: any[]
  charts?: any[]
}

/**
 * Generate call volume report
 */
export async function generateCallVolumeReport(
  organizationId: string,
  filters: ReportFilters,
  metrics: string[]
): Promise<ReportData> {
  const { date_range, statuses, users } = filters

  // Build query
  let query = supabaseAdmin
    .from('calls')
    .select('id, status, direction, duration, created_at, created_by')
    .eq('organization_id', organizationId)

  if (date_range) {
    query = query
      .gte('created_at', date_range.start)
      .lte('created_at', date_range.end)
  }

  if (statuses && statuses.length > 0) {
    query = query.in('status', statuses)
  }

  if (users && users.length > 0) {
    query = query.in('created_by', users)
  }

  const { data: calls, error } = await query

  if (error) {
    console.error('Error fetching calls for report:', error)
    throw new Error('Failed to generate call volume report')
  }

  // Calculate metrics
  const summary = {
    total_calls: calls?.length || 0,
    successful_calls: calls?.filter((c: any) => c.status === 'completed').length || 0,
    failed_calls: calls?.filter((c: any) => c.status === 'failed').length || 0,
    avg_duration: calls?.reduce((sum: number, c: any) => sum + (c.duration || 0), 0) / (calls?.length || 1),
    total_duration: calls?.reduce((sum: number, c: any) => sum + (c.duration || 0), 0)
  }

  // Group by date
  const callsByDate: Record<string, number> = {}
  calls?.forEach((call: any) => {
    const date = new Date(call.created_at).toISOString().split('T')[0]
    callsByDate[date] = (callsByDate[date] || 0) + 1
  })

  const charts = [
    {
      type: 'line',
      title: 'Calls Over Time',
      data: Object.entries(callsByDate).map(([date, count]) => ({
        date,
        count
      }))
    }
  ]

  return {
    summary,
    details: calls || [],
    charts
  }
}

/**
 * Generate campaign performance report
 */
export async function generateCampaignPerformanceReport(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportData> {
  const { date_range, campaign_ids } = filters

  // Build query
  let query = supabaseAdmin
    .from('campaigns')
    .select(`
      *,
      campaign_calls(id, status, outcome, duration_seconds)
    `)
    .eq('organization_id', organizationId)

  if (date_range) {
    query = query
      .gte('created_at', date_range.start)
      .lte('created_at', date_range.end)
  }

  if (campaign_ids && campaign_ids.length > 0) {
    query = query.in('id', campaign_ids)
  }

  const { data: campaigns, error } = await query

  if (error) {
    console.error('Error fetching campaigns for report:', error)
    throw new Error('Failed to generate campaign performance report')
  }

  // Calculate metrics for each campaign
  const details = campaigns?.map((campaign: any) => {
    const calls = campaign.campaign_calls || []
    const completed = calls.filter((c: any) => c.status === 'completed')
    const successful = calls.filter((c: any) => c.outcome === 'answered')

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: campaign.status,
      total_targets: campaign.total_targets,
      calls_completed: completed.length,
      calls_successful: successful.length,
      success_rate: completed.length > 0 ? (successful.length / completed.length) * 100 : 0,
      avg_duration: completed.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / (completed.length || 1),
      created_at: campaign.created_at
    }
  }) || []

  const summary = {
    total_campaigns: campaigns?.length || 0,
    active_campaigns: campaigns?.filter((c: any) => c.status === 'active').length || 0,
    completed_campaigns: campaigns?.filter((c: any) => c.status === 'completed').length || 0,
    total_calls: details.reduce((sum: number, d: any) => sum + d.calls_completed, 0),
    total_successful: details.reduce((sum: number, d: any) => sum + d.calls_successful, 0),
    avg_success_rate: details.reduce((sum: number, d: any) => sum + d.success_rate, 0) / (details.length || 1)
  }

  return {
    summary,
    details
  }
}

/**
 * Export report data to CSV format
 */
export function exportToCSV(data: ReportData): string {
  const { details } = data

  if (!details || details.length === 0) {
    return ''
  }

  // Get headers from first row
  const headers = Object.keys(details[0])
  const csvRows = [
    headers.join(','),
    ...details.map(row =>
      headers.map(header => {
        const value = (row as any)[header]
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
  ]

  return csvRows.join('\n')
}

/**
 * Export report data to JSON format
 */
export function exportToJSON(data: ReportData): string {
  return JSON.stringify(data, null, 2)
}
