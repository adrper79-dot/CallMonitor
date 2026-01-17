# Analytics Dashboard Implementation Plan

**Feature:** Analytics Dashboard  
**Current Status:** 60% Complete  
**Target:** 100% Complete  
**Estimated Time:** 3-4 days (24-32 hours)  
**Priority:** High (UX Gap)  
**Date:** January 16, 2026

---

## 📊 Executive Summary

### Current State (60%)
- **Backend:** 80% ⚠️
  - ✅ Survey analytics API (`/api/analytics/surveys`)
  - ✅ Call data available (`/api/calls`)
  - ⚠️ Missing: Dedicated analytics aggregation endpoints
  - ❌ Missing: Time-series data endpoints
  - ❌ Missing: Sentiment trends API
  - ❌ Missing: Performance metrics API

- **Frontend:** 40% ⚠️
  - ✅ `SurveyAnalyticsWidget` component (in dashboard)
  - ✅ `CallAnalytics` component (per-call insights)
  - ✅ Tableau design system components (MetricCard, DataTable, ProgressBar)
  - ❌ Missing: Dedicated `/analytics` page
  - ❌ Missing: Charts/visualizations
  - ❌ Missing: Time range selectors
  - ❌ Missing: Export functionality

### Target State (100%)
- **Backend:** 100%
  - ✅ All aggregation endpoints
  - ✅ Time-series data with date ranges
  - ✅ Caching for performance
  - ✅ Export APIs (CSV, JSON)

- **Frontend:** 100%
  - ✅ Full `/analytics` page with tabbed layout
  - ✅ Interactive charts (Chart.js or Recharts)
  - ✅ Real-time metrics
  - ✅ Date range filtering
  - ✅ Export buttons

---

## 🎯 Architecture Review

### Existing Assets

#### Backend APIs
1. **`/api/analytics/surveys` (EXISTS)** ✅
   - Returns: total_surveys, avg_score, response_rate, score_distribution, trend_7d
   - Status: Complete
   - Used by: `SurveyAnalyticsWidget`

2. **`/api/calls` (EXISTS)** ✅
   - Returns: calls array with full details
   - Supports: orgId filter, limit, pagination
   - Status: Complete
   - Missing: Aggregation (needs processing on frontend)

#### Frontend Components
1. **`components/tableau/MetricCard.tsx`** ✅
   - Large number display with optional trend
   - Colors: Success (green), Error (red), Neutral (gray)
   - Usage: Dashboard metrics

2. **`components/tableau/DataTable.tsx`** ✅
   - Clean table with Tableau styling
   - Supports: sorting, row click, selection
   - Usage: Data lists

3. **`components/tableau/ProgressBar.tsx`** ✅
   - Horizontal bar with percentage
   - Colors: green, red, blue, gray
   - Usage: Sentiment breakdowns

4. **`components/dashboard/SurveyAnalyticsWidget.tsx`** ✅
   - Fetches `/api/analytics/surveys`
   - Displays 3 metrics + 7-day trend
   - Status: Complete

5. **`components/voice/CallAnalytics.tsx`** ✅
   - Per-call insights (sentiment, entities, chapters, timeline)
   - Tableau-style widgets
   - Status: Complete (call-level only)

#### Design System
- **Professional Design System v3.0**
- Navy primary (#1E3A5F)
- Semantic colors (Success #059669, Error #DC2626, Warning #D97706)
- No emojis in professional UI
- Clean, data-first layouts
- Generous white space

### Missing Components

#### Backend APIs (20% gap)
1. **`/api/analytics/calls`** - Aggregate call metrics ❌
2. **`/api/analytics/sentiment-trends`** - Time-series sentiment ❌
3. **`/api/analytics/performance`** - System performance metrics ❌
4. **`/api/analytics/export`** - Export to CSV/JSON ❌

#### Frontend (60% gap)
1. **`app/analytics/page.tsx`** - Main analytics page ❌
2. **`components/analytics/CallVolumeChart.tsx`** - Call volume over time ❌
3. **`components/analytics/SentimentChart.tsx`** - Sentiment trends ❌
4. **`components/analytics/DurationChart.tsx`** - Call duration distribution ❌
5. **`components/analytics/PerformanceMetrics.tsx`** - System health ❌
6. **`components/analytics/DateRangePicker.tsx`** - Date filtering ❌
7. **`components/analytics/ExportButton.tsx`** - Data export ❌

---

## 📋 Implementation Plan

### Phase 1: Backend Endpoints (8 hours)

#### Task 1.1: Create Call Analytics API (3 hours)
**File:** `app/api/analytics/calls/route.ts`

**Endpoint:** `GET /api/analytics/calls`

**Query Parameters:**
- `startDate` (ISO string, default: 30 days ago)
- `endDate` (ISO string, default: now)
- `groupBy` (day|week|month, default: day)

**Returns:**
```typescript
{
  success: true,
  metrics: {
    total_calls: number,
    completed_calls: number,
    failed_calls: number,
    avg_duration_seconds: number,
    total_duration_minutes: number,
    completion_rate: number, // % successful
    time_series: Array<{
      date: string, // ISO date
      total: number,
      completed: number,
      failed: number,
      avg_duration: number
    }>
  }
}
```

**Implementation:**
```typescript
import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole, success, Errors } from '@/lib/api/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const ctx = await requireRole(['owner', 'admin', 'analyst'])
    if (ctx instanceof NextResponse) return ctx

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') || 
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()
    const groupBy = searchParams.get('groupBy') || 'day'

    // Query calls with filters
    const { data: calls, error } = await supabaseAdmin
      .from('calls')
      .select('id, status, created_at, duration_seconds')
      .eq('organization_id', ctx.orgId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Aggregate metrics
    const metrics = computeCallMetrics(calls || [], groupBy)
    
    return success({ metrics })
  } catch (err: any) {
    return Errors.internal(err)
  }
}

function computeCallMetrics(calls: any[], groupBy: string) {
  const total_calls = calls.length
  const completed_calls = calls.filter(c => c.status === 'completed').length
  const failed_calls = calls.filter(c => c.status === 'failed' || c.status === 'no-answer').length
  
  const durationsSeconds = calls
    .filter(c => c.duration_seconds)
    .map(c => c.duration_seconds)
  
  const avg_duration_seconds = durationsSeconds.length > 0
    ? Math.round(durationsSeconds.reduce((a, b) => a + b, 0) / durationsSeconds.length)
    : 0
  
  const total_duration_minutes = Math.round(
    durationsSeconds.reduce((a, b) => a + b, 0) / 60
  )
  
  const completion_rate = total_calls > 0
    ? Math.round((completed_calls / total_calls) * 100)
    : 0

  // Time series grouping
  const grouped: Record<string, any[]> = {}
  calls.forEach(call => {
    const key = getGroupKey(call.created_at, groupBy)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(call)
  })

  const time_series = Object.entries(grouped)
    .map(([date, calls]) => ({
      date,
      total: calls.length,
      completed: calls.filter(c => c.status === 'completed').length,
      failed: calls.filter(c => c.status === 'failed' || c.status === 'no-answer').length,
      avg_duration: calls.filter(c => c.duration_seconds).length > 0
        ? Math.round(
            calls
              .filter(c => c.duration_seconds)
              .reduce((sum, c) => sum + c.duration_seconds, 0) /
            calls.filter(c => c.duration_seconds).length
          )
        : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    total_calls,
    completed_calls,
    failed_calls,
    avg_duration_seconds,
    total_duration_minutes,
    completion_rate,
    time_series
  }
}

function getGroupKey(timestamp: string, groupBy: string): string {
  const date = new Date(timestamp)
  if (groupBy === 'day') {
    return date.toISOString().slice(0, 10) // YYYY-MM-DD
  } else if (groupBy === 'week') {
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    return weekStart.toISOString().slice(0, 10)
  } else if (groupBy === 'month') {
    return date.toISOString().slice(0, 7) // YYYY-MM
  }
  return date.toISOString().slice(0, 10)
}
```

**Validation Criteria:**
- ✅ Returns metrics for organization
- ✅ Respects date range filters
- ✅ Groups data by day/week/month
- ✅ RBAC enforced (owner/admin/analyst)
- ✅ Handles empty data gracefully

---

#### Task 1.2: Create Sentiment Trends API (2 hours)
**File:** `app/api/analytics/sentiment-trends/route.ts`

**Endpoint:** `GET /api/analytics/sentiment-trends`

**Query Parameters:**
- `startDate` (ISO string, default: 30 days ago)
- `endDate` (ISO string, default: now)

**Returns:**
```typescript
{
  success: true,
  trends: {
    overall_positive_rate: number, // % positive
    overall_negative_rate: number,
    overall_neutral_rate: number,
    time_series: Array<{
      date: string,
      positive_rate: number,
      negative_rate: number,
      neutral_rate: number,
      sample_size: number
    }>
  }
}
```

**Implementation:**
```typescript
// Similar to calls API but joins with recordings table
// Filters for calls with sentiment_summary data
// Aggregates positive/negative/neutral percentages over time
```

**Validation Criteria:**
- ✅ Returns sentiment distribution
- ✅ Time-series data for charting
- ✅ Handles missing sentiment data
- ✅ RBAC enforced

---

#### Task 1.3: Create Performance Metrics API (2 hours)
**File:** `app/api/analytics/performance/route.ts`

**Endpoint:** `GET /api/analytics/performance`

**Returns:**
```typescript
{
  success: true,
  metrics: {
    transcription_rate: number, // % of calls transcribed
    translation_rate: number, // % of calls translated
    avg_transcription_time_seconds: number,
    avg_recording_quality: number, // 0-100
    feature_usage: {
      voice_cloning: number, // count
      surveys: number,
      scorecards: number,
      webhooks_sent: number
    }
  }
}
```

**Validation Criteria:**
- ✅ Accurate feature usage counts
- ✅ Performance timing data
- ✅ RBAC enforced

---

#### Task 1.4: Create Export API (1 hour)
**File:** `app/api/analytics/export/route.ts`

**Endpoint:** `GET /api/analytics/export`

**Query Parameters:**
- `type` (calls|surveys|sentiment)
- `format` (csv|json)
- `startDate`, `endDate`

**Returns:**
- CSV file download or JSON response

**Validation Criteria:**
- ✅ Generates CSV with proper headers
- ✅ Supports JSON format
- ✅ Respects date filters
- ✅ RBAC enforced

---

### Phase 2: Chart Components (8 hours)

#### Task 2.1: Install Chart Library (0.5 hours)
**Decision:** Use **Recharts** (React-friendly, TypeScript support, responsive)

```bash
npm install recharts
```

**Alternative:** Chart.js (more features but heavier)

---

#### Task 2.2: Create CallVolumeChart Component (2 hours)
**File:** `components/analytics/CallVolumeChart.tsx`

**Component:**
```typescript
'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CallVolumeChartProps {
  data: Array<{
    date: string
    total: number
    completed: number
    failed: number
  }>
}

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Volume</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#FFF', 
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Line 
            type="monotone" 
            dataKey="total" 
            stroke="#1E3A5F" 
            strokeWidth={2}
            name="Total Calls"
            dot={{ fill: '#1E3A5F', r: 3 }}
          />
          <Line 
            type="monotone" 
            dataKey="completed" 
            stroke="#059669" 
            strokeWidth={2}
            name="Completed"
            dot={{ fill: '#059669', r: 3 }}
          />
          <Line 
            type="monotone" 
            dataKey="failed" 
            stroke="#DC2626" 
            strokeWidth={2}
            name="Failed"
            dot={{ fill: '#DC2626', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**Validation:**
- ✅ Displays 3 lines (total, completed, failed)
- ✅ Responsive design
- ✅ Tooltip shows details
- ✅ Professional color scheme

---

#### Task 2.3: Create SentimentChart Component (2 hours)
**File:** `components/analytics/SentimentChart.tsx`

**Component:**
```typescript
'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface SentimentChartProps {
  data: Array<{
    date: string
    positive_rate: number
    neutral_rate: number
    negative_rate: number
  }>
}

export function SentimentChart({ data }: SentimentChartProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#FFF', 
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              fontSize: '12px'
            }}
            formatter={(value: number) => `${value.toFixed(1)}%`}
          />
          <Area 
            type="monotone" 
            dataKey="positive_rate" 
            stackId="1"
            stroke="#059669" 
            fill="#D1FAE5"
            name="Positive"
          />
          <Area 
            type="monotone" 
            dataKey="neutral_rate" 
            stackId="1"
            stroke="#2563EB" 
            fill="#DBEAFE"
            name="Neutral"
          />
          <Area 
            type="monotone" 
            dataKey="negative_rate" 
            stackId="1"
            stroke="#DC2626" 
            fill="#FEE2E2"
            name="Negative"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

---

#### Task 2.4: Create DurationChart Component (2 hours)
**File:** `components/analytics/DurationChart.tsx`

**Component:** Bar chart showing call duration distribution (0-1min, 1-5min, 5-10min, 10-20min, 20+min)

---

#### Task 2.5: Create PerformanceMetrics Component (1.5 hours)
**File:** `components/analytics/PerformanceMetrics.tsx`

**Component:**
```typescript
'use client'

import { MetricCard } from '@/components/tableau/MetricCard'
import { ProgressBar } from '@/components/tableau/ProgressBar'

interface PerformanceMetricsProps {
  metrics: {
    transcription_rate: number
    translation_rate: number
    avg_transcription_time_seconds: number
    feature_usage: {
      voice_cloning: number
      surveys: number
      scorecards: number
      webhooks_sent: number
    }
  }
}

export function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          label="Transcription Rate"
          value={`${metrics.transcription_rate}%`}
          trend={metrics.transcription_rate >= 90 ? 'up' : 'neutral'}
        />
        <MetricCard 
          label="Translation Rate"
          value={`${metrics.translation_rate}%`}
        />
        <MetricCard 
          label="Avg Transcription Time"
          value={`${Math.round(metrics.avg_transcription_time_seconds)}s`}
        />
        <MetricCard 
          label="Webhooks Sent"
          value={metrics.feature_usage.webhooks_sent}
        />
      </div>

      {/* Feature Usage */}
      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Usage</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Voice Cloning</span>
              <span className="text-gray-900 font-medium">{metrics.feature_usage.voice_cloning}</span>
            </div>
            <ProgressBar 
              label="" 
              value={metrics.feature_usage.voice_cloning} 
              color="blue"
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Surveys</span>
              <span className="text-gray-900 font-medium">{metrics.feature_usage.surveys}</span>
            </div>
            <ProgressBar 
              label="" 
              value={metrics.feature_usage.surveys} 
              color="green"
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Scorecards</span>
              <span className="text-gray-900 font-medium">{metrics.feature_usage.scorecards}</span>
            </div>
            <ProgressBar 
              label="" 
              value={metrics.feature_usage.scorecards} 
              color="amber"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

### Phase 3: Analytics Page (6 hours)

#### Task 3.1: Create DateRangePicker Component (2 hours)
**File:** `components/analytics/DateRangePicker.tsx`

**Component:**
```typescript
'use client'

import { useState } from 'react'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [localStart, setLocalStart] = useState(startDate)
  const [localEnd, setLocalEnd] = useState(endDate)

  const presets = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'Last 365 days', days: 365 }
  ]

  const applyPreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    onChange(start.toISOString(), end.toISOString())
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Date inputs */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input 
            type="date"
            value={localStart.slice(0, 10)}
            onChange={(e) => setLocalStart(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input 
            type="date"
            value={localEnd.slice(0, 10)}
            onChange={(e) => setLocalEnd(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <button
          onClick={() => onChange(localStart, localEnd)}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark"
        >
          Apply
        </button>
      </div>

      {/* Quick presets */}
      <div className="flex gap-2 mt-3">
        {presets.map(preset => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset.days)}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

---

#### Task 3.2: Create ExportButton Component (1 hour)
**File:** `components/analytics/ExportButton.tsx`

**Component:**
```typescript
'use client'

import { useState } from 'react'

interface ExportButtonProps {
  type: 'calls' | 'surveys' | 'sentiment'
  startDate: string
  endDate: string
}

export function ExportButton({ type, startDate, endDate }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async (format: 'csv' | 'json') => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/analytics/export?type=${type}&format=${format}&startDate=${startDate}&endDate=${endDate}`
      )
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-export-${new Date().toISOString().slice(0, 10)}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport('csv')}
        disabled={loading}
        className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? 'Exporting...' : 'Export CSV'}
      </button>
      <button
        onClick={() => handleExport('json')}
        disabled={loading}
        className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? 'Exporting...' : 'Export JSON'}
      </button>
    </div>
  )
}
```

---

#### Task 3.3: Create Analytics Page (3 hours)
**File:** `app/analytics/page.tsx`

**Page Structure:**
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from 'next-auth/react'
import { DateRangePicker } from '@/components/analytics/DateRangePicker'
import { ExportButton } from '@/components/analytics/ExportButton'
import { CallVolumeChart } from '@/components/analytics/CallVolumeChart'
import { SentimentChart } from '@/components/analytics/SentimentChart'
import { DurationChart } from '@/components/analytics/DurationChart'
import { PerformanceMetrics } from '@/components/analytics/PerformanceMetrics'
import { MetricCard } from '@/components/tableau/MetricCard'
import { SurveyAnalyticsWidget } from '@/components/dashboard/SurveyAnalyticsWidget'

export default function AnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'sentiment' | 'performance' | 'surveys'>('overview')
  
  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString()
  })
  const [endDate, setEndDate] = useState(new Date().toISOString())

  // Data state
  const [callMetrics, setCallMetrics] = useState<any>(null)
  const [sentimentTrends, setSentimentTrends] = useState<any>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null)

  // Authentication check
  useEffect(() => {
    async function checkAuth() {
      const session = await getSession()
      if (!session) {
        router.push('/api/auth/signin')
        return
      }
      
      // Get organization
      const response = await fetch('/api/organizations/current')
      const data = await response.json()
      setOrganizationId(data.organization?.id || null)
      setLoading(false)
    }
    checkAuth()
  }, [router])

  // Fetch analytics data
  useEffect(() => {
    if (!organizationId) return

    async function fetchData() {
      setLoading(true)
      try {
        const [callsRes, sentimentRes, perfRes] = await Promise.all([
          fetch(`/api/analytics/calls?startDate=${startDate}&endDate=${endDate}`),
          fetch(`/api/analytics/sentiment-trends?startDate=${startDate}&endDate=${endDate}`),
          fetch(`/api/analytics/performance`)
        ])

        const [callsData, sentimentData, perfData] = await Promise.all([
          callsRes.json(),
          sentimentRes.json(),
          perfRes.json()
        ])

        setCallMetrics(callsData.metrics)
        setSentimentTrends(sentimentData.trends)
        setPerformanceMetrics(perfData.metrics)
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, startDate, endDate])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Insights and performance metrics</p>
      </div>

      {/* Date Range Picker */}
      <div className="mb-6">
        <DateRangePicker 
          startDate={startDate}
          endDate={endDate}
          onChange={(start, end) => {
            setStartDate(start)
            setEndDate(end)
          }}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {['overview', 'calls', 'sentiment', 'performance', 'surveys'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && callMetrics && (
        <div className="space-y-6">
          {/* Top Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard 
              label="Total Calls"
              value={callMetrics.total_calls}
              change={`${callMetrics.completed_calls} completed`}
              trend="up"
            />
            <MetricCard 
              label="Completion Rate"
              value={`${callMetrics.completion_rate}%`}
              trend={callMetrics.completion_rate >= 80 ? 'up' : 'down'}
            />
            <MetricCard 
              label="Avg Duration"
              value={`${Math.floor(callMetrics.avg_duration_seconds / 60)}m ${callMetrics.avg_duration_seconds % 60}s`}
            />
            <MetricCard 
              label="Total Minutes"
              value={callMetrics.total_duration_minutes}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CallVolumeChart data={callMetrics.time_series} />
            {sentimentTrends && (
              <SentimentChart data={sentimentTrends.time_series} />
            )}
          </div>
        </div>
      )}

      {activeTab === 'calls' && callMetrics && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Call Analytics</h2>
            <ExportButton type="calls" startDate={startDate} endDate={endDate} />
          </div>
          <CallVolumeChart data={callMetrics.time_series} />
          <DurationChart data={callMetrics.time_series} />
        </div>
      )}

      {activeTab === 'sentiment' && sentimentTrends && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Sentiment Analysis</h2>
            <ExportButton type="sentiment" startDate={startDate} endDate={endDate} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <MetricCard 
              label="Positive Rate"
              value={`${sentimentTrends.overall_positive_rate}%`}
              trend="up"
            />
            <MetricCard 
              label="Neutral Rate"
              value={`${sentimentTrends.overall_neutral_rate}%`}
            />
            <MetricCard 
              label="Negative Rate"
              value={`${sentimentTrends.overall_negative_rate}%`}
              trend={sentimentTrends.overall_negative_rate < 20 ? 'up' : 'down'}
            />
          </div>
          <SentimentChart data={sentimentTrends.time_series} />
        </div>
      )}

      {activeTab === 'performance' && performanceMetrics && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Performance Metrics</h2>
          <PerformanceMetrics metrics={performanceMetrics} />
        </div>
      )}

      {activeTab === 'surveys' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Survey Analytics</h2>
            <ExportButton type="surveys" startDate={startDate} endDate={endDate} />
          </div>
          <SurveyAnalyticsWidget organizationId={organizationId} />
        </div>
      )}
    </div>
  )
}
```

---

### Phase 4: Integration & Testing (2-4 hours)

#### Task 4.1: Add Navigation Link (0.5 hours)
**File:** `components/layout/Navigation.tsx` (or equivalent)

Add "Analytics" to main navigation:
```tsx
<Link href="/analytics" className="...">
  Analytics
</Link>
```

---

#### Task 4.2: Testing Checklist (1.5 hours)
- [ ] All API endpoints return correct data
- [ ] Date range filtering works
- [ ] Charts render correctly
- [ ] Export buttons work (CSV + JSON)
- [ ] Tabs switch correctly
- [ ] RBAC enforced (owner/admin/analyst only)
- [ ] Loading states display
- [ ] Empty states handle no data
- [ ] Mobile responsive design
- [ ] TypeScript compilation (0 errors)

---

#### Task 4.3: Documentation Updates (1 hour)
Update the following files:
- `ARCH_DOCS/05-STATUS/GAP_ANALYSIS_JAN_16_2026.md` - Change Analytics from 60% → 100%
- `ARCH_DOCS/CURRENT_STATUS.md` - Update feature list
- `ARCH_DOCS/02-FEATURES/ANALYTICS_DASHBOARD.md` - Create new doc (if needed)

---

#### Task 4.4: Error Handling & Polish (1 hour)
- Add error boundaries
- Handle API failures gracefully
- Add retry logic for failed requests
- Improve loading states
- Add tooltips where helpful

---

## 📦 File Summary

### New Files (14)
```
Backend (4 files):
✅ app/api/analytics/calls/route.ts (180 lines)
✅ app/api/analytics/sentiment-trends/route.ts (150 lines)
✅ app/api/analytics/performance/route.ts (120 lines)
✅ app/api/analytics/export/route.ts (200 lines)

Frontend Components (7 files):
✅ components/analytics/CallVolumeChart.tsx (80 lines)
✅ components/analytics/SentimentChart.tsx (80 lines)
✅ components/analytics/DurationChart.tsx (80 lines)
✅ components/analytics/PerformanceMetrics.tsx (100 lines)
✅ components/analytics/DateRangePicker.tsx (80 lines)
✅ components/analytics/ExportButton.tsx (60 lines)
✅ app/analytics/page.tsx (250 lines)

Documentation (1 file):
✅ ARCH_DOCS/05-STATUS/ANALYTICS_DASHBOARD_IMPLEMENTATION_PLAN.md (this file)

Dependencies (1):
✅ package.json (add recharts)
```

### Modified Files (2-3)
```
✅ components/layout/Navigation.tsx (add Analytics link)
✅ ARCH_DOCS/05-STATUS/GAP_ANALYSIS_JAN_16_2026.md (update completion %)
✅ ARCH_DOCS/CURRENT_STATUS.md (update features list)
```

### Total Code Added
- **Backend:** ~650 lines
- **Frontend:** ~730 lines
- **Total:** ~1,380 lines of production code
- **Dependencies:** +1 (recharts)

---

## 🎯 Success Criteria

### Backend (100%)
- [x] `/api/analytics/calls` returns aggregated call metrics
- [x] `/api/analytics/sentiment-trends` returns sentiment time-series
- [x] `/api/analytics/performance` returns system metrics
- [x] `/api/analytics/export` generates CSV/JSON exports
- [x] All endpoints enforce RBAC
- [x] Date range filtering works
- [x] Grouping (day/week/month) works
- [x] Error handling implemented

### Frontend (100%)
- [x] `/analytics` page accessible
- [x] 5 tabs (Overview, Calls, Sentiment, Performance, Surveys)
- [x] Charts display correctly
- [x] Date range picker works
- [x] Export buttons work
- [x] Loading states
- [x] Empty states
- [x] Mobile responsive
- [x] Professional Design System v3.0 compliant
- [x] TypeScript (0 errors)

### Integration (100%)
- [x] Navigation link added
- [x] Authentication required
- [x] Organization scoped
- [x] Real-time data refresh
- [x] Documentation updated

---

## ⏱️ Timeline Breakdown

| Phase | Tasks | Time | Cumulative |
|-------|-------|------|------------|
| **Phase 1: Backend** | 4 API endpoints | 8 hours | 8h |
| **Phase 2: Charts** | 5 chart components | 8 hours | 16h |
| **Phase 3: Page** | Main analytics page | 6 hours | 22h |
| **Phase 4: Testing** | Integration & polish | 2-4 hours | 24-26h |
| **Buffer** | Contingency | 2-6 hours | 26-32h |

**Total Estimated Time:** 24-32 hours (3-4 days)

---

## 🚨 Dependencies & Risks

### Dependencies
- ✅ `recharts` library (needs npm install)
- ✅ Existing `/api/calls` endpoint
- ✅ Existing `/api/analytics/surveys` endpoint
- ✅ Tableau components (MetricCard, DataTable, ProgressBar)
- ✅ Design System v3.0 colors

### Risks
- **Chart Library Performance:** Recharts may be slow with >1000 data points
  - **Mitigation:** Aggregate data server-side, limit to 90 days max
- **Date Range UX:** Custom date pickers can be tricky
  - **Mitigation:** Use native HTML date inputs + presets
- **Export File Size:** Large exports may timeout
  - **Mitigation:** Limit to 10,000 records, add pagination

---

## 📝 Notes

### Design Decisions
1. **Recharts over Chart.js:** Better React integration, TypeScript support
2. **Tabbed Layout:** Reduces cognitive load, focused views
3. **30-Day Default:** Balance between usefulness and performance
4. **CSV + JSON Export:** CSV for Excel, JSON for APIs
5. **No Real-Time Streaming:** Refresh on load, not WebSocket (simpler)

### Future Enhancements (Out of Scope)
- [ ] **Comparative Analysis:** Compare time periods (this month vs last month)
- [ ] **Custom Dashboards:** User-configurable widget layouts
- [ ] **Scheduled Reports:** Email daily/weekly reports
- [ ] **Advanced Filters:** Filter by status, duration, sentiment
- [ ] **Predictive Analytics:** ML-based forecasting
- [ ] **Drill-Down Views:** Click chart to see underlying calls
- [ ] **PDF Export:** Generate printable reports

---

## ✅ Checklist (Implementation)

### Phase 1: Backend (8 hours)
- [ ] Create `/api/analytics/calls/route.ts` (3h)
- [ ] Create `/api/analytics/sentiment-trends/route.ts` (2h)
- [ ] Create `/api/analytics/performance/route.ts` (2h)
- [ ] Create `/api/analytics/export/route.ts` (1h)
- [ ] Test all endpoints with Postman/Thunder Client

### Phase 2: Charts (8 hours)
- [ ] Install recharts: `npm install recharts` (0.5h)
- [ ] Create `CallVolumeChart.tsx` (2h)
- [ ] Create `SentimentChart.tsx` (2h)
- [ ] Create `DurationChart.tsx` (2h)
- [ ] Create `PerformanceMetrics.tsx` (1.5h)

### Phase 3: Page (6 hours)
- [ ] Create `DateRangePicker.tsx` (2h)
- [ ] Create `ExportButton.tsx` (1h)
- [ ] Create `app/analytics/page.tsx` (3h)

### Phase 4: Integration (2-4 hours)
- [ ] Add navigation link (0.5h)
- [ ] Full testing (1.5h)
- [ ] Update documentation (1h)
- [ ] Error handling & polish (1h)

---

## 🎉 Completion

When all checkboxes are complete:
- Analytics Dashboard: 60% → 100% ✅
- Project Overall: 82% → 85% 🚀

**Ready for production deployment!**
