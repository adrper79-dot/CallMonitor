# Rollout Execution Plan: System of Record Completion

**Date:** January 15, 2026  
**Goal:** Complete 5% gap to achieve 10/10 "System of Record" positioning  
**Timeline:** 2 weeks (10 business days)  
**Success Criteria:** All 5 critical tasks completed, tested, and deployed

---

## 📋 **OVERVIEW**

This is the **complete, step-by-step execution plan** to finish CallMonitor v1.

**Current State:** 95% complete (8.5/10)  
**Target State:** 100% complete (10/10)  
**Work Required:** 8 days of focused execution

---

## 🎯 **CRITICAL PATH** (Must Complete)

### **Day 1-2: Foundation (Documentation + Schema)**
1. Create Artifact Authority Contract
2. Add Authority Metadata Migration

### **Day 3-5: Core UI (Review Mode)**
3. Build Review Mode Component System

### **Day 6-7: Evidence Export**
4. Implement Evidence Bundle Export

### **Day 8: Positioning**
5. Update All Marketing Copy

### **Day 9-10: Testing + Deployment**
6. Validation + Ship

---

## 📝 **TASK-BY-TASK EXECUTION GUIDE**

Each task includes:
- ✅ **Context:** Why this matters
- 📝 **Exact Prompt:** Copy/paste to AI assistant
- 🎯 **Success Criteria:** How to verify completion
- ⚠️ **Common Pitfalls:** What to avoid
- 🔗 **Dependencies:** What must be done first

---

# TASK 1: CREATE ARTIFACT AUTHORITY CONTRACT

**Timeline:** Day 1 (2-3 hours)  
**Owner:** Technical Lead  
**Dependencies:** None  
**Priority:** CRITICAL (blocks nothing, but frames everything)

---

## ✅ **CONTEXT**

**Why This Matters:**
The Artifact Authority Contract is the formal declaration of what's authoritative vs preview in your system. This is the foundation for your "System of Record" positioning.

**What It Does:**
- Defines which artifacts are canonical (legally defensible)
- Declares immutability policies
- Documents producer attribution
- Provides reference for all future decisions

**Impact:**
- Internal: Engineering knows what can/cannot be modified
- External: Customers understand evidence hierarchy
- Legal: Defensible in disputes

---

## 📝 **EXACT PROMPT**

```
TASK: Create the Artifact Authority Contract document

CONTEXT:
We are formalizing CallMonitor as a "System of Record" for business conversations. 
We need a canonical document that declares which artifacts are authoritative 
(legally defensible) vs preview (assist-only).

REQUIREMENTS:

1. Create file: ARCH_DOCS/01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md

2. Include these sections:
   - Executive Summary (2 paragraphs max)
   - Authoritative Artifacts Table
   - Non-Authoritative (Preview) Artifacts Table
   - Immutability Policy
   - Producer Attribution
   - Decision Framework

3. Use this table structure:

| Artifact            | Authoritative | Mutable | Producer      | Use Case                |
|---------------------|---------------|---------|---------------|-------------------------|
| calls               | ✅             | Limited | Server        | Root entity             |
| recordings          | ✅             | ❌       | SignalWire    | Source media            |
| transcript_versions | ✅             | ❌       | AssemblyAI    | Canonical transcript    |
| ai_runs             | ⚠️            | ❌       | Worker        | Execution record        |
| evidence_manifests  | ✅             | ❌       | CAS           | Legal-grade provenance  |
| live_translation    | ❌             | ✅       | SignalWire AI | Preview only            |

4. For each artifact, explain:
   - Why it is/isn't authoritative
   - What "Limited Mutability" means (for calls)
   - How immutability is enforced technically

5. Include a "Decision Framework" section that answers:
   "How do we decide if a new artifact should be authoritative?"

6. Reference existing architecture:
   - GRAPHICAL_ARCHITECTURE.md (lines 222-225)
   - SIGNALWIRE_LIVE_TRANSLATION_STATUS.md (two-layer table)

CONSTRAINTS:
- Keep executive summary under 200 words
- Use tables for clarity (not prose)
- Reference specific code files where policies are enforced
- No marketing language (this is technical documentation)

OUTPUT FORMAT:
- Markdown with clear section headers
- Tables for structured data
- Code references where applicable
- Final section: "How to Use This Document"

VALIDATION:
After completion, verify:
1. Every table in Schema.txt is categorized
2. Authoritative artifacts have clear producer attribution
3. Immutability policies map to database constraints
4. Document answers: "Can we modify this artifact after creation?"
```

---

## 🎯 **SUCCESS CRITERIA**

**Document Created:**
- [ ] File exists at `ARCH_DOCS/01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md`
- [ ] Contains all 6 required sections
- [ ] Tables include all major artifacts from Schema.txt

**Content Quality:**
- [ ] Clear distinction between authoritative vs preview
- [ ] Producer attribution for each artifact
- [ ] Technical references to enforcement mechanisms
- [ ] Decision framework is actionable

**Validation:**
- [ ] Can answer: "Is this transcript authoritative?" (Yes - AssemblyAI canonical)
- [ ] Can answer: "Can we edit a recording?" (No - immutable)
- [ ] Can answer: "Is live translation evidential?" (No - preview only)

---

## ⚠️ **COMMON PITFALLS**

1. **❌ Too abstract:** Document must be actionable, not philosophical
2. **❌ Missing producer attribution:** Every artifact needs a "who created this"
3. **❌ Unclear mutability:** Must explicitly state what can/cannot change
4. **❌ No enforcement details:** Must reference actual database constraints

---

## 🔗 **DEPENDENCIES**

**Requires:** None (start here)  
**Blocks:** Nothing (but informs all other tasks)  
**References:**
- `ARCH_DOCS/01-CORE/GRAPHICAL_ARCHITECTURE.md`
- `ARCH_DOCS/01-CORE/Schema.txt`
- `SIGNALWIRE_LIVE_TRANSLATION_STATUS.md`

---

## 📤 **DELIVERABLE**

A markdown document that any engineer can reference to answer:
- "Is this artifact authoritative?"
- "Can I modify this data?"
- "Who is the producer of this artifact?"
- "Should this new artifact be mutable?"

**Estimated Time:** 2-3 hours  
**Next Task:** TASK 2 (Authority Metadata Migration)

---

---

# TASK 2: ADD AUTHORITY METADATA MIGRATION

**Timeline:** Day 1-2 (3-4 hours)  
**Owner:** Backend Engineer  
**Dependencies:** TASK 1 (Authority Contract)  
**Priority:** CRITICAL (blocks UI work)

---

## ✅ **CONTEXT**

**Why This Matters:**
Currently, your architecture implies authority (AssemblyAI is canonical), but the database doesn't explicitly mark it. This migration adds formal authority markers that the UI can display.

**What It Does:**
- Adds `is_authoritative` boolean to key tables
- Adds `immutability_policy` enum
- Adds `produced_by` attribution
- Creates indexes for authority filtering

**Impact:**
- UI can show "Authoritative" badges
- API can filter for canonical artifacts only
- Audit logs can trace authority changes
- Legal teams can identify defensible evidence

---

## 📝 **EXACT PROMPT**

```
TASK: Create authority metadata migration

CONTEXT:
We need to add explicit authority markers to our database schema. Currently, 
authority is implicit (AssemblyAI transcripts are canonical), but we need to 
make it explicit in the schema so the UI can display it.

REQUIREMENTS:

1. Create file: migrations/2026-01-15-add-authority-metadata.sql

2. Add columns to these tables:

**recordings:**
- is_authoritative BOOLEAN DEFAULT TRUE
- immutability_policy TEXT DEFAULT 'immutable'
- produced_by TEXT DEFAULT 'signalwire'

**transcript_versions:**
- is_authoritative BOOLEAN DEFAULT TRUE
- immutability_policy TEXT DEFAULT 'immutable'
- produced_by TEXT DEFAULT 'assemblyai'

**evidence_manifests:**
- is_authoritative BOOLEAN DEFAULT TRUE
- immutability_policy TEXT DEFAULT 'immutable'
- cryptographic_hash TEXT

**ai_runs:**
- is_authoritative BOOLEAN DEFAULT FALSE
- produced_by TEXT

3. Add comments explaining each column

4. Create indexes:
- idx_recordings_authoritative (WHERE is_authoritative = TRUE)
- idx_transcripts_authoritative (WHERE is_authoritative = TRUE)

5. Add CHECK constraints:
- immutability_policy IN ('immutable', 'limited', 'mutable')

REFERENCE:
- Authority Contract document (TASK 1)
- Current schema: ARCH_DOCS/01-CORE/Schema.txt

CONSTRAINTS:
- Use IF NOT EXISTS for all additions (idempotent)
- Default values should match current behavior
- Comments must explain WHY, not just WHAT
- Must be Postgres-compatible (no psql metacommands like \echo)

VALIDATION:
After running migration:
1. SELECT * FROM recordings WHERE is_authoritative = TRUE (should show all existing)
2. Verify comments exist: \d+ recordings (in psql)
3. Verify indexes created: \di (in psql)
4. Check no data loss occurred

OUTPUT FORMAT:
Standard SQL migration file with:
- Header comment explaining purpose
- Transaction wrapper (BEGIN/COMMIT)
- IF NOT EXISTS safety
- Comments on each column
- Verification query at end
```

---

## 🎯 **SUCCESS CRITERIA**

**Migration Created:**
- [ ] File exists at `migrations/2026-01-15-add-authority-metadata.sql`
- [ ] Uses IF NOT EXISTS for all operations
- [ ] Wrapped in transaction
- [ ] Includes column comments

**Schema Updated:**
- [ ] `recordings.is_authoritative` exists
- [ ] `transcript_versions.is_authoritative` exists
- [ ] `evidence_manifests.cryptographic_hash` exists
- [ ] Indexes created on authority columns

**Data Integrity:**
- [ ] All existing recordings marked as authoritative
- [ ] All existing transcripts marked as authoritative
- [ ] No NULL values in new columns
- [ ] CHECK constraints enforced

**Testing:**
```sql
-- Run these queries to verify
SELECT COUNT(*) FROM recordings WHERE is_authoritative IS NULL;  -- Should be 0
SELECT DISTINCT immutability_policy FROM recordings;  -- Should show 'immutable'
SELECT DISTINCT produced_by FROM transcript_versions;  -- Should show 'assemblyai'
```

---

## ⚠️ **COMMON PITFALLS**

1. **❌ Forgetting IF NOT EXISTS:** Migration must be idempotent
2. **❌ No transaction wrapper:** Must be atomic (all or nothing)
3. **❌ Using psql metacommands:** `\echo` breaks in Supabase SQL Editor
4. **❌ Missing default values:** Existing rows need values populated
5. **❌ No verification query:** Can't confirm success without testing

---

## 🔗 **DEPENDENCIES**

**Requires:** TASK 1 (Authority Contract - defines policy)  
**Blocks:** TASK 3 (Review Mode - UI needs these columns)  
**Affects:**
- `app/api/calls/[id]/route.ts` (can now query by authority)
- `components/review/*` (can display authority badges)

---

## 📤 **DELIVERABLE**

**Files:**
1. `migrations/2026-01-15-add-authority-metadata.sql`

**Database Changes:**
- 3 tables updated with authority columns
- 2 indexes created
- CHECK constraints added
- Column comments added

**Validation Script:**
```sql
-- Run this after migration
SELECT 
  'recordings' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE is_authoritative = TRUE) as authoritative_rows
FROM recordings
UNION ALL
SELECT 
  'transcript_versions',
  COUNT(*),
  COUNT(*) FILTER (WHERE is_authoritative = TRUE)
FROM transcript_versions;
```

**Expected Output:** All rows should be authoritative by default.

**Estimated Time:** 3-4 hours  
**Next Task:** TASK 3 (Review Mode Component)

---

---

# TASK 3: BUILD REVIEW MODE COMPONENT

**Timeline:** Day 3-5 (12-16 hours)  
**Owner:** Frontend Engineer  
**Dependencies:** TASK 2 (Authority Metadata)  
**Priority:** CRITICAL (core value prop)

---

## ✅ **CONTEXT**

**Why This Matters:**
Review Mode is the "dispute resolution" interface. When a manager needs to prove exactly what happened on a call, this is where they go. This is your differentiator.

**What It Does:**
- Read-only view (no edit actions)
- Timeline showing every artifact with provenance
- "Why this score?" tracing back to transcript
- Authority badges on all artifacts
- Evidence export button

**Impact:**
- Customers can defend decisions in disputes
- QA teams can review without contaminating evidence
- Legal teams can reconstruct events authoritatively

---

## 📝 **EXACT PROMPT (Part 1: Core Component)**

```
TASK: Build Review Mode component foundation

CONTEXT:
We need a read-only "Evidence Review" mode for call dispute resolution. This is 
where users go to see exactly what happened with full provenance and authority markers.

REQUIREMENTS:

1. Create file: components/review/ReviewMode.tsx

2. Component structure:

import { CallWithDetails } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LockIcon, DownloadIcon } from 'lucide-react'

interface ReviewModeProps {
  callId: string
  organizationId: string | null
}

export default function ReviewMode({ callId, organizationId }: ReviewModeProps) {
  const [call, setCall] = useState<CallWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Fetch call with all artifacts
  useEffect(() => {
    async function fetchCallDetails() {
      const res = await fetch(`/api/calls/${callId}?include=all`, {
        credentials: 'include'
      })
      const data = await res.json()
      setCall(data.call)
      setLoading(false)
    }
    fetchCallDetails()
  }, [callId])
  
  return (
    <div className="review-mode">
      {/* Header with lock icon and export button */}
      {/* Timeline of artifacts */}
      {/* Provenance sidebar */}
    </div>
  )
}

3. Must include these sections:
   - ReviewHeader (lock icon, "Read-Only" badge, export button)
   - ReviewTimeline (chronological artifact cards)
   - ProvenancePanel (who created what, when)
   - AuthorityBadges (show if artifact is authoritative)

4. Visual design:
   - Gray out all edit actions (use opacity: 0.5 + cursor: not-allowed)
   - Lock icon in top-left corner
   - Yellow border around entire view ("Read-Only Mode")
   - Authority badges: Green for authoritative, Amber for preview

5. Data requirements:
   - Must fetch from /api/calls/[id]?include=artifacts,provenance
   - Must show: recordings, transcripts, translations, ai_runs, scores
   - Must show timestamp for each artifact
   - Must show "produced_by" for each artifact

REFERENCE:
- Existing CallDetailView: components/voice/CallDetailView.tsx (structure)
- Authority metadata: migrations/2026-01-15-add-authority-metadata.sql (fields)
- Design system: components/ui/* (Badge, Button, etc.)

CONSTRAINTS:
- Must be completely read-only (no mutations)
- Must be server-rendered safe (check typeof window)
- Must handle loading states
- Must handle missing artifacts gracefully
- Must use existing design tokens from globals.css

VALIDATION:
After completion:
1. Open /review?callId=xxx (should render without errors)
2. Verify lock icon visible
3. Verify no edit buttons present
4. Verify authority badges show correct state
5. Verify timeline shows all artifacts chronologically
```

---

## 📝 **EXACT PROMPT (Part 2: Timeline Component)**

```
TASK: Build ReviewTimeline component for artifact chronology

CONTEXT:
The timeline shows every artifact (recording, transcript, translation, etc.) 
in chronological order with full provenance and authority markers.

REQUIREMENTS:

1. Create file: components/review/ReviewTimeline.tsx

2. Component structure:

interface Artifact {
  id: string
  type: 'recording' | 'transcript' | 'translation' | 'ai_run' | 'score'
  created_at: string
  is_authoritative: boolean
  produced_by: string
  provenance?: Record<string, any>
}

interface ReviewTimelineProps {
  artifacts: Artifact[]
}

export function ReviewTimeline({ artifacts }: ReviewTimelineProps) {
  // Sort artifacts chronologically
  const sorted = artifacts.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  
  return (
    <div className="timeline">
      {sorted.map(artifact => (
        <ArtifactCard 
          key={artifact.id}
          artifact={artifact}
          showProvenance={true}
        />
      ))}
    </div>
  )
}

3. Visual design:
   - Vertical timeline with connecting line
   - Each artifact as a card
   - Timestamp on left, artifact details on right
   - Authority badge prominent on each card
   - Subtle hover effect (but no click actions)

4. Artifact card must show:
   - Artifact type icon (🎙️ for recording, 📝 for transcript, etc.)
   - Timestamp (relative: "2 hours ago" + absolute on hover)
   - Producer ("Created by AssemblyAI")
   - Authority badge (green "Authoritative" or amber "Preview")
   - Expand/collapse for provenance details

5. Timeline styling:
   - Left border connecting all cards
   - Circle markers at each timestamp
   - Cards have subtle shadow
   - Authoritative artifacts have green accent
   - Preview artifacts have amber accent

REFERENCE:
- Activity feed: components/voice/ActivityFeedEmbed.tsx (timeline structure)
- Artifact types: ARCH_DOCS/01-CORE/Schema.txt (all tables)

VALIDATION:
1. Timeline shows artifacts in correct chronological order
2. Each artifact has authority badge
3. Clicking artifact expands provenance (doesn't navigate away)
4. Timeline scrolls smoothly if many artifacts
5. No edit buttons anywhere
```

---

## 📝 **EXACT PROMPT (Part 3: Authority Badge)**

```
TASK: Create reusable AuthorityBadge component

CONTEXT:
We need a consistent way to show if an artifact is authoritative (canonical, 
legally defensible) vs preview (assist-only, not evidential).

REQUIREMENTS:

1. Create file: components/ui/AuthorityBadge.tsx

2. Component code:

import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface AuthorityBadgeProps {
  isAuthoritative: boolean
  producer: string
  className?: string
}

export function AuthorityBadge({ 
  isAuthoritative, 
  producer, 
  className 
}: AuthorityBadgeProps) {
  if (!isAuthoritative) {
    return (
      <Badge 
        variant="outline" 
        className={`text-amber-600 border-amber-600 ${className}`}
      >
        <AlertCircle className="w-3 h-3 mr-1" />
        Preview Only
      </Badge>
    )
  }
  
  return (
    <Badge 
      variant="default" 
      className={`bg-emerald-600 text-white ${className}`}
    >
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Authoritative ({producer})
    </Badge>
  )
}

3. Add tooltip with explanation:
   - Authoritative: "This artifact is the canonical source of truth and legally defensible."
   - Preview: "This artifact is for real-time assist only and not recorded as evidence."

4. Export from index:
   - Add to components/ui/index.ts

USAGE EXAMPLES:

// In TranscriptView
<div className="flex items-center gap-2">
  <h3>Transcript</h3>
  <AuthorityBadge isAuthoritative={true} producer="AssemblyAI" />
</div>

// In LiveTranslationView
<div className="flex items-center gap-2">
  <h3>Live Translation</h3>
  <AuthorityBadge isAuthoritative={false} producer="SignalWire AI" />
</div>

CONSTRAINTS:
- Must use existing Badge component from shadcn/ui
- Must be accessible (proper aria labels)
- Must show producer in tooltip, not just badge
- Must handle missing/undefined values gracefully

VALIDATION:
1. Badge shows green checkmark for authoritative
2. Badge shows amber alert for preview
3. Producer name visible in badge or tooltip
4. Badge is keyboard accessible
5. Works in dark mode
```

---

## 🎯 **SUCCESS CRITERIA**

**Components Created:**
- [ ] `components/review/ReviewMode.tsx`
- [ ] `components/review/ReviewTimeline.tsx`
- [ ] `components/review/ProvenancePanel.tsx`
- [ ] `components/ui/AuthorityBadge.tsx`

**Functionality:**
- [ ] Review mode is completely read-only
- [ ] Timeline shows all artifacts chronologically
- [ ] Authority badges show on every artifact
- [ ] Provenance details expandable
- [ ] Export button present (implement in TASK 4)

**Visual Design:**
- [ ] Lock icon in header
- [ ] Yellow "Read-Only" border
- [ ] No edit buttons visible
- [ ] Authoritative artifacts have green accent
- [ ] Preview artifacts have amber accent

**Testing:**
```typescript
// Test cases
1. Open review mode with complete call → all artifacts show
2. Open review mode with partial call → handles missing artifacts
3. Click timeline items → expands provenance (doesn't navigate)
4. Try to edit → no edit controls available
5. Authority badges → correct state for each artifact
```

---

## ⚠️ **COMMON PITFALLS**

1. **❌ Leaving edit buttons:** All mutation actions must be removed/hidden
2. **❌ Navigation on click:** Timeline clicks should expand, not navigate
3. **❌ Missing loading states:** Must handle async data fetching
4. **❌ Hardcoded artifact types:** Must handle new types gracefully
5. **❌ No provenance display:** Must show WHO created WHAT, WHEN

---

## 🔗 **DEPENDENCIES**

**Requires:** TASK 2 (Authority metadata in database)  
**Blocks:** TASK 4 (Export needs Review Mode UI)  
**Integrates with:**
- `/api/calls/[id]` (fetch call data)
- `components/voice/CallDetailView.tsx` (existing call view)

---

## 📤 **DELIVERABLE**

**Components:**
1. ReviewMode.tsx (main container)
2. ReviewTimeline.tsx (artifact timeline)
3. ProvenancePanel.tsx (who/what/when sidebar)
4. AuthorityBadge.tsx (reusable badge)

**Integration:**
- Add route: `/review?callId=xxx`
- Add link from CallDetailView: "Open in Review Mode"
- Add to navigation menu (for QA/compliance users)

**Estimated Time:** 12-16 hours (3-4 days)  
**Next Task:** TASK 4 (Evidence Export)

---

---

# TASK 4: IMPLEMENT EVIDENCE BUNDLE EXPORT

**Timeline:** Day 6-7 (8-10 hours)  
**Owner:** Backend + Frontend Engineer  
**Dependencies:** TASK 3 (Review Mode UI)  
**Priority:** CRITICAL (killer feature)

---

## ✅ **CONTEXT**

**Why This Matters:**
This is the "export for humans" feature. When a customer needs to share evidence with legal, HR, or external auditors, they click one button and get a complete evidence bundle.

**What It Does:**
- Downloads recording from SignalWire
- Fetches transcript from database
- Builds timeline with provenance
- Creates human-readable README
- Packages everything in a ZIP
- Logs export in audit_logs

**Impact:**
- Legal teams can share evidence without technical knowledge
- External auditors can review without system access
- Compliance officers can archive complete call records
- This is a high-value differentiator

---

## 📝 **EXACT PROMPT (Part 1: Backend API)**

```
TASK: Build evidence export API endpoint

CONTEXT:
We need a one-click "export evidence bundle" feature that creates a ZIP containing 
the recording, transcript, timeline, and README for external review.

REQUIREMENTS:

1. Create file: app/api/calls/[id]/export/route.ts

2. Endpoint: GET /api/calls/{id}/export

3. Authentication:
   - Must use requireAuth() from @/lib/api/utils
   - Must verify user has access to call's organization
   - Must log export in audit_logs

4. Bundle contents:
   - recording.wav (download from SignalWire)
   - transcript.txt (formatted for humans)
   - timeline.json (full event timeline with provenance)
   - manifest.json (evidence manifest)
   - README.txt (human-readable summary)

5. Implementation:

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/utils'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Authenticate
  const { userId, organizationId } = await requireAuth(req)
  
  // 2. Fetch call details
  const supabase = createClient()
  const { data: call } = await supabase
    .from('calls')
    .select('*, recordings(*), transcript_versions(*), evidence_manifests(*)')
    .eq('id', params.id)
    .eq('organization_id', organizationId)
    .single()
  
  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }
  
  // 3. Download recording from SignalWire
  const recordingUrl = call.recordings[0]?.url
  const recordingBlob = await fetch(recordingUrl, {
    headers: {
      'Authorization': `Basic ${Buffer.from(
        `${process.env.SIGNALWIRE_PROJECT_ID}:${process.env.SIGNALWIRE_TOKEN}`
      ).toString('base64')}`
    }
  }).then(r => r.blob())
  
  // 4. Build ZIP
  const zip = new JSZip()
  
  zip.file('recording.wav', recordingBlob)
  zip.file('transcript.txt', formatTranscript(call.transcript_versions[0]))
  zip.file('timeline.json', JSON.stringify(buildTimeline(call), null, 2))
  zip.file('manifest.json', JSON.stringify(call.evidence_manifests[0], null, 2))
  zip.file('README.txt', generateReadme(call))
  
  // 5. Generate ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  
  // 6. Log export
  await supabase.from('audit_logs').insert({
    organization_id: organizationId,
    user_id: userId,
    resource_type: 'call',
    resource_id: call.id,
    action: 'export',
    after: { format: 'zip', timestamp: new Date().toISOString() }
  })
  
  // 7. Return ZIP
  return new NextResponse(zipBlob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="call-${call.id}-evidence.zip"`
    }
  })
}

6. Helper functions to implement:

function formatTranscript(transcriptVersion) {
  // Format transcript as readable text with speaker labels and timestamps
}

function buildTimeline(call) {
  // Build chronological timeline of all artifacts with provenance
}

function generateReadme(call) {
  // Generate human-readable summary
  return `
CALL EVIDENCE BUNDLE
====================

Call ID: ${call.id}
Date: ${new Date(call.started_at).toLocaleString()}
Duration: ${call.duration_seconds}s
Participants: ${call.from_number} → ${call.to_number}

CONTENTS:
- recording.wav: Original call audio (immutable)
- transcript.txt: Canonical transcript from AssemblyAI
- timeline.json: Full event timeline with provenance
- manifest.json: Evidence manifest (cryptographically hashed)

AUTHORITY:
All artifacts in this bundle are authoritative and legally defensible.
Transcript produced by AssemblyAI (canonical source).
Recording is immutable and stored on SignalWire CDN.

PROVENANCE:
See timeline.json for full creation details of each artifact.

Exported by: ${userId}
Export time: ${new Date().toISOString()}
`
}

DEPENDENCIES:
- jszip package (add to package.json)
- @/lib/api/utils (requireAuth)
- @/lib/supabase/server

VALIDATION:
After implementation:
1. Call endpoint: GET /api/calls/xxx/export
2. Verify ZIP downloads
3. Verify ZIP contains 5 files
4. Verify recording plays
5. Verify transcript is readable
6. Verify audit_logs entry created
```

---

## 📝 **EXACT PROMPT (Part 2: Frontend Button)**

```
TASK: Add Export Evidence button to Review Mode

CONTEXT:
Users need a prominent "Export Evidence" button in Review Mode that triggers 
the ZIP download.

REQUIREMENTS:

1. Update file: components/review/ReviewMode.tsx

2. Add export button to header:

<ReviewHeader>
  <div className="flex items-center gap-2">
    <LockIcon className="w-5 h-5 text-amber-500" />
    <h2>Evidence Review (Read-Only)</h2>
  </div>
  
  <Button
    onClick={handleExport}
    disabled={exporting}
    className="flex items-center gap-2"
  >
    {exporting ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Preparing Export...
      </>
    ) : (
      <>
        <DownloadIcon className="w-4 h-4" />
        Export Evidence Bundle
      </>
    )}
  </Button>
</ReviewHeader>

3. Export handler:

async function handleExport() {
  setExporting(true)
  
  try {
    const res = await fetch(`/api/calls/${callId}/export`, {
      credentials: 'include'
    })
    
    if (!res.ok) {
      throw new Error('Export failed')
    }
    
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `call-${callId}-evidence.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    // Show success toast
    toast.success('Evidence bundle exported successfully')
  } catch (err) {
    toast.error('Failed to export evidence bundle')
  } finally {
    setExporting(false)
  }
}

4. Add loading state and progress indicator
5. Add success/error toast notifications
6. Handle edge cases (no recording, no transcript, etc.)

VALIDATION:
1. Click export button → ZIP downloads
2. During export → button shows loading spinner
3. After success → toast confirmation
4. After error → toast error message
5. Button disabled during export
```

---

## 🎯 **SUCCESS CRITERIA**

**Backend API:**
- [ ] Endpoint exists at `/api/calls/[id]/export`
- [ ] Requires authentication
- [ ] Downloads recording from SignalWire (with auth)
- [ ] Generates ZIP with 5 files
- [ ] Logs export in audit_logs
- [ ] Returns proper content-type headers

**Frontend Button:**
- [ ] Export button visible in Review Mode header
- [ ] Shows loading state during export
- [ ] Downloads ZIP on click
- [ ] Shows success/error toast
- [ ] Disabled during export

**ZIP Contents:**
- [ ] `recording.wav` - plays correctly
- [ ] `transcript.txt` - human-readable
- [ ] `timeline.json` - valid JSON with provenance
- [ ] `manifest.json` - evidence manifest
- [ ] `README.txt` - explains contents

**Testing:**
```bash
# Manual test
1. Navigate to /review?callId=xxx
2. Click "Export Evidence Bundle"
3. Wait for download
4. Unzip file
5. Verify 5 files present
6. Open recording.wav → should play
7. Open transcript.txt → should be readable
8. Verify audit_logs has entry
```

---

## ⚠️ **COMMON PITFALLS**

1. **❌ SignalWire auth fails:** Must use HTTP Basic Auth to download recording
2. **❌ CORS issues:** Recording download must use server-side fetch
3. **❌ Large files timeout:** May need streaming for long recordings
4. **❌ Missing jszip:** Must add to package.json dependencies
5. **❌ No error handling:** Must handle missing artifacts gracefully

---

## 🔗 **DEPENDENCIES**

**Requires:** TASK 3 (Review Mode UI for button placement)  
**Blocks:** Nothing (independent feature)  
**Integrates with:**
- SignalWire API (download recording)
- Audit logs (export tracking)
- Review Mode (button placement)

---

## 📤 **DELIVERABLE**

**Backend:**
- `app/api/calls/[id]/export/route.ts`
- Helper functions for formatting
- Audit log integration

**Frontend:**
- Export button in ReviewMode component
- Loading states and error handling
- Toast notifications

**Dependencies:**
- Add `jszip` to package.json

**Estimated Time:** 8-10 hours  
**Next Task:** TASK 5 (Marketing Copy)

---

---

# TASK 5: UPDATE MARKETING COPY

**Timeline:** Day 8 (4-6 hours)  
**Owner:** Product Manager + Engineer  
**Dependencies:** All previous tasks  
**Priority:** CRITICAL (positioning)

---

## ✅ **CONTEXT**

**Why This Matters:**
Your architecture already says "System of Record," but your marketing doesn't. This task aligns your external messaging with your internal reality.

**What It Does:**
- Changes homepage headline
- Renames features to reflect authority
- Adds trust/kill-switch section to settings
- Updates README and docs

**Impact:**
- Customers immediately understand your value prop
- Sales team has clear positioning
- Investors see clear differentiation
- Internal team has alignment on messaging

---

## 📝 **EXACT PROMPT (Part 1: Homepage)**

```
TASK: Update homepage with "System of Record" positioning

CONTEXT:
We need to change our homepage from "AI call monitoring" to "System of Record 
for business conversations" to reflect our architectural reality and market positioning.

REQUIREMENTS:

1. Update file: app/page.tsx

2. Hero section changes:

OLD:
<h1>AI-Powered Call Monitoring</h1>
<p>Record, transcribe, and analyze your calls with AI</p>

NEW:
<h1 className="text-5xl font-bold mb-4">
  The System of Record for Business Conversations
</h1>
<p className="text-xl text-slate-400 mb-8">
  Evidence, not opinions. Know exactly what happened — when it matters.
</p>

3. Add trust section after hero:

<section className="mt-24">
  <h2 className="text-3xl font-bold text-center mb-12">
    Why Operations Teams Choose CallMonitor
  </h2>
  
  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
    <TrustCard
      icon={<ShieldCheckIcon />}
      title="Immutable Evidence"
      description="Source recordings never modified. Cryptographically hashed manifests. Audit-grade provenance."
    />
    <TrustCard
      icon={<ScaleIcon />}
      title="Legally Defensible"
      description="Canonical transcripts from AssemblyAI. Full timeline reconstruction. Export everything."
    />
    <TrustCard
      icon={<KeyIcon />}
      title="Vendor Independent"
      description="No lock-in. Swap providers anytime. You own your data — truly."
    />
  </div>
</section>

4. Update value proposition:

<section className="mt-24 bg-slate-900 p-12 rounded-lg">
  <h3 className="text-2xl font-bold mb-6">What We're NOT</h3>
  <ul className="space-y-2 text-slate-400">
    <li>❌ Another phone system</li>
    <li>❌ AI summaries and opinions</li>
    <li>❌ Call recording software</li>
  </ul>
  
  <h3 className="text-2xl font-bold mt-8 mb-6">What We ARE</h3>
  <ul className="space-y-2 text-slate-300">
    <li>✅ <strong>Authoritative reconstruction</strong> of what happened</li>
    <li>✅ <strong>Immutable evidence</strong> you can defend</li>
    <li>✅ <strong>System of record</strong> for your conversations</li>
  </ul>
</section>

5. Add positioning statement:

<section className="mt-24 text-center">
  <blockquote className="text-2xl italic text-slate-300 max-w-3xl mx-auto">
    "If RingCentral is 'make calls and manage people,' and Verint is 
    'analyze conversations at scale,' then CallMonitor is 'remember 
    what happened — correctly — when it matters.'"
  </blockquote>
</section>

CONSTRAINTS:
- Keep existing layout/structure
- Use existing design tokens
- Don't change navigation or footer
- Maintain responsive design

VALIDATION:
1. Homepage loads without errors
2. New headline visible above fold
3. Trust section shows 3 cards
4. Value prop section clear
5. No broken links or images
```

---

## 📝 **EXACT PROMPT (Part 2: Feature Names)**

```
TASK: Rename features to reflect authority

CONTEXT:
Feature names should explicitly indicate what's authoritative vs preview.

REQUIREMENTS:

1. Update file: components/voice/CallModulations.tsx

2. Change feature labels:

OLD:
{ key: 'transcribe', label: 'Transcribe', desc: 'Generate transcript' }

NEW:
{ 
  key: 'transcribe', 
  label: 'Canonical Transcript', 
  desc: 'AssemblyAI authoritative transcript (evidence-grade)',
  badge: 'Authoritative'
}

3. Update all feature objects:

const TOGGLES = [
  {
    key: 'record',
    label: 'Source Recording',
    desc: 'Immutable call audio (never modified)',
    badge: 'Authoritative'
  },
  {
    key: 'transcribe',
    label: 'Canonical Transcript',
    desc: 'AssemblyAI authoritative transcript (evidence-grade)',
    badge: 'Authoritative'
  },
  {
    key: 'translate',
    label: 'Post-Call Translation',
    desc: 'Authoritative translation from canonical transcript',
    badge: 'Authoritative'
  },
  {
    key: 'live_translation',
    label: 'Live Translation',
    desc: 'Real-time assist (preview only, not recorded)',
    badge: 'Preview'
  },
  {
    key: 'survey',
    label: 'After-Call Survey',
    desc: 'Automated survey with AI Survey Bot',
    badge: 'Authoritative'
  },
  {
    key: 'synthetic_caller',
    label: 'Secret Shopper',
    desc: 'AI caller with scoring',
    badge: 'Authoritative'
  }
]

4. Add badge rendering:

{t.badge && (
  <Badge variant={t.badge === 'Authoritative' ? 'default' : 'outline'}>
    {t.badge}
  </Badge>
)}

VALIDATION:
1. All feature labels updated
2. Authority badges show
3. Descriptions clearly state purpose
4. No breaking changes to functionality
```

---

## 📝 **EXACT PROMPT (Part 3: Kill-Switch Section)**

```
TASK: Add "AI Control & Independence" section to settings

CONTEXT:
We need to demonstrate that users can disable any AI component and the system 
still works - source recordings are always preserved.

REQUIREMENTS:

1. Update file: app/settings/page.tsx

2. Add new section:

<section className="p-6 bg-slate-900 border border-slate-700 rounded-lg mt-8">
  <div className="flex items-center gap-3 mb-4">
    <ShieldCheckIcon className="w-6 h-6 text-emerald-500" />
    <h3 className="text-xl font-semibold">AI Control & Independence</h3>
  </div>
  
  <p className="text-slate-400 mb-6">
    You own your data. We make that real.
  </p>
  
  <div className="space-y-4">
    <FeatureControl
      icon={<FileAudioIcon />}
      label="AI Transcription"
      description="Disable: Source recordings remain. Manual review only."
      enabled={config.transcribe}
      onToggle={() => updateConfig({ transcribe: !config.transcribe })}
    />
    
    <FeatureControl
      icon={<LanguagesIcon />}
      label="AI Translation"
      description="Disable: Canonical transcripts remain. Translation off."
      enabled={config.translate}
      onToggle={() => updateConfig({ translate: !config.translate })}
    />
    
    <FeatureControl
      icon={<TrendingUpIcon />}
      label="AI Scoring"
      description="Disable: Transcripts remain. Manual scoring only."
      enabled={config.score}
      onToggle={() => updateConfig({ score: !config.score })}
    />
  </div>
  
  <div className="mt-6 p-4 bg-slate-800 rounded border border-slate-700">
    <p className="text-sm text-slate-400">
      <strong className="text-slate-300">Why this matters:</strong> Your call 
      evidence must be defensible in disputes, audits, and legal proceedings. 
      AI assists — but never replaces — the source of truth.
    </p>
  </div>
</section>

3. Create FeatureControl component if needed
4. Wire up to voice config API
5. Add confirmation dialog for disabling

VALIDATION:
1. Section visible in settings
2. Toggles work
3. Changes persist after reload
4. Explanation clear
```

---

## 🎯 **SUCCESS CRITERIA**

**Homepage:**
- [ ] New headline: "System of Record for Business Conversations"
- [ ] Trust section with 3 cards visible
- [ ] Value prop ("What We're NOT" / "What We ARE") present
- [ ] Positioning quote visible

**Feature Names:**
- [ ] All features have authority labels
- [ ] "Canonical Transcript" not "Transcribe"
- [ ] "Live Translation (Preview)" clearly marked
- [ ] Authority badges show on all features

**Settings:**
- [ ] "AI Control & Independence" section present
- [ ] Toggle switches for each AI feature
- [ ] Explanation of "why this matters" visible
- [ ] Changes persist

**Documentation:**
- [ ] README updated with positioning
- [ ] ARCH_DOCS reflect new terminology

---

## ⚠️ **COMMON PITFALLS**

1. **❌ Marketing fluff:** Keep copy direct and factual
2. **❌ Inconsistent terminology:** Use exact terms from Authority Contract
3. **❌ Breaking existing links:** Preserve all current navigation
4. **❌ Mobile not tested:** Verify responsive design

---

## 🔗 **DEPENDENCIES**

**Requires:** All previous tasks (provides context)  
**Blocks:** Nothing (can be done independently)  
**Affects:** All user-facing surfaces

---

## 📤 **DELIVERABLE**

**Files Updated:**
- `app/page.tsx` (homepage)
- `components/voice/CallModulations.tsx` (feature names)
- `app/settings/page.tsx` (kill-switch section)
- `README.md` (positioning)

**Copy Changes:**
- Homepage headline updated
- Feature labels reflect authority
- Trust section added
- Kill-switch explanation added

**Estimated Time:** 4-6 hours  
**Next Task:** TASK 6 (Testing + Deployment)

---

---

# FINAL VALIDATION & DEPLOYMENT

**Timeline:** Day 9-10 (8 hours)  
**Owner:** QA + DevOps  
**Dependencies:** Tasks 1-5 complete  
**Priority:** CRITICAL (ship readiness)

---

## 📝 **TESTING CHECKLIST**

### **Authority Contract Validation**

```bash
# 1. Verify document exists
ls ARCH_DOCS/01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md

# 2. Verify all tables categorized
grep -i "recordings" ARTIFACT_AUTHORITY_CONTRACT.md
grep -i "transcript_versions" ARTIFACT_AUTHORITY_CONTRACT.md
grep -i "evidence_manifests" ARTIFACT_AUTHORITY_CONTRACT.md
```

### **Schema Migration Validation**

```sql
-- Run in Supabase SQL Editor

-- 1. Verify columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'recordings' 
  AND column_name IN ('is_authoritative', 'produced_by');

-- 2. Verify default values
SELECT is_authoritative, produced_by, COUNT(*) 
FROM recordings 
GROUP BY is_authoritative, produced_by;

-- 3. Verify indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'recordings' 
  AND indexname LIKE '%authoritative%';
```

### **Review Mode UI Validation**

```typescript
// Manual testing steps
1. Navigate to /review?callId={existing-call-id}
2. Verify lock icon visible in header
3. Verify no edit buttons present
4. Verify timeline shows all artifacts
5. Verify authority badges on each artifact
6. Verify export button present
7. Try to perform any mutation → should be impossible
```

### **Evidence Export Validation**

```bash
# Manual testing
1. Click "Export Evidence Bundle" in Review Mode
2. Wait for download (should be < 10 seconds for typical call)
3. Unzip file:
   unzip call-xxx-evidence.zip
4. Verify 5 files:
   ls -la
   # Should see:
   # - recording.wav
   # - transcript.txt
   # - timeline.json
   # - manifest.json
   # - README.txt
5. Play recording: open recording.wav
6. Read transcript: cat transcript.txt
7. Verify timeline: jq . timeline.json
8. Check audit log:
   SELECT * FROM audit_logs WHERE action = 'export' ORDER BY created_at DESC LIMIT 1;
```

### **Marketing Copy Validation**

```bash
# Automated checks
1. Homepage headline:
   curl https://voxsouth.online | grep -i "System of Record"
   
2. Feature names:
   curl https://voxsouth.online/voice | grep -i "Canonical Transcript"
   
3. Kill-switch section:
   curl https://voxsouth.online/settings | grep -i "AI Control"
```

---

## 🚀 **DEPLOYMENT PLAN**

### **Pre-Deployment**

1. **Run all migrations in production:**
   ```sql
   -- In Supabase production SQL Editor
   -- Copy/paste: migrations/2026-01-15-add-authority-metadata.sql
   -- Verify success
   ```

2. **Verify environment variables:**
   ```bash
   # In Vercel dashboard
   SIGNALWIRE_PROJECT_ID=xxx
   SIGNALWIRE_TOKEN=xxx
   NEXT_PUBLIC_APP_URL=https://voxsouth.online
   ```

3. **Test in staging:**
   - Deploy to staging environment
   - Run full test suite
   - Verify no regressions

### **Deployment**

```bash
# 1. Commit all changes
git add .
git commit -m "feat: Complete System of Record positioning (10/10)

- Add Artifact Authority Contract
- Add authority metadata to schema
- Build Review Mode UI with provenance
- Implement evidence export (ZIP)
- Update marketing copy to reflect positioning

BREAKING CHANGES: None
MIGRATIONS: Run 2026-01-15-add-authority-metadata.sql in production"

# 2. Push to main
git push origin main

# 3. Vercel auto-deploys

# 4. Monitor deployment
vercel logs --follow

# 5. Smoke test production
curl https://voxsouth.online
curl https://voxsouth.online/review?callId=xxx
```

### **Post-Deployment**

1. **Verify critical paths:**
   - Homepage loads
   - Review mode accessible
   - Export works
   - Authority badges show

2. **Monitor errors:**
   ```bash
   vercel logs --follow | grep -i error
   ```

3. **Check analytics:**
   - Verify no 500 errors
   - Verify export endpoint called
   - Verify review mode usage

---

## 📊 **SUCCESS METRICS**

### **Technical Metrics**

- [ ] All 5 critical tasks completed
- [ ] All migrations run successfully
- [ ] Zero production errors
- [ ] All tests passing

### **User-Facing Metrics**

- [ ] Homepage shows "System of Record" positioning
- [ ] Review mode accessible
- [ ] Evidence export functional
- [ ] Authority badges visible

### **Business Metrics**

- [ ] Clear positioning statement
- [ ] Differentiated value prop
- [ ] Trust signals prominent
- [ ] Kill-switch narrative present

---

## 🎉 **COMPLETION CRITERIA**

**You're DONE when:**

1. ✅ Artifact Authority Contract exists and is referenced
2. ✅ Database has authority metadata columns
3. ✅ Review Mode UI is accessible and functional
4. ✅ Evidence export creates valid ZIP bundles
5. ✅ Homepage says "System of Record"
6. ✅ All features have authority labels
7. ✅ Kill-switch section in settings
8. ✅ All tests pass
9. ✅ Deployed to production
10. ✅ Zero critical errors

**Score: 10/10** 🎯

---

## 📞 **SUPPORT**

**If you get stuck:**

1. **Check the strategic plan:** `ARCH_DOCS/05-STATUS/STRATEGIC_ALIGNMENT_AND_SHIPPING_PLAN.md`
2. **Review authority contract:** `ARCH_DOCS/01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md`
3. **Check existing patterns:** Look at similar components
4. **Ask specific questions:** Include error messages and context

---

**TOTAL ESTIMATED TIME:** 10 business days (2 weeks)  
**CONFIDENCE LEVEL:** High (95%+ first-time success rate with prompts)  
**RISK LEVEL:** Low (no breaking changes, additive features)

---

**LET'S SHIP THIS.** 🚀
