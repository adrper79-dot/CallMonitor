# Campaign Manager: Complete Implementation Guide

**Feature:** Campaign Manager (0% → 100%)  
**Priority:** 🟡 MEDIUM - Operational Efficiency  
**Estimated Effort:** 8-12 hours  
**Backend Status:** ⚠️ 20% Complete (API stub only)  
**Frontend Status:** ❌ 0% Complete

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Campaign Concept](#campaign-concept)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Component Specifications](#component-specifications)
6. [Testing Requirements](#testing-requirements)
7. [Deployment Checklist](#deployment-checklist)

---

## Executive Summary

### What is a Campaign?

A **campaign** is a batch operation that initiates multiple voice calls with:
- Shared configuration (voice settings, AI agent, script)
- Target list (CSV upload or manual entry)
- Scheduling (immediate, scheduled, or recurring)
- Progress tracking (pending, completed, failed)
- Aggregate analytics (success rate, avg duration, sentiment)

### Use Cases

1. **Secret Shopper** - Call 100 stores to evaluate customer service quality
2. **Survey Campaign** - Call 500 customers for product feedback
3. **Appointment Reminders** - Call patients with upcoming appointments
4. **Sales Outreach** - Call prospects with personalized sales pitch
5. **Lead Qualification** - Call leads to qualify interest and availability

### Current State

**Existing:**
- `GET /api/campaigns` - Returns empty array (graceful degradation)
- RBAC check implemented in route
- No database tables

**Missing:**
- `campaigns` and `campaign_targets` tables
- Full CRUD API (POST, PATCH, DELETE endpoints)
- Campaign execution engine
- Campaign UI (/campaigns page)
- Campaign components

---

## Campaign Concept

### Campaign Lifecycle

```
draft → scheduled → running → completed
   ↓         ↓          ↓          ↓
   →      paused    → failed      ✓
```

**States:**
- `draft` - Campaign created but not scheduled
- `scheduled` - Campaign scheduled for future execution
- `running` - Campaign currently executing calls
- `paused` - Campaign manually paused
- `completed` - All targets processed successfully
- `failed` - Campaign failed to execute

### Campaign Types

1. **Secret Shopper** - Evaluate service quality
   - Pre-configured script for mystery shopping
   - Scorecard for rating interactions
   - Compliance checks

2. **Survey** - Collect feedback
   - Dynamic survey questions
   - Response collection
   - Sentiment analysis

3. **Reminder** - Appointment notifications
   - Personalized messages with custom data
   - Confirmation requests
   - Rescheduling options

4. **Outreach** - Sales/marketing calls
   - Lead qualification scripts
   - Interest tracking
   - Follow-up scheduling

5. **Custom** - User-defined campaigns
   - Custom AI agent prompts
   - Custom data fields
   - Flexible configuration

### Target Management

**Target Sources:**
- CSV upload (name, phone, email, custom_data)
- Manual entry (single or bulk)
- CRM integration (future)

**Target States:**
- `pending` - Not yet called
- `calling` - Call in progress
- `completed` - Call finished successfully
- `failed` - Call failed (busy, no answer, error)
- `skipped` - Manually excluded from campaign

### Scheduling Options

1. **Immediate** - Start calling targets now
2. **Scheduled** - Start at specific date/time
3. **Recurring** - Run on schedule (daily at 9am, weekly on Mondays, etc.)

**Recurrence Patterns (cron-like):**
- `0 9 * * 1-5` - 9am on weekdays
- `0 14 * * 3` - 2pm every Wednesday
- `0 10 1 * *` - 10am first day of month

---

## Database Schema

### Migration File

**File:** `supabase/migrations/20260117_campaigns.sql` (NEW)

```sql
-- Campaign Management Schema
-- Purpose: Batch call operations with target lists and scheduling
-- Migration: 20260117_campaigns

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Campaigns table: Track batch call operations
create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid not null references users(id) on delete set null,
  
  -- Campaign details
  name text not null,
  description text,
  is_active boolean not null default true,
  
  -- Campaign type and config
  campaign_type text not null check (campaign_type in ('secret_shopper', 'survey', 'reminder', 'outreach', 'custom')),
  voice_config_snapshot jsonb not null, -- Snapshot of voice_configs at campaign creation
  
  -- Targets
  total_targets integer not null default 0,
  completed_calls integer not null default 0,
  failed_calls integer not null default 0,
  pending_calls integer not null default 0,
  
  -- Scheduling
  schedule_type text not null check (schedule_type in ('immediate', 'scheduled', 'recurring')),
  scheduled_at timestamptz,
  recurrence_pattern text, -- cron-like: "0 9 * * 1-5"
  
  -- Status
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Analytics
  avg_duration_seconds integer,
  avg_sentiment_score numeric(3,2), -- -1.00 to 1.00
  success_rate numeric(5,2), -- percentage 0-100
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Constraints
  constraint valid_schedule check (
    (schedule_type = 'immediate') or
    (schedule_type = 'scheduled' and scheduled_at is not null) or
    (schedule_type = 'recurring' and recurrence_pattern is not null)
  )
);

-- Campaign targets table: Individual targets for a campaign
create table if not exists campaign_targets (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  
  -- Target details
  phone_number text not null,
  name text,
  email text,
  custom_data jsonb, -- Additional fields (appointment_time, order_id, account_number, etc.)
  
  -- Execution
  status text not null default 'pending' check (status in ('pending', 'calling', 'completed', 'failed', 'skipped')),
  call_id uuid references calls(id) on delete set null,
  
  -- Timing
  scheduled_at timestamptz,
  called_at timestamptz,
  
  -- Result
  result_summary text,
  error_message text,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_campaigns_org_id on campaigns(organization_id);
create index if not exists idx_campaigns_status on campaigns(status);
create index if not exists idx_campaigns_created_by on campaigns(created_by);
create index if not exists idx_campaigns_scheduled_at on campaigns(scheduled_at) where status = 'scheduled';
create index if not exists idx_campaigns_type on campaigns(campaign_type);

create index if not exists idx_campaign_targets_campaign_id on campaign_targets(campaign_id);
create index if not exists idx_campaign_targets_status on campaign_targets(status);
create index if not exists idx_campaign_targets_call_id on campaign_targets(call_id);
create index if not exists idx_campaign_targets_scheduled_at on campaign_targets(scheduled_at) where status = 'pending';

-- RLS Policies
alter table campaigns enable row level security;
alter table campaign_targets enable row level security;

-- Users can view campaigns from their organization
create policy "Users can view own organization campaigns"
  on campaigns for select
  using (
    organization_id in (
      select organization_id 
      from org_members 
      where user_id = auth.uid()
    )
  );

-- Owners and admins can manage campaigns
create policy "Owners and admins can manage campaigns"
  on campaigns for all
  using (
    organization_id in (
      select organization_id 
      from org_members 
      where user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- Users can view campaign targets from their organization campaigns
create policy "Users can view own organization campaign targets"
  on campaign_targets for select
  using (
    campaign_id in (
      select id from campaigns
      where organization_id in (
        select organization_id 
        from org_members 
        where user_id = auth.uid()
      )
    )
  );

-- Service role can manage campaign targets (for execution engine)
create policy "Service role can manage campaign targets"
  on campaign_targets for all
  using (auth.jwt()->>'role' = 'service_role');

-- Trigger for updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_campaigns_updated_at before update on campaigns
  for each row execute function update_updated_at_column();

create trigger update_campaign_targets_updated_at before update on campaign_targets
  for each row execute function update_updated_at_column();

-- Function to update campaign statistics
create or replace function update_campaign_stats()
returns trigger as $$
begin
  update campaigns
  set 
    completed_calls = (
      select count(*) from campaign_targets
      where campaign_id = new.campaign_id and status = 'completed'
    ),
    failed_calls = (
      select count(*) from campaign_targets
      where campaign_id = new.campaign_id and status = 'failed'
    ),
    pending_calls = (
      select count(*) from campaign_targets
      where campaign_id = new.campaign_id and status = 'pending'
    ),
    success_rate = case 
      when (
        select count(*) from campaign_targets
        where campaign_id = new.campaign_id and status in ('completed', 'failed')
      ) > 0 then
        (
          select count(*) * 100.0 from campaign_targets
          where campaign_id = new.campaign_id and status = 'completed'
        ) / (
          select count(*) from campaign_targets
          where campaign_id = new.campaign_id and status in ('completed', 'failed')
        )
      else 0
    end,
    updated_at = now()
  where id = new.campaign_id;
  
  return new;
end;
$$ language plpgsql;

create trigger update_campaign_stats_trigger
  after insert or update on campaign_targets
  for each row execute function update_campaign_stats();

-- Function to mark campaign as completed when all targets done
create or replace function check_campaign_completion()
returns trigger as $$
declare
  pending_count integer;
begin
  -- Check if all targets are done (completed, failed, or skipped)
  select count(*) into pending_count
  from campaign_targets
  where campaign_id = new.campaign_id 
    and status in ('pending', 'calling');
  
  -- If no pending targets, mark campaign as completed
  if pending_count = 0 then
    update campaigns
    set 
      status = 'completed',
      completed_at = now()
    where id = new.campaign_id
      and status = 'running';
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger check_campaign_completion_trigger
  after update on campaign_targets
  for each row execute function check_campaign_completion();

-- Comments
comment on table campaigns is 'Batch call operations with target lists and scheduling';
comment on table campaign_targets is 'Individual targets within a campaign';

comment on column campaigns.voice_config_snapshot is 'Immutable snapshot of voice config at campaign creation time';
comment on column campaigns.recurrence_pattern is 'Cron-like pattern for recurring campaigns (e.g., "0 9 * * 1-5" for 9am weekdays)';
comment on column campaign_targets.custom_data is 'Additional fields specific to campaign type (appointment_time, order_id, etc.)';
```

---

## API Endpoints

### Task 1: Campaign CRUD Endpoints (3-4 hours)

#### 1.1 Create Campaign

**File:** `app/api/campaigns/route.ts` (UPDATE)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin'
import { AppError } from '@/lib/errors/AppError'
import { rateLimiter } from '@/lib/rate-limiting/rateLimiter'
import { writeAudit } from '@/lib/audit/auditLogger'
import { z } from 'zod'

// Validation schema
const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  campaign_type: z.enum(['secret_shopper', 'survey', 'reminder', 'outreach', 'custom']),
  voice_config_id: z.string().uuid(), // Reference to voice_configs table
  schedule_type: z.enum(['immediate', 'scheduled', 'recurring']),
  scheduled_at: z.string().datetime().optional(),
  recurrence_pattern: z.string().optional(),
  targets: z.array(z.object({
    phone_number: z.string().regex(/^\+?[1-9]\d{1,14}$/), // E.164 format
    name: z.string().optional(),
    email: z.string().email().optional(),
    custom_data: z.record(z.any()).optional()
  })).min(1).max(1000) // Max 1000 targets per campaign
})

/**
 * POST /api/campaigns
 * Create new campaign with targets
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    await rateLimiter.check(req, 20, 'campaigns') // 20 campaign creations per minute

    // Auth
    const user = await requireAuth(req)
    const { userId, organizationId } = user

    // RBAC: Only owner/admin can create campaigns
    await requireRole(userId, organizationId, ['owner', 'admin'])

    // Parse and validate body
    const body = await req.json()
    const validated = createCampaignSchema.parse(body)

    // Get voice config snapshot
    const { data: voiceConfig, error: vcError } = await supabaseAdmin
      .from('voice_configs')
      .select('*')
      .eq('id', validated.voice_config_id)
      .eq('organization_id', organizationId)
      .single()

    if (vcError || !voiceConfig) {
      throw new AppError('Voice config not found', 404, 'VOICE_CONFIG_NOT_FOUND')
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        organization_id: organizationId,
        created_by: userId,
        name: validated.name,
        description: validated.description,
        campaign_type: validated.campaign_type,
        voice_config_snapshot: voiceConfig, // Store immutable snapshot
        total_targets: validated.targets.length,
        pending_calls: validated.targets.length,
        schedule_type: validated.schedule_type,
        scheduled_at: validated.scheduled_at,
        recurrence_pattern: validated.recurrence_pattern,
        status: validated.schedule_type === 'immediate' ? 'scheduled' : 'draft'
      })
      .select()
      .single()

    if (campaignError) {
      throw new AppError('Failed to create campaign', 500, 'CAMPAIGN_CREATE_ERROR', campaignError)
    }

    // Create campaign targets
    const targetsToInsert = validated.targets.map(target => ({
      campaign_id: campaign.id,
      phone_number: target.phone_number,
      name: target.name,
      email: target.email,
      custom_data: target.custom_data,
      scheduled_at: validated.schedule_type === 'immediate' ? new Date().toISOString() : validated.scheduled_at
    }))

    const { error: targetsError } = await supabaseAdmin
      .from('campaign_targets')
      .insert(targetsToInsert)

    if (targetsError) {
      // Rollback campaign if targets fail
      await supabaseAdmin.from('campaigns').delete().eq('id', campaign.id)
      throw new AppError('Failed to create campaign targets', 500, 'CAMPAIGN_TARGETS_ERROR', targetsError)
    }

    // Audit log
    await writeAudit('campaigns', campaign.id, 'campaign_created', {
      name: campaign.name,
      type: campaign.campaign_type,
      target_count: validated.targets.length
    })

    return NextResponse.json({ 
      success: true, 
      campaign 
    }, { status: 201 })

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 })
    }

    if (error instanceof AppError) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: error.statusCode })
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET /api/campaigns
 * List campaigns for organization
 */
export async function GET(req: NextRequest) {
  try {
    // Auth
    const user = await requireAuth(req)
    const { organizationId } = user

    // Query params
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabaseAdmin
      .from('campaigns')
      .select('*, campaign_targets(count)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('campaign_type', type)

    const { data: campaigns, error, count } = await query

    if (error) {
      // Graceful degradation if table doesn't exist
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, campaigns: [], total: 0 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      campaigns: campaigns || [],
      total: count || 0,
      limit,
      offset
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch campaigns'
    }, { status: 500 })
  }
}
```

#### 1.2 Update Campaign

**File:** `app/api/campaigns/[id]/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin'
import { AppError } from '@/lib/errors/AppError'
import { writeAudit } from '@/lib/audit/auditLogger'
import { z } from 'zod'

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'paused']).optional(), // Can't manually set to running/completed/failed
  scheduled_at: z.string().datetime().optional(),
  recurrence_pattern: z.string().optional()
})

/**
 * PATCH /api/campaigns/[id]
 * Update campaign (only if not running/completed)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth
    const user = await requireAuth(req)
    const { userId, organizationId } = user
    await requireRole(userId, organizationId, ['owner', 'admin'])

    const campaignId = params.id

    // Get existing campaign
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND')
    }

    // Can't update running/completed/failed campaigns
    if (['running', 'completed', 'failed'].includes(campaign.status)) {
      throw new AppError('Cannot update campaign in current status', 400, 'INVALID_CAMPAIGN_STATUS')
    }

    // Validate update
    const body = await req.json()
    const validated = updateCampaignSchema.parse(body)

    // Update campaign
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update(validated)
      .eq('id', campaignId)
      .select()
      .single()

    if (updateError) {
      throw new AppError('Failed to update campaign', 500, 'CAMPAIGN_UPDATE_ERROR', updateError)
    }

    // Audit log
    await writeAudit('campaigns', campaignId, 'campaign_updated', validated)

    return NextResponse.json({ success: true, campaign: updated })

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
 * DELETE /api/campaigns/[id]
 * Delete campaign (only if draft/scheduled)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth
    const user = await requireAuth(req)
    const { userId, organizationId } = user
    await requireRole(userId, organizationId, ['owner', 'admin'])

    const campaignId = params.id

    // Get existing campaign
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND')
    }

    // Can only delete draft/scheduled campaigns
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new AppError('Cannot delete campaign in current status', 400, 'INVALID_CAMPAIGN_STATUS')
    }

    // Delete campaign (cascade will delete targets)
    const { error: deleteError } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', campaignId)

    if (deleteError) {
      throw new AppError('Failed to delete campaign', 500, 'CAMPAIGN_DELETE_ERROR', deleteError)
    }

    // Audit log
    await writeAudit('campaigns', campaignId, 'campaign_deleted', {})

    return NextResponse.json({ success: true })

  } catch (error: any) {
    if (error instanceof AppError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
```

#### 1.3 Execute Campaign

**File:** `app/api/campaigns/[id]/execute/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin'
import { AppError } from '@/lib/errors/AppError'
import { writeAudit } from '@/lib/audit/auditLogger'
import { initiateCall } from '@/lib/signalwire/initiateCall'

/**
 * POST /api/campaigns/[id]/execute
 * Execute campaign (start making calls)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth
    const user = await requireAuth(req)
    const { userId, organizationId } = user
    await requireRole(userId, organizationId, ['owner', 'admin'])

    const campaignId = params.id

    // Get campaign
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('*, campaign_targets!inner(id, phone_number, name, custom_data, status)')
      .eq('id', campaignId)
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND')
    }

    // Must be in draft or scheduled status
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new AppError('Campaign cannot be executed in current status', 400, 'INVALID_CAMPAIGN_STATUS')
    }

    // Mark campaign as running
    await supabaseAdmin
      .from('campaigns')
      .update({ 
        status: 'running', 
        started_at: new Date().toISOString() 
      })
      .eq('id', campaignId)

    // Get pending targets
    const { data: targets, error: targetsError } = await supabaseAdmin
      .from('campaign_targets')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(10) // Process 10 at a time to avoid overload

    if (targetsError) {
      throw new AppError('Failed to fetch targets', 500, 'TARGETS_FETCH_ERROR', targetsError)
    }

    // Initiate calls for each target
    const callPromises = (targets || []).map(async (target) => {
      try {
        // Mark target as calling
        await supabaseAdmin
          .from('campaign_targets')
          .update({ 
            status: 'calling', 
            called_at: new Date().toISOString() 
          })
          .eq('id', target.id)

        // Initiate call using voice_config_snapshot from campaign
        const call = await initiateCall({
          organizationId,
          phoneNumber: target.phone_number,
          voiceConfig: campaign.voice_config_snapshot,
          metadata: {
            campaign_id: campaignId,
            campaign_target_id: target.id,
            target_name: target.name,
            custom_data: target.custom_data
          }
        })

        // Update target with call_id
        await supabaseAdmin
          .from('campaign_targets')
          .update({ call_id: call.id })
          .eq('id', target.id)

        return { success: true, target_id: target.id, call_id: call.id }
      } catch (error: any) {
        // Mark target as failed
        await supabaseAdmin
          .from('campaign_targets')
          .update({ 
            status: 'failed', 
            error_message: error.message 
          })
          .eq('id', target.id)

        return { success: false, target_id: target.id, error: error.message }
      }
    })

    const results = await Promise.allSettled(callPromises)

    // Audit log
    await writeAudit('campaigns', campaignId, 'campaign_executed', {
      targets_processed: targets?.length || 0,
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Campaign execution started',
      results: results.map((r, i) => r.status === 'fulfilled' ? r.value : { error: r.reason })
    })

  } catch (error: any) {
    if (error instanceof AppError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
```

**Note:** Campaign execution should ideally run as a background job (Vercel Cron, queue service) to process targets incrementally without blocking API requests. Above implementation shows simplified synchronous execution.

---

[DOCUMENT CONTINUES with Component Specifications, Testing, and Deployment sections...]

Would you like me to continue with the complete Campaign Manager specification including the full UI components (CampaignList, CampaignForm, CampaignResults) and the Report Builder guide?
