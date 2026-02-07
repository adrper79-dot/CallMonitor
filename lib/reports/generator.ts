/**
 * Report Generation Engine
 *
 * Core logic for generating reports from various data sources
 * Supports multiple report types and export formats
 *
 * @module lib/reports/generator
 */

import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'

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

  // Build query params
  const conditions: string[] = [`organization_id = $1`]
  const params: any[] = [organizationId]
  let paramIdx = 2

  if (date_range) {
    conditions.push(`created_at >= $${paramIdx++}`)
    params.push(date_range.start)
    conditions.push(`created_at <= $${paramIdx++}`)
    params.push(date_range.end)
  }

  if (statuses && statuses.length > 0) {
    conditions.push(`status = ANY($${paramIdx++})`)
    params.push(statuses)
  }

  if (users && users.length > 0) {
    conditions.push(`created_by = ANY($${paramIdx++})`)
    params.push(users)
  }

  const sql = `
    SELECT id, status, direction, duration, created_at, created_by 
    FROM calls 
    WHERE ${conditions.join(' AND ')}
  `

  const { rows: calls } = await query(sql, params)

  // Calculate metrics
  const summary = {
    total_calls: calls.length,
    successful_calls: calls.filter((c: any) => c.status === 'completed').length,
    failed_calls: calls.filter((c: any) => c.status === 'failed').length,
    avg_duration:
      calls.length > 0
        ? Math.round(
            calls.reduce((sum: number, c: any) => sum + (c.duration || 0), 0) / calls.length
          )
        : 0,
    total_duration: calls.reduce((sum: number, c: any) => sum + (c.duration || 0), 0),
  }

  // Group by date
  const callsByDate: Record<string, number> = {}
  calls.forEach((call: any) => {
    const date = new Date(call.created_at).toISOString().split('T')[0]
    callsByDate[date] = (callsByDate[date] || 0) + 1
  })

  const charts = [
    {
      type: 'line',
      title: 'Calls Over Time',
      data: Object.entries(callsByDate).map(([date, count]) => ({
        date,
        count,
      })),
    },
  ]

  return {
    summary,
    details: calls || [],
    charts,
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
  const conditions: string[] = [`c.organization_id = $1`]
  const params: any[] = [organizationId]
  let paramIdx = 2

  if (date_range) {
    conditions.push(`c.created_at >= $${paramIdx++}`)
    params.push(date_range.start)
    conditions.push(`c.created_at <= $${paramIdx++}`)
    params.push(date_range.end)
  }

  if (campaign_ids && campaign_ids.length > 0) {
    conditions.push(`c.id = ANY($${paramIdx++})`)
    params.push(campaign_ids)
  }

  // Fetch campaigns with calls using json_agg
  // Assuming 'calls' table has 'campaign_id'
  const sql = `
    SELECT 
      c.*,
      (
        SELECT json_agg(json_build_object(
          'id', cc.id,
          'status', cc.status,
          'outcome', cc.outcome,
          'duration_seconds', cc.duration
        ))
        FROM calls cc
        WHERE cc.campaign_id = c.id
      ) as campaign_calls
    FROM campaigns c
    WHERE ${conditions.join(' AND ')}
  `

  try {
    const { rows: campaigns } = await query(sql, params)

    // Calculate metrics for each campaign
    const details = campaigns.map((campaign: any) => {
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
        avg_duration:
          completed.length > 0
            ? completed.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) /
              completed.length
            : 0,
        created_at: campaign.created_at,
      }
    })

    const summary = {
      total_campaigns: campaigns.length,
      active_campaigns: campaigns.filter((c: any) => c.status === 'active').length,
      completed_campaigns: campaigns.filter((c: any) => c.status === 'completed').length,
      total_calls: details.reduce((sum: number, d: any) => sum + d.calls_completed, 0),
      total_successful: details.reduce((sum: number, d: any) => sum + d.calls_successful, 0),
      avg_success_rate:
        details.length > 0
          ? details.reduce((sum: number, d: any) => sum + d.success_rate, 0) / details.length
          : 0,
    }

    return {
      summary,
      details,
    }
  } catch (error) {
    logger.error('Error fetching campaigns for report', error, {
      organizationId,
      dateRange: date_range,
      campaignIds: campaign_ids,
    })
    throw new Error('Failed to generate campaign performance report')
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
    ...details.map((row) =>
      headers
        .map((header) => {
          const value = (row as any)[header]
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(',')
    ),
  ]

  return csvRows.join('\n')
}

/**
 * Export report data to JSON format
 */
export function exportToJSON(data: ReportData): string {
  return JSON.stringify(data, null, 2)
}
