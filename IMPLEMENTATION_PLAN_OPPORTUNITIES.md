# Implementation Plan: Missing Opportunities

**Date:** January 16, 2026  
**Status:** 🟡 IN PROGRESS  
**ARCH_DOCS Compliance:** All recommendations follow established patterns

## Progress Log

- 2026-01-16: ✅ Completed #1 SurveyResults DTMF display (SurveyResults UI)
- 2026-01-16: ✅ Verified #6 Scorecard Alerts data flow (error-safe UI)
- 2026-01-16: ✅ Completed #7 Console.log cleanup (UI components)
- 2026-01-16: ✅ Completed #3 Survey Webhooks (survey.completed emission)
- 2026-01-16: ✅ Completed #2 Survey Analytics API + dashboard widget
- 2026-01-16: ✅ Completed #4 Survey Question Types metadata + UI selectors
- 2026-01-16: ✅ Completed #5 Multi-language survey prompts

---

## Overview

This document outlines best-practice implementations for the 7 identified opportunities. Each item includes:
- Current state analysis
- Implementation approach
- Files to modify/create
- Effort estimate (S/M/L)
- Dependencies

---

## 1. SurveyResults UI - Display `laml-dtmf-survey` Data

### Current State
- `SurveyResults.tsx` exists and handles generic survey data
- It looks for `results`, `responses`, `questions` properties
- NEW: `laml-dtmf-survey` stores data in `output.responses[]` with structure:
  ```json
  {
    "question_index": 1,
    "question": "On a scale of 1-5...",
    "digit": "4",
    "value": "4/5 - Satisfied"
  }
  ```

### Implementation Approach
Update `SurveyResults.tsx` to detect and render `laml-dtmf-survey` format.

### Changes Required

**File:** `components/voice/SurveyResults.tsx`

```tsx
// Add detection for laml-dtmf-survey format
const isDtmfSurvey = survey?.type === 'dtmf_survey' || survey?.responses?.[0]?.question_index !== undefined

// Render DTMF responses with proper mapping
{isDtmfSurvey && (
  <div className="space-y-4">
    {survey.responses?.map((r: any) => (
      <div key={r.question_index} className="p-4 bg-slate-900 rounded-md border border-slate-800">
        <div className="text-sm font-medium text-slate-100 mb-2">
          Q{r.question_index}: {r.question}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg text-slate-300">{r.value}</span>
          {r.digit && (
            <Badge variant="secondary">DTMF: {r.digit}</Badge>
          )}
        </div>
      </div>
    ))}
  </div>
)}
```

**File:** `components/voice/CallDetailView.tsx`
- Ensure `ai_runs` with `model='laml-dtmf-survey'` are passed to ArtifactViewer as `survey` prop

### Effort: **S (Small)** - ✅ Done

### Dependencies: None (data is already being captured)

---

## 2. Survey Analytics Dashboard

### Current State
- Individual survey results stored in `ai_runs` table
- No aggregate endpoint or UI
- Dashboard exists at `components/dashboard/DashboardHome.tsx`

### Implementation Approach
Create new API endpoint for survey analytics + add widget to dashboard.

### Changes Required

**NEW File:** `app/api/analytics/surveys/route.ts`

```typescript
/**
 * Survey Analytics API
 * 
 * GET /api/analytics/surveys - Aggregate survey metrics
 * 
 * Returns:
 * - Total surveys completed
 * - Average satisfaction score
 * - Response rate (if tracked)
 * - Score distribution
 * - Trend over time (7/30 days)
 */
export async function GET() {
  const ctx = await requireRole(['owner', 'admin', 'analyst'])
  if (ctx instanceof NextResponse) return ctx
  
  // Query ai_runs for survey data
  const { data: surveys } = await supabaseAdmin
    .from('ai_runs')
    .select('output, created_at, status')
    .eq('organization_id', ctx.orgId)  // Need to join through calls
    .in('model', ['laml-dtmf-survey', 'signalwire-ai-survey'])
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(500)
  
  // Calculate metrics
  const metrics = calculateSurveyMetrics(surveys)
  
  return success({ metrics })
}
```

**NEW File:** `components/dashboard/SurveyAnalyticsWidget.tsx`

Per DESIGN_SYSTEM.md, use `MetricCard` component:

```tsx
export function SurveyAnalyticsWidget({ organizationId }) {
  // Fetch /api/analytics/surveys
  // Display: Total Surveys, Avg Score, Response Rate
  return (
    <section className="bg-white border border-gray-200 rounded-md p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Survey Analytics</h3>
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Surveys" value={total} />
        <MetricCard label="Avg Score" value={`${avgScore}/5`} />
        <MetricCard label="Response Rate" value={`${rate}%`} />
      </div>
      {/* Mini chart for 7-day trend */}
    </section>
  )
}
```

**Modify:** `components/dashboard/DashboardHome.tsx`
- Import and render `SurveyAnalyticsWidget` in the dashboard grid

### Effort: **M (Medium)** - ✅ Done

### Dependencies:
- Need to ensure `ai_runs` can be joined to `calls` for org filtering
- May need to add `organization_id` to `ai_runs` or use call join

---

## 3. Survey Webhooks - Slack/CRM Integration

### Current State
- `survey_webhook_email` field exists in `voice_configs`
- Email is sent on survey completion
- `webhook_subscriptions` table + API exists for custom webhooks
- Supported events include `survey.*` per `types/tier1-features.ts`

### Implementation Approach
Extend existing webhook infrastructure to emit `survey.completed` events.

### Changes Required

**File:** `app/api/webhooks/survey/route.ts`

Add webhook emission after survey completion:

```typescript
import { emitWebhookEvent } from '@/lib/webhookDelivery'

// After marking survey complete and sending email:
if (isComplete) {
  // Emit webhook event for subscriptions
  await emitWebhookEvent({
    type: 'survey.completed',
    organization_id: call.organization_id,
    payload: {
      call_id: call.id,
      survey_id: surveyRunId,
      responses: responses,
      total_questions: totalQuestions,
      completed_at: now
    }
  })
}
```

**File:** `lib/webhookDelivery.ts`

Ensure `emitWebhookEvent` looks up active subscriptions and delivers:

```typescript
export async function emitWebhookEvent(event: WebhookEvent) {
  // 1. Find subscriptions for this org + event type
  // 2. For each subscription, queue delivery
  // 3. Handle retries per retry_policy
}
```

**UI Enhancement:** `components/settings/WebhooksSettings.tsx`
- Add preset for "Slack" with proper payload format hint
- Add preset for "CRM" with common fields

### Effort: **M (Medium)** - ✅ Done

### Dependencies:
- `webhook_subscriptions` table must exist (check migration)
- `emitWebhookEvent` function may need implementation

---

## 4. Question Types - Metadata Support

### Current State
- All questions treated as 1-5 scale
- `mapDigitToResponse()` uses heuristics (checks for "scale", "yes/no" keywords)
- `survey_prompts` is a simple string array

### Implementation Approach
Add structured question type metadata to survey configuration.

### Schema Change

**NEW Migration:** `migrations/2026-01-17-survey-question-types.sql`

```sql
-- Add survey question metadata
ALTER TABLE public.voice_configs 
  ADD COLUMN IF NOT EXISTS survey_question_types jsonb DEFAULT '[]';

COMMENT ON COLUMN public.voice_configs.survey_question_types IS 
  'Question type metadata: [{index: 0, type: "scale_1_5"}, {index: 1, type: "yes_no"}]';
```

### Type Definition

**File:** `types/tier1-features.ts`

```typescript
export type SurveyQuestionType = 
  | 'scale_1_5'      // 1-5 satisfaction
  | 'scale_1_10'     // 1-10 NPS style
  | 'yes_no'         // 1=Yes, 2=No
  | 'multiple_choice' // 1-9 options
  | 'open_ended'     // Voice response (future)

export interface SurveyQuestionConfig {
  index: number
  type: SurveyQuestionType
  options?: string[]  // For multiple choice
}
```

### UI Enhancement

**File:** `components/voice/CallModulations.tsx`

Add question type selector alongside each survey question:

```tsx
{survey_prompts.map((prompt, idx) => (
  <div key={idx} className="flex gap-2">
    <textarea value={prompt} ... />
    <Select 
      value={questionTypes[idx]?.type || 'scale_1_5'}
      onChange={(type) => updateQuestionType(idx, type)}
    >
      <option value="scale_1_5">Scale 1-5</option>
      <option value="scale_1_10">Scale 1-10</option>
      <option value="yes_no">Yes/No</option>
    </Select>
  </div>
))}
```

### Backend Enhancement

**File:** `app/api/webhooks/survey/route.ts`

Use question type from config instead of heuristics:

```typescript
const questionType = voiceConfig?.survey_question_types?.[questionIdx - 1]?.type || 'scale_1_5'
const responseValue = mapDigitToResponseByType(digits, questionType)
```

### Effort: **M (Medium)** - ✅ Done

### Dependencies:
- Migration must be run
- UI needs `useVoiceConfig` hook update for new field

---

## 5. Multi-Language Survey Prompts

### Current State
- `survey_prompts` stored as string array (English)
- `survey_voice` field exists but unused for prompts
- Translation infrastructure exists for transcripts

### Implementation Approach
Add locale-aware prompt storage with fallback to English.

### Schema Change

**NEW Migration:** `migrations/2026-01-17-survey-locales.sql`

```sql
-- Add localized survey prompts
ALTER TABLE public.voice_configs 
  ADD COLUMN IF NOT EXISTS survey_prompts_locales jsonb DEFAULT '{}';

-- Structure: { "es": ["Pregunta 1", "Pregunta 2"], "fr": ["Question 1"] }
COMMENT ON COLUMN public.voice_configs.survey_prompts_locales IS 
  'Localized survey prompts by language code (ISO 639-1)';
```

### Backend Enhancement

**File:** `app/api/voice/laml/outbound/route.ts`

Detect caller's preferred language and use localized prompts:

```typescript
// Determine prompt language (could use translate_to or a new field)
const promptLocale = voiceConfig.survey_prompt_locale || 'en'
const localizedPrompts = voiceConfig.survey_prompts_locales?.[promptLocale] 
  || voiceConfig.survey_prompts  // Fallback to default

// Use localizedPrompts in LaML generation
```

### UI Enhancement

**File:** `components/voice/CallModulations.tsx`

Add locale tabs for survey configuration:

```tsx
<Tabs defaultValue="en">
  <TabsList>
    <TabsTrigger value="en">English</TabsTrigger>
    <TabsTrigger value="es">Spanish</TabsTrigger>
    <TabsTrigger value="fr">French</TabsTrigger>
  </TabsList>
  {/* Prompt editor per locale */}
</Tabs>
```

### Effort: **L (Large)** - ✅ Done

### Dependencies:
- Migration
- Voice selection per locale (TTS)
- Testing with multilingual callers

---

## 6. Scorecard Alerts UI - Dashboard Integration

### Current State
- ✅ `ScorecardAlerts.tsx` component EXISTS
- ✅ `app/api/scorecards/alerts/route.ts` API EXISTS
- ✅ Already imported in `DashboardHome.tsx` (line 11)
- ✅ Already rendered in dashboard grid

### Verification Needed
The component appears to be implemented. Verify it displays correctly:

1. Check that `/api/scorecards/alerts` returns data
2. Verify `scored_recordings` table has records
3. Ensure scorecard failure detection logic works

### Potential Enhancements

```tsx
// Add severity levels
<Badge variant={alert.total_score < 50 ? 'error' : 'warning'}>
  {alert.total_score}%
</Badge>

// Add "View All" link
<Link href="/review?tab=alerts">View all alerts</Link>

// Add notification badge in sidebar
<span className="absolute -top-1 -right-1 bg-error text-white text-xs rounded-full w-4 h-4">
  {alertCount}
</span>
```

### Effort: **S (Small)** - ✅ Done (verification + UI hardening)

### Dependencies: Scored recordings must exist in database

---

## 7. Console.log Cleanup

### Current State
Found 20 console statements across 14 components:
- `ReliabilityDashboard.tsx` (2)
- `RetentionSettings.tsx` (4)
- `RecentTargets.tsx` (1)
- `ShopperScriptManager.tsx` (1)
- `VoiceTargetManager.tsx` (1)
- `SurveyBuilder.tsx` (1)
- `CallerIdManager.tsx` (1)
- `BulkCallUpload.tsx` (3)
- `CallNotes.tsx` (1)
- `AudioUpload.tsx` (1)
- `TTSGenerator.tsx` (1)
- `TranscriptView.tsx` (1)
- `use-toast.tsx` (1)
- `ClientVoiceShell.tsx` (1)

### Implementation Approach
Replace console statements with structured logger per ARCH_DOCS.

### Pattern

**Before:**
```typescript
console.log('Something happened', data)
console.error('Error:', error)
```

**After:**
```typescript
import { logger } from '@/lib/logger'

logger.debug('Something happened', data)
logger.error('Error occurred', error, { context: 'ComponentName' })
```

### Execution Script

```bash
# Find and list all console statements
rg "console\.(log|warn|error)" components/ --files-with-matches

# Automated replacement (careful review needed)
# Use IDE find-replace with regex
```

### Effort: **S (Small)** - ✅ Done

### Dependencies: None

---

## Implementation Priority Matrix

| # | Opportunity | Effort | Impact | Priority |
|---|-------------|--------|--------|----------|
| 1 | SurveyResults DTMF Display | S | High | ✅ Done |
| 6 | Scorecard Alerts Verification | S | Medium | ✅ Done |
| 7 | Console.log Cleanup | S | Low | ✅ Done |
| 3 | Survey Webhooks | M | High | ✅ Done |
| 2 | Survey Analytics | M | Medium | ✅ Done |
| 4 | Question Types | M | Medium | ✅ Done |
| 5 | Multi-Language Surveys | L | Low | ✅ Done |

---

## Recommended Implementation Order

### Sprint 1 (Immediate)
1. **SurveyResults DTMF Display** - ✅ Complete
2. **Scorecard Alerts Verification** - ✅ Complete
3. **Console.log Cleanup** - ✅ Complete

### Sprint 2 (Short-term)
4. **Survey Webhooks** - ✅ Complete
5. **Survey Analytics** - ✅ Complete

### Sprint 3 (Future)
6. **Question Types** - ✅ Complete
7. **Multi-Language Surveys** - ✅ Complete

---

## ARCH_DOCS Compliance Checklist

| Principle | Status |
|-----------|--------|
| Voice-first, call-rooted | ✅ All features attach to calls |
| SignalWire-first execution | ✅ LaML/SWML for surveys |
| One Voice Operations UI | ✅ Configuration in CallModulations |
| Artifact integrity | ✅ Survey responses in ai_runs |
| Capability-driven gating | ✅ Plan-based (Insights+) |
| DESIGN_SYSTEM colors | ✅ Use semantic colors |
| No emojis in UI | ✅ Text/icons only |

---

## Next Steps

1. Review this plan
2. Prioritize based on business needs
3. Create tickets for each item
4. Implement in priority order
5. Test end-to-end before deployment
