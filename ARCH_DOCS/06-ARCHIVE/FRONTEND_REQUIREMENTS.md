# Frontend Requirements for Voice Operations UI

**Authority:** ARCH_DOCS (UX_DESIGN_PRINCIPLES.txt v2.0, MASTER_ARCHITECTURE.txt)  
**Page:** `/voice-operations` (single page, no tool tabs)  
**Status:** Basic structure exists, needs completion

---

## Core Architecture Principles

1. **Single-Page Design** - All voice features on one page, no separate tool pages
2. **Call-Rooted** - Everything revolves around calls and their modulations
3. **No Tool Sprawl** - Modulations are toggles, not separate tools
4. **RBAC & Plan Gating** - Features hidden/disabled based on role and plan
5. **Real-time Updates** - Live status updates via Supabase subscriptions

---

## Required UI Components

### 1. Page Layout (`app/voice/page.tsx`)

**Current Status:** ✅ Basic structure exists

**Required Sections:**

```
┌───────────────────────────────────────────────────────────────┐
│ HEADER: CallMonitor – Voice Operations                        │
│ Org: [Org Name]   Plan: [Plan]   [Upgrade]                    │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐┌───────────────────────────────────┐
│ LEFT RAIL (25%)            ││ MAIN AREA (50%)                  │
│ • Call List                ││ • Selected Call Detail           │
│ • Filters                  ││ • Modulations                    │
│ • Search                   ││ • Artifacts                      │
└─────────────────────────────┘└───────────────────────────────────┘
                               ┌───────────────────────────────────┐
                               │ RIGHT RAIL (25%)                 │
                               │ • Activity Feed                   │
                               │ • Real-time Events                │
                               └───────────────────────────────────┘
```

---

### 2. Header Component

**File:** `components/voice/VoiceHeader.tsx` (create)

**Requirements:**
- Display organization name
- Display current plan
- "Upgrade" button (if not on highest plan)
- User menu/logout
- RBAC context display (role indicator)

**API Integration:**
- `GET /api/rbac/context` - Get role and plan
- Plan upgrade link (external or modal)

---

### 3. Call List Component

**File:** `components/voice/CallList.tsx`  
**Status:** ✅ Exists, needs enhancement

**Required Features:**

1. **Call List Display**
   - Call ID/Number
   - Status badge (ringing, completed, failed, no-answer, busy)
   - Duration (if completed)
   - Timestamp (started_at)
   - Score badge (if scored)
   - Click to select call

2. **Filters**
   - Status filter (all, active, completed, failed)
   - Date range filter
   - Score filter (min score)
   - Search by phone number

3. **Sorting**
   - By date (newest first - default)
   - By score (highest first)
   - By duration

4. **Pagination**
   - Load more / infinite scroll
   - Page size: 20-50 calls

5. **Real-time Updates**
   - Use `useRealtime` hook
   - Highlight new/updated calls
   - Auto-refresh active calls

**API Integration:**
- `GET /api/calls?orgId=...&status=...&page=...` (may need to create)
- Real-time subscription via `useRealtime` hook

**Accessibility:**
- Keyboard navigation (arrow keys, Enter to select)
- ARIA labels for status badges
- Screen reader announcements for new calls

---

### 4. Call Detail View (Main Area)

**File:** `components/voice/CallDetailView.tsx` (create)

**Required Sections:**

#### A. Call Header
- Call ID/Number
- Status with visual indicator
- Duration (live timer for active calls)
- Score (if available)
- Timestamp

#### B. Quick Actions
- Play Recording button (if recording exists)
- View Transcript button
- View Evidence Manifest button
- Export button

#### C. Modulations Panel
- **Recording Toggle**
  - Enable/disable recording
  - Show recording status (pending, completed, failed)
  - Link to recording player
  
- **Transcription Toggle**
  - Enable/disable transcription
  - Show transcription status (queued, processing, completed)
  - Link to transcript view
  
- **Translation Toggle** (plan: Global+)
  - Enable/disable translation
  - Language selectors (from/to)
  - Show translation status
  - Link to translated transcript
  
- **Survey Toggle** (plan: Insights+)
  - Enable/disable survey
  - Survey selector dropdown
  - Show survey status
  - Link to survey results
  
- **Secret Shopper Toggle** (plan: Insights+)
  - Enable/disable secret shopper mode
  - Script selector/editor
  - Show scoring status
  - Link to shopper results

**Plan Gating:**
- Disabled toggles show upgrade tooltip
- "This feature requires [Plan] plan" message
- Upgrade button/link

**API Integration:**
- `GET /api/voice/config?orgId=...` - Get current config
- `PUT /api/voice/config` - Update modulations
- `GET /api/surveys?orgId=...` - List surveys
- `GET /api/shopper/scripts?orgId=...` - List scripts

---

### 5. Artifact Viewer

**File:** `components/voice/ArtifactViewer.tsx` (create)

**Required Tabs/Sections:**

#### A. Recording Player
- Audio player with controls
- Play/Pause/Stop
- Seek bar
- Volume control
- Download button
- Duration display
- **Accessibility:** Full keyboard controls

**API Integration:**
- `GET /api/recordings/:id` - Get recording with signed URL
- Use `getRecordingSignedUrl` service

#### B. Transcript View
- Full transcript text
- Word-level timestamps (if available)
- Speaker labels (if available)
- Confidence scores
- Copy to clipboard
- Export as text/JSON

**Data Source:**
- `recordings.transcript_json` from selected call

#### C. Translation View (if enabled)
- Original transcript
- Translated transcript
- Language indicators
- Side-by-side or toggle view

**Data Source:**
- `ai_runs` table with `model='assemblyai-translation'`

#### D. Survey Results (if enabled)
- Survey questions
- Responses (DTMF or voice)
- Sentiment analysis
- Score breakdown

**Data Source:**
- `evidence_manifests.manifest.survey_results`

#### E. Evidence Manifest
- Complete manifest JSON
- All artifacts linked
- Provenance metadata
- Export as JSON
- Download as file

**Data Source:**
- `evidence_manifests` table

#### F. Scores
- Auto-score breakdown
- Manual overrides
- Scorecard criteria
- Visual scorecard

**Data Source:**
- `scored_recordings` table
- `evidence_manifests.manifest.scoring`

---

### 6. Target & Campaign Selector

**File:** `components/voice/TargetCampaignSelector.tsx` (create)

**Required Features:**

1. **Target Number Selector**
   - Dropdown/autocomplete
   - List from `/api/voice/targets`
   - Add new target button (opens modal)
   - Display: phone number + name

2. **Campaign Selector** (optional)
   - Dropdown
   - List from `/api/campaigns`
   - "None" option
   - Add new campaign button

3. **Save Configuration Button**
   - Saves to `voice_configs`
   - Shows success/error toast
   - Updates UI state

**API Integration:**
- `GET /api/voice/targets?orgId=...`
- `GET /api/campaigns?orgId=...`
- `PUT /api/voice/config` - Save selection

**RBAC:**
- Only Owner/Admin can save configuration
- Operator/Analyst/Viewer: read-only

---

### 7. Execution Controls

**File:** `components/voice/ExecutionControls.tsx` (create)

**Required Features:**

1. **Place Call Button**
   - Primary action button
   - Disabled if no target selected
   - Loading state during execution
   - Success/error feedback

2. **Call Status Display**
   - Live status for active calls
   - "Calling..." → "Ringing" → "In Progress" → "Completed"
   - Duration timer (live)
   - Error messages if failed

3. **Real-time Status Updates**
   - Use `useRealtime` hook
   - Polling fallback
   - Optimistic UI updates

**API Integration:**
- `POST /api/voice/call` - Execute call
- Real-time subscription for status updates

**RBAC:**
- Only Owner/Admin/Operator can place calls
- Analyst/Viewer: button hidden

**Accessibility:**
- Keyboard accessible (Enter/Space)
- Loading state announced to screen readers
- Error messages in live region

---

### 8. Activity Feed

**File:** `components/voice/ActivityFeedEmbed.tsx`  
**Status:** ✅ Exists, needs enhancement

**Required Features:**

1. **Event List**
   - Call started
   - Call completed/failed
   - Recording available
   - Transcription completed
   - Translation completed
   - Survey completed
   - Score calculated

2. **Event Display**
   - Timestamp
   - Event type icon
   - Event description
   - Click to jump to related call
   - Status indicators

3. **Real-time Updates**
   - New events appear automatically
   - Visual highlight for new events
   - Auto-scroll to latest (optional)

4. **Filtering**
   - Filter by event type
   - Filter by time range
   - Clear filters

**Data Source:**
- `audit_logs` table
- Real-time subscription via `useRealtime`

**Accessibility:**
- ARIA live region for new events
- Keyboard navigation
- Screen reader announcements

---

### 9. Modulation Toggles Component

**File:** `components/voice/ModulationToggles.tsx` (create or enhance `CallModulations.tsx`)

**Required Toggles:**

1. **Recording Toggle**
   ```tsx
   <Toggle
     id="record-audio"
     checked={config.record}
     disabled={!canEnableRecording}
     onCheckedChange={handleToggle}
   />
   <Label htmlFor="record-audio">Record audio</Label>
   {!canEnableRecording && (
     <Tooltip>Recording requires Pro plan or higher</Tooltip>
   )}
   ```

2. **Transcription Toggle**
   - Similar structure
   - Plan: Pro+
   - Shows transcription status

3. **Translation Toggle**
   - Plan: Global+
   - Language selectors (from/to) when enabled
   - Validation: both languages required

4. **Survey Toggle**
   - Plan: Insights+
   - Survey selector when enabled
   - Shows survey status

5. **Secret Shopper Toggle**
   - Plan: Insights+
   - Script selector/editor when enabled
   - Forces recording + transcription ON
   - Shows scoring status

**RBAC Integration:**
- Use `useRBAC` hook
- Use `usePermission` hook
- Check plan support
- Show upgrade prompts

**API Integration:**
- `PUT /api/voice/config` - Save toggle states
- Validate before save
- Show error messages

---

### 10. Real-time Integration

**File:** `hooks/useRealtime.ts`  
**Status:** ✅ Exists

**Required Usage:**

```tsx
const { updates, connected } = useRealtime(organizationId)

useEffect(() => {
  // Process updates
  updates.forEach(update => {
    if (update.table === 'calls') {
      // Update call status
    }
    if (update.table === 'recordings') {
      // Update recording availability
    }
    if (update.table === 'ai_runs') {
      // Update transcription/translation status
    }
  })
}, [updates])
```

**Fallback:**
- Use `usePolling` hook if real-time fails
- Poll every 5 seconds for active calls
- Poll every 30 seconds for completed calls

---

## Required Hooks

### 1. `hooks/useRBAC.ts`
**Status:** ✅ Exists

**Usage:**
```tsx
const { role, plan, loading } = useRBAC(organizationId)
const canPlaceCall = usePermission(organizationId, 'call', 'execute')
```

### 2. `hooks/useRealtime.ts`
**Status:** ✅ Exists

**Usage:**
```tsx
const { updates, connected } = useRealtime(organizationId)
```

### 3. `hooks/useVoiceConfig.ts` (create)

**Purpose:** Fetch and update voice configuration

```tsx
const { config, loading, updateConfig } = useVoiceConfig(organizationId)
```

### 4. `hooks/useCallDetails.ts` (create)

**Purpose:** Fetch call details with all artifacts

```tsx
const { call, recording, transcript, manifest, loading } = useCallDetails(callId)
```

---

## Required UI Components (from shadcn/ui or custom)

1. **Button** - ✅ Exists (`components/ui/button.tsx`)
2. **Switch/Toggle** - ✅ Exists (`components/ui/switch.tsx`)
3. **Label** - ✅ Exists (`components/ui/label.tsx`)
4. **Tooltip** - ✅ Exists (`components/ui/tooltip.tsx`)
5. **Select/Dropdown** - Need to add
6. **Input** - Need to add
7. **Badge** - Need to add
8. **Card** - Need to add
9. **Tabs** - Need to add (for artifact viewer)
10. **Dialog/Modal** - Need to add
11. **Toast** - ✅ Exists (`components/ui/use-toast.tsx`)

---

## Accessibility Requirements (WCAG 2.2 Level AA)

### Perceivable
- [ ] Color contrast ≥ 4.5:1 for text
- [ ] All icons have `aria-label`
- [ ] Audio player has keyboard controls
- [ ] Transcript link near audio player

### Operable
- [ ] Full keyboard navigation
- [ ] Visible focus indicators (≥2px)
- [ ] No keyboard traps
- [ ] Logical tab order

### Understandable
- [ ] All toggles have visible labels
- [ ] Error messages are clear
- [ ] Help text/tooltips for complex features
- [ ] Consistent navigation

### Robust
- [ ] All interactive elements have accessible names
- [ ] Status messages in live regions
- [ ] Screen reader testing completed

**Reference:** `ARCH_DOCS/UX_DESIGN_PRINCIPLES.txt` (accessibility section)

---

## API Endpoints Required (All ✅ Implemented)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/voice/targets` | GET | List voice targets | ✅ |
| `/api/campaigns` | GET | List campaigns | ✅ |
| `/api/surveys` | GET | List surveys | ✅ |
| `/api/shopper/scripts` | GET | List shopper scripts | ✅ |
| `/api/voice/config` | GET | Get voice config | ✅ |
| `/api/voice/config` | PUT | Update voice config | ✅ |
| `/api/voice/call` | POST | Execute call | ✅ |
| `/api/rbac/context` | GET | Get RBAC context | ✅ |
| `/api/realtime/subscribe` | POST | Get real-time config | ✅ |

**Note:** May need to add:
- `GET /api/calls?orgId=...` - List calls with filters/pagination
- `GET /api/recordings/:id` - Get recording with signed URL
- `GET /api/evidence/:id` - Get evidence manifest

---

## State Management

**Recommended Approach:**
- React Server Components for initial data
- Client Components for interactivity
- React hooks for state (`useState`, `useEffect`)
- Server Actions for mutations
- Real-time subscriptions for updates

**No need for:**
- Redux/Zustand (simple state management sufficient)
- Complex state management libraries

---

## Component Structure

```
components/voice/
├── VoiceHeader.tsx              (create)
├── CallList.tsx                 (✅ exists, enhance)
├── CallDetailView.tsx           (create)
├── CallModulations.tsx          (✅ exists, enhance)
├── ModulationToggles.tsx        (create or enhance CallModulations)
├── TargetCampaignSelector.tsx   (create)
├── ExecutionControls.tsx        (create)
├── ArtifactViewer.tsx           (create)
│   ├── RecordingPlayer.tsx      (create or enhance AudioPlayer)
│   ├── TranscriptView.tsx       (create)
│   ├── TranslationView.tsx     (create)
│   ├── SurveyResults.tsx        (create)
│   ├── EvidenceManifestView.tsx (create or enhance EvidenceManifestSummary)
│   └── ScoreView.tsx            (create)
├── ActivityFeedEmbed.tsx        (✅ exists, enhance)
└── ClientVoiceShell.tsx         (✅ exists, enhance)
```

---

## Implementation Priority

### Phase 1: Core Functionality (Week 1)
1. ✅ Page layout structure (exists)
2. ⚠️ Call List with filters and real-time updates
3. ⚠️ Call Detail View with basic info
4. ⚠️ Modulation toggles with RBAC
5. ⚠️ Execution controls (Place Call button)

### Phase 2: Artifacts (Week 2)
6. ⚠️ Recording player
7. ⚠️ Transcript viewer
8. ⚠️ Evidence manifest viewer
9. ⚠️ Activity feed with real-time

### Phase 3: Advanced Features (Week 3)
10. ⚠️ Translation viewer
11. ⚠️ Survey results viewer
12. ⚠️ Score visualization
13. ⚠️ Target/Campaign selector
14. ⚠️ Accessibility enhancements

---

## Testing Requirements

- [ ] Component unit tests
- [ ] Integration tests for user flows
- [ ] Accessibility testing (keyboard, screen reader)
- [ ] Visual regression tests
- [ ] Cross-browser testing

---

## Design System

**Colors:**
- Background: `slate-950` (dark theme)
- Text: `slate-100`
- Accent: Brand colors
- Status: Green (success), Red (error), Yellow (warning)

**Typography:**
- Headings: System font, bold
- Body: System font, regular
- Monospace: For call IDs, timestamps

**Spacing:**
- Consistent padding/margins
- Responsive breakpoints

---

## Summary

**Total Components Needed:** ~15 components
**Existing Components:** 6 (need enhancement)
**New Components:** 9
**Hooks Needed:** 2 additional hooks
**APIs:** All backend APIs ready ✅

**Estimated Effort:** 2-3 weeks for complete implementation

---

**Next Steps:**
1. Review existing components
2. Create missing components
3. Integrate RBAC and real-time
4. Add accessibility features
5. Test and polish
