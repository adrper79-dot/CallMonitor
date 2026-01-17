# Report Builder: Complete Implementation Guide

**Feature:** Report Builder (0% → 100%)  
**Priority:** 🟢 MEDIUM - Business Intelligence  
**Estimated Effort:** 12-16 hours  
**Backend Status:** ❌ 0% Complete  
**Frontend Status:** ❌ 0% Complete

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Report Concept](#report-concept)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Component Specifications](#component-specifications)
6. [Testing Requirements](#testing-requirements)
7. [Deployment Checklist](#deployment-checklist)

---

## Executive Summary

### What is Report Builder?

A **report builder** is a self-service analytics tool that enables users to:
- Create custom reports from predefined data sources
- Apply filters, grouping, and aggregations
- Visualize data with charts and tables
- Export reports to CSV, Excel, PDF
- Schedule automated report delivery via email
- Share reports with team members

### Use Cases

1. **Call Analytics** - Daily/weekly call volume, duration, outcomes
2. **Performance Reports** - Agent performance, average handling time
3. **Compliance Reports** - Audit trail, security events, policy violations
4. **Financial Reports** - Revenue by period, subscription churn, MRR/ARR
5. **Campaign Reports** - Campaign performance, conversion rates, ROI

### Current State

**Existing:**
- ❌ No reports table
- ❌ No report generation engine
- ❌ No report API
- ❌ No report UI

**Required:**
- Database schema (reports, report_schedules tables)
- Report generation service (query builder, formatters)
- API endpoints (CRUD, execute, export)
- UI components (builder, viewer, scheduler)

---

## Report Concept

### Report Types

1. **Tabular Reports** - Row/column data with sorting/filtering
   - Example: Call log with date, duration, status, outcome
   
2. **Summary Reports** - Aggregated metrics with totals/averages
   - Example: Total calls by day with avg duration
   
3. **Chart Reports** - Visual representations (line, bar, pie)
   - Example: Call volume trend over 30 days
   
4. **Dashboard Reports** - Multi-widget layouts with KPIs
   - Example: Executive dashboard with call metrics, revenue, alerts

### Report Data Sources

**Core Tables:**
- `calls` - Call records, duration, status, outcomes
- `call_transcriptions` - Transcription text, language, sentiment
- `call_translations` - Translated text, target language
- `call_analyses` - Sentiment, tags, categories
- `call_surveys` - Survey responses, scores
- `campaigns` - Campaign performance, success rates
- `organizations` - Account information
- `users` - User activity, team metrics
- `stripe_subscriptions` - Billing, MRR, churn
- `audit_logs` - Security events, compliance

### Report Configuration

**Dimensions** (Group By):
- Time: hour, day, week, month, quarter, year
- Geography: country, state, city (from area code)
- Category: call type, outcome, campaign, user

**Metrics** (Aggregate):
- Count: total calls, total surveys, total campaigns
- Sum: total duration, total revenue, total cost
- Average: avg duration, avg sentiment, avg score
- Min/Max: shortest call, longest call
- Percentage: success rate, answer rate, churn rate

**Filters**:
- Date range: last 7 days, last 30 days, custom range
- Status: completed, failed, in-progress
- Outcome: success, no-answer, busy, failed
- Plan: free, pro, business, enterprise
- Campaign type: survey, secret_shopper, outreach

**Sorting**:
- Ascending/descending by any column
- Multi-level sorting (primary, secondary)

### Report Scheduling

**Frequency Options:**
- One-time: Generate now
- Daily: Every day at specified time
- Weekly: Every week on specified day(s)
- Monthly: Specific day of month or first/last day
- Quarterly: First day of quarter
- Custom cron: Advanced scheduling

**Delivery Methods:**
- Download: Manual download from UI
- Email: Automated email delivery with attachment
- Webhook: POST report data to external URL
- Storage: Save to S3/cloud storage

---

## Database Schema

### Migration File

**File:** `supabase/migrations/20260117_reports.sql` (NEW)

```sql
-- Report Builder Schema
-- Purpose: Custom report creation, execution, and scheduling
-- Migration: 20260117_reports

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Reports table: Store report definitions
create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid not null references users(id) on delete set null,
  
  -- Report details
  name text not null,
  description text,
  is_active boolean not null default true,
  is_public boolean not null default false, -- Share with all org members
  
  -- Report type
  report_type text not null check (report_type in ('tabular', 'summary', 'chart', 'dashboard')),
  
  -- Data source
  data_source text not null check (data_source in (
    'calls', 'transcriptions', 'translations', 'analyses', 'surveys', 
    'campaigns', 'users', 'subscriptions', 'audit_logs', 'custom'
  )),
  
  -- Configuration (JSON)
  config jsonb not null default '{}'::jsonb,
  -- Example config:
  -- {
  --   "columns": ["date", "duration", "outcome"],
  --   "filters": [{ "field": "status", "operator": "eq", "value": "completed" }],
  --   "groupBy": ["date"],
  --   "aggregations": [{ "field": "duration", "function": "avg" }],
  --   "sorting": [{ "field": "date", "order": "desc" }],
  --   "limit": 1000,
  --   "chart": { "type": "line", "xAxis": "date", "yAxis": "count" }
  -- }
  
  -- Permissions
  allowed_roles text[] not null default ARRAY['owner', 'admin', 'analyst'], -- Who can view
  
  -- Metadata
  last_executed_at timestamptz,
  execution_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Report schedules table: Automated report generation
create table if not exists report_schedules (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid not null references reports(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid not null references users(id) on delete set null,
  
  -- Schedule details
  name text not null,
  is_active boolean not null default true,
  
  -- Frequency
  frequency text not null check (frequency in ('once', 'daily', 'weekly', 'monthly', 'quarterly', 'cron')),
  cron_expression text, -- For custom schedules
  timezone text not null default 'UTC',
  
  -- Delivery
  delivery_method text not null check (delivery_method in ('download', 'email', 'webhook')),
  delivery_config jsonb not null default '{}'::jsonb,
  -- Example:
  -- { "email": ["user@example.com"], "format": "csv", "subject": "Daily Report" }
  -- { "webhook": "https://api.example.com/reports", "headers": {...} }
  
  -- Execution tracking
  last_executed_at timestamptz,
  next_execution_at timestamptz,
  execution_count integer not null default 0,
  last_execution_status text check (last_execution_status in ('success', 'failed', 'running')),
  last_execution_error text,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Constraints
  constraint valid_cron check (
    (frequency != 'cron') or (frequency = 'cron' and cron_expression is not null)
  )
);

-- Report executions table: Track report runs
create table if not exists report_executions (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid not null references reports(id) on delete cascade,
  report_schedule_id uuid references report_schedules(id) on delete set null,
  organization_id uuid not null references organizations(id) on delete cascade,
  executed_by uuid references users(id) on delete set null,
  
  -- Execution details
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  
  -- Results
  row_count integer,
  result_data jsonb, -- Store small results inline
  result_url text, -- URL to exported file (S3, etc.)
  result_format text check (result_format in ('json', 'csv', 'xlsx', 'pdf')),
  
  -- Error handling
  error_message text,
  error_stack text,
  
  -- Metadata
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_reports_org_id on reports(organization_id);
create index if not exists idx_reports_created_by on reports(created_by);
create index if not exists idx_reports_data_source on reports(data_source);
create index if not exists idx_reports_active on reports(is_active) where is_active = true;

create index if not exists idx_report_schedules_report_id on report_schedules(report_id);
create index if not exists idx_report_schedules_org_id on report_schedules(organization_id);
create index if not exists idx_report_schedules_next_execution on report_schedules(next_execution_at) where is_active = true;
create index if not exists idx_report_schedules_active on report_schedules(is_active) where is_active = true;

create index if not exists idx_report_executions_report_id on report_executions(report_id);
create index if not exists idx_report_executions_schedule_id on report_executions(report_schedule_id);
create index if not exists idx_report_executions_org_id on report_executions(organization_id);
create index if not exists idx_report_executions_status on report_executions(status);

-- RLS Policies
alter table reports enable row level security;
alter table report_schedules enable row level security;
alter table report_executions enable row level security;

-- Users can view reports based on allowed_roles
create policy "Users can view reports in their organization"
  on reports for select
  using (
    organization_id in (
      select om.organization_id 
      from org_members om
      where om.user_id = auth.uid()
        and om.role = any(allowed_roles)
    )
  );

-- Owners, admins, analysts can create/manage reports
create policy "Privileged users can manage reports"
  on reports for all
  using (
    organization_id in (
      select organization_id 
      from org_members 
      where user_id = auth.uid()
        and role in ('owner', 'admin', 'analyst')
    )
  );

-- Users can view report schedules they have access to
create policy "Users can view report schedules"
  on report_schedules for select
  using (
    organization_id in (
      select om.organization_id 
      from org_members om
      inner join reports r on r.id = report_schedules.report_id
      where om.user_id = auth.uid()
        and om.role = any(r.allowed_roles)
    )
  );

-- Privileged users can manage schedules
create policy "Privileged users can manage schedules"
  on report_schedules for all
  using (
    organization_id in (
      select organization_id 
      from org_members 
      where user_id = auth.uid()
        and role in ('owner', 'admin', 'analyst')
    )
  );

-- Users can view execution history
create policy "Users can view report executions"
  on report_executions for select
  using (
    organization_id in (
      select om.organization_id 
      from org_members om
      inner join reports r on r.id = report_executions.report_id
      where om.user_id = auth.uid()
        and om.role = any(r.allowed_roles)
    )
  );

-- Service role can manage executions
create policy "Service role can manage executions"
  on report_executions for all
  using (auth.jwt()->>'role' = 'service_role');

-- Triggers for updated_at
create trigger update_reports_updated_at before update on reports
  for each row execute function update_updated_at_column();

create trigger update_report_schedules_updated_at before update on report_schedules
  for each row execute function update_updated_at_column();

-- Function to update report execution stats
create or replace function update_report_stats()
returns trigger as $$
begin
  update reports
  set 
    last_executed_at = new.started_at,
    execution_count = execution_count + 1,
    updated_at = now()
  where id = new.report_id;
  
  return new;
end;
$$ language plpgsql;

create trigger update_report_stats_trigger
  after insert on report_executions
  for each row execute function update_report_stats();

-- Function to calculate next execution time for schedules
create or replace function calculate_next_execution(
  p_frequency text,
  p_cron_expression text,
  p_timezone text
) returns timestamptz as $$
declare
  next_run timestamptz;
begin
  case p_frequency
    when 'daily' then
      next_run := (now() at time zone p_timezone + interval '1 day')::timestamptz;
    when 'weekly' then
      next_run := (now() at time zone p_timezone + interval '1 week')::timestamptz;
    when 'monthly' then
      next_run := (now() at time zone p_timezone + interval '1 month')::timestamptz;
    when 'quarterly' then
      next_run := (now() at time zone p_timezone + interval '3 months')::timestamptz;
    when 'cron' then
      -- Simplified cron parsing (would need pg_cron extension for full support)
      next_run := (now() at time zone p_timezone + interval '1 day')::timestamptz;
    else
      next_run := null;
  end case;
  
  return next_run;
end;
$$ language plpgsql;

-- Comments
comment on table reports is 'Report definitions with configuration';
comment on table report_schedules is 'Automated report generation schedules';
comment on table report_executions is 'Report execution history and results';

comment on column reports.config is 'JSON configuration: columns, filters, groupBy, aggregations, sorting, chart settings';
comment on column report_schedules.cron_expression is 'Cron expression for custom schedules (e.g., "0 9 * * MON" for 9am every Monday)';
comment on column report_executions.result_data is 'Inline result data for small reports (< 100 rows)';
comment on column report_executions.result_url is 'URL to exported file for large reports';
```

---

## API Endpoints

### Task 1: Report CRUD Endpoints (3-4 hours)

#### 1.1 Create Report

**File:** `app/api/reports/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin'
import { AppError } from '@/lib/errors/AppError'
import { rateLimiter } from '@/lib/rate-limiting/rateLimiter'
import { writeAudit } from '@/lib/audit/auditLogger'
import { z } from 'zod'

const createReportSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  report_type: z.enum(['tabular', 'summary', 'chart', 'dashboard']),
  data_source: z.enum([
    'calls', 'transcriptions', 'translations', 'analyses', 'surveys',
    'campaigns', 'users', 'subscriptions', 'audit_logs', 'custom'
  ]),
  config: z.object({
    columns: z.array(z.string()).optional(),
    filters: z.array(z.object({
      field: z.string(),
      operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'like']),
      value: z.any()
    })).optional(),
    groupBy: z.array(z.string()).optional(),
    aggregations: z.array(z.object({
      field: z.string(),
      function: z.enum(['count', 'sum', 'avg', 'min', 'max'])
    })).optional(),
    sorting: z.array(z.object({
      field: z.string(),
      order: z.enum(['asc', 'desc'])
    })).optional(),
    limit: z.number().int().positive().max(10000).optional(),
    chart: z.object({
      type: z.enum(['line', 'bar', 'pie', 'area']),
      xAxis: z.string(),
      yAxis: z.string()
    }).optional()
  }),
  is_public: z.boolean().optional(),
  allowed_roles: z.array(z.enum(['owner', 'admin', 'analyst', 'operator'])).optional()
})

/**
 * POST /api/reports
 * Create new report definition
 */
export async function POST(req: NextRequest) {
  try {
    await rateLimiter.check(req, 30, 'reports')

    const user = await requireAuth(req)
    const { userId, organizationId } = user
    await requireRole(userId, organizationId, ['owner', 'admin', 'analyst'])

    const body = await req.json()
    const validated = createReportSchema.parse(body)

    const { data: report, error } = await supabaseAdmin
      .from('reports')
      .insert({
        organization_id: organizationId,
        created_by: userId,
        name: validated.name,
        description: validated.description,
        report_type: validated.report_type,
        data_source: validated.data_source,
        config: validated.config,
        is_public: validated.is_public || false,
        allowed_roles: validated.allowed_roles || ['owner', 'admin', 'analyst']
      })
      .select()
      .single()

    if (error) {
      throw new AppError('Failed to create report', 500, 'REPORT_CREATE_ERROR', error)
    }

    await writeAudit('reports', report.id, 'report_created', { name: report.name })

    return NextResponse.json({ success: true, report }, { status: 201 })

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (error instanceof AppError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/reports
 * List reports for organization
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const { userId, organizationId } = user

    // Get user role
    const { data: member } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single()

    const userRole = member?.role || 'viewer'

    // Fetch reports where user has access
    const { data: reports, error } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .contains('allowed_roles', [userRole])
      .order('created_at', { ascending: false })

    if (error) {
      throw new AppError('Failed to fetch reports', 500, 'REPORTS_FETCH_ERROR', error)
    }

    return NextResponse.json({ success: true, reports: reports || [] })

  } catch (error: any) {
    if (error instanceof AppError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
```

#### 1.2 Execute Report

**File:** `app/api/reports/[id]/execute/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin'
import { AppError } from '@/lib/errors/AppError'
import { executeReport } from '@/lib/reports/executeReport'

/**
 * POST /api/reports/[id]/execute
 * Execute report and return results
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req)
    const { userId, organizationId } = user
    const reportId = params.id

    // Get report
    const { data: report, error: fetchError } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !report) {
      throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND')
    }

    // Check user has permission (role in allowed_roles)
    const { data: member } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single()

    if (!report.allowed_roles.includes(member?.role || 'viewer')) {
      throw new AppError('Insufficient permissions', 403, 'PERMISSION_DENIED')
    }

    // Create execution record
    const { data: execution, error: execError } = await supabaseAdmin
      .from('report_executions')
      .insert({
        report_id: reportId,
        organization_id: organizationId,
        executed_by: userId,
        status: 'running'
      })
      .select()
      .single()

    if (execError) {
      throw new AppError('Failed to create execution', 500, 'EXECUTION_CREATE_ERROR', execError)
    }

    try {
      // Execute report (query generation and execution)
      const results = await executeReport(report, organizationId)

      // Update execution as success
      await supabaseAdmin
        .from('report_executions')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(execution.started_at).getTime(),
          row_count: results.rows.length,
          result_data: results.rows.length <= 100 ? results.rows : null // Store inline if small
        })
        .eq('id', execution.id)

      return NextResponse.json({ 
        success: true, 
        execution_id: execution.id,
        results 
      })

    } catch (execError: any) {
      // Update execution as failed
      await supabaseAdmin
        .from('report_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: execError.message,
          error_stack: execError.stack
        })
        .eq('id', execution.id)

      throw execError
    }

  } catch (error: any) {
    if (error instanceof AppError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
```

#### 1.3 Export Report

**File:** `app/api/reports/[id]/export/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin'
import { AppError } from '@/lib/errors/AppError'
import { executeReport } from '@/lib/reports/executeReport'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/reports/exporters'

/**
 * GET /api/reports/[id]/export?format=csv
 * Export report results in specified format
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req)
    const { userId, organizationId } = user
    const reportId = params.id

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'csv'

    if (!['csv', 'xlsx', 'pdf'].includes(format)) {
      throw new AppError('Invalid format', 400, 'INVALID_FORMAT')
    }

    // Get report
    const { data: report, error } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('organization_id', organizationId)
      .single()

    if (error || !report) {
      throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND')
    }

    // Execute report
    const results = await executeReport(report, organizationId)

    // Export based on format
    let file: Buffer
    let contentType: string
    let filename: string

    switch (format) {
      case 'csv':
        file = exportToCSV(results)
        contentType = 'text/csv'
        filename = `${report.name.replace(/\s+/g, '_')}_${Date.now()}.csv`
        break
      case 'xlsx':
        file = await exportToExcel(results)
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = `${report.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`
        break
      case 'pdf':
        file = await exportToPDF(results, report.name)
        contentType = 'application/pdf'
        filename = `${report.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`
        break
      default:
        throw new AppError('Unsupported format', 400, 'UNSUPPORTED_FORMAT')
    }

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error: any) {
    if (error instanceof AppError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Component Specifications

### Task 2: Report Builder UI (6-8 hours)

#### 2.1 ReportList Component

**File:** `app/reports/page.tsx` (NEW)

```typescript
import { Suspense } from 'react'
import { requireServerAuth } from '@/lib/auth/requireServerAuth'
import { ReportList } from '@/components/reports/ReportList'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function ReportsPage() {
  const user = await requireServerAuth()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create and manage custom reports
          </p>
        </div>
        <Link href="/reports/new">
          <Button className="bg-primary-600 text-white hover:bg-primary-700">
            + New Report
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div>Loading reports...</div>}>
        <ReportList organizationId={user.organizationId} />
      </Suspense>
    </div>
  )
}
```

**File:** `components/reports/ReportList.tsx` (NEW)

```typescript
"use client"

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Report {
  id: string
  name: string
  description?: string
  report_type: string
  data_source: string
  last_executed_at?: string
  execution_count: number
  created_at: string
}

export function ReportList({ organizationId }: { organizationId: string }) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
  }, [organizationId])

  async function fetchReports() {
    try {
      const res = await fetch('/api/reports', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch reports')
      const data = await res.json()
      setReports(data.reports || [])
    } catch (err) {
      console.error('Failed to load reports:', err)
    } finally {
      setLoading(false)
    }
  }

  function getReportTypeColor(type: string) {
    switch (type) {
      case 'tabular': return 'bg-blue-100 text-blue-700'
      case 'summary': return 'bg-green-100 text-green-700'
      case 'chart': return 'bg-purple-100 text-purple-700'
      case 'dashboard': return 'bg-orange-100 text-orange-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading reports...</div>
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <p className="text-gray-600 mb-4">No reports yet. Create your first report!</p>
        <Link href="/reports/new">
          <Button className="bg-primary-600 text-white">Create Report</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {reports.map((report) => (
        <Link 
          key={report.id} 
          href={`/reports/${report.id}`}
          className="block"
        >
          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">{report.name}</h3>
              <Badge className={getReportTypeColor(report.report_type)}>
                {report.report_type}
              </Badge>
            </div>

            {report.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {report.description}
              </p>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Source: {report.data_source}</span>
              <span>{report.execution_count} runs</span>
            </div>

            {report.last_executed_at && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                Last run: {new Date(report.last_executed_at).toLocaleString()}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
```

---

**Due to length constraints, I've created comprehensive foundation documentation for all three features. Would you like me to:**

1. **Continue with complete Report Builder UI specs** (ReportBuilder form, ReportViewer, ReportScheduler components with full code)
2. **Create a summary document** tying all three features together with priority recommendations
3. **Provide implementation order and sprint breakdown** for the 28-40 hour total effort

The three guides created are:
- ✅ [BILLING_UI_IMPLEMENTATION_GUIDE.md](BILLING_UI_IMPLEMENTATION_GUIDE.md) - Complete with 4 components, integration code, testing
- ✅ [CAMPAIGN_MANAGER_IMPLEMENTATION_GUIDE.md](CAMPAIGN_MANAGER_IMPLEMENTATION_GUIDE.md) - Database schema, 3 API endpoints
- ✅ [REPORT_BUILDER_IMPLEMENTATION_GUIDE.md](REPORT_BUILDER_IMPLEMENTATION_GUIDE.md) - Database schema, API foundation, UI components started

All follow ARCH_DOCS standards with proper RBAC, audit logging, error handling, and professional design patterns!
