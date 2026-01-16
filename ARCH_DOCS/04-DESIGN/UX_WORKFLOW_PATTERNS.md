# UX Workflow Patterns

**Version:** 1.0.0  
**Updated:** 2026-01-15  
**Status:** Active

## Overview

This document defines the UX workflow patterns implemented in Word Is Bond to ensure efficient, intuitive user journeys. These patterns work in conjunction with the Design System and UX Design Principles.

---

## Core Patterns

### 1. Unified Navigation (AppShell)

All authenticated pages use the `AppShell` component for consistent navigation.

**Location:** `components/layout/AppShell.tsx`

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar (Desktop)              │  Main Content              │
│ ┌─────────────────────────────┐│                            │
│ │ Logo + Org Name             ││  Page Header               │
│ │                             ││  ─────────────────────     │
│ │ Navigation                  ││                            │
│ │ • Overview                  ││  Page Content              │
│ │ • Calls (Primary)           ││                            │
│ │ • Schedule                  ││                            │
│ │ • Evidence                  ││                            │
│ │ • Settings                  ││                            │
│ │                             ││                            │
│ │ User Section                ││                            │
│ │ email@example.com [Logout]  ││                            │
│ └─────────────────────────────┘│                            │
└─────────────────────────────────────────────────────────────┘
```

**Navigation Items:**
| Route | Label | Icon | Priority |
|-------|-------|------|----------|
| `/dashboard` | Overview | Home | Secondary |
| `/voice` | Calls | Phone | **Primary** |
| `/bookings` | Schedule | Calendar | Secondary |
| `/review` | Evidence | Document | Secondary |
| `/settings` | Settings | Gear | Secondary |

**Mobile:** Collapses to hamburger menu with same navigation.

---

### 2. First-Time User Onboarding

New users (no previous calls) see the `OnboardingWizard` instead of the main Voice interface.

**Location:** `components/voice/OnboardingWizard.tsx`

**Flow:**
```
Step 1: Who to call?
├── Phone number (E.164)
└── Name (optional)
    ↓
Step 2: Your number (optional)
├── For bridge calls
└── Can skip for direct calls
    ↓
Step 3: Call Options
├── Record (default: on)
└── Transcribe (default: on)
    ↓
Step 4: Confirm
└── [Place Call] → Exits wizard, places call
```

**Skip:** Users can skip onboarding at any time to access full interface.

---

### 3. Progressive Disclosure

Call options are hidden by default to reduce cognitive load.

**Location:** `components/voice/VoiceOperationsClient.tsx`

**Pattern:**
```
┌─────────────────────────────────┐
│ Call Options                    │
│ Recording, transcription...  ▼  │  ← Click to expand
└─────────────────────────────────┘

Expanded:
┌─────────────────────────────────┐
│ Call Options                  ▲ │
├─────────────────────────────────┤
│ ○ Record        [Authoritative] │
│ ○ Transcribe    [Authoritative] │
│ ○ Translate     [Authoritative] │
│ ○ Survey        [Preview]       │
│ ○ Secret Shopper [Preview]      │
└─────────────────────────────────┘
```

**Default State:** Collapsed (uses organization defaults)

---

### 4. Recent Targets Quick Access

Recent call targets are shown for one-click dialing.

**Location:** `components/voice/RecentTargets.tsx`

**Pattern:**
```
┌─────────────────────────────────────┐
│ RECENT                    +2 more   │
├─────────────────────────────────────┤
│ [📞] +1 (555) 123-4567      2m ago  │
│      Main Support           3 calls │
│                                  →  │
├─────────────────────────────────────┤
│ [📞] +1 (555) 987-6543     1d ago   │
│      Sales Queue            1 call  │
│                                  →  │
└─────────────────────────────────────┘
```

**Behavior:** Click selects target and auto-fills the phone input.

---

### 5. Active Call Status Panel

When a call is active, a prominent status panel replaces the "Place Call" button.

**Location:** `components/voice/ActiveCallPanel.tsx`

**States:**
```
┌─────────────────────────────────────┐
│ ◉ Call Active                       │  ← Animated indicator
│   Ringing                    [⏱]    │
├─────────────────────────────────────┤
│ Calling:    +1 (555) 123-4567       │
│ Call ID:    abc123... [📋]          │
├─────────────────────────────────────┤
│ [View Details] [End]                │
└─────────────────────────────────────┘

After call completes:
┌─────────────────────────────────────┐
│ ○ Call Completed                    │
│   Duration: 3:42                    │
├─────────────────────────────────────┤
│ [View Details] [New Call]           │
└─────────────────────────────────────┘
```

---

### 6. Evidence Review Access

Completed calls show "Review Evidence" button for read-only evidence view.

**Location:** `components/voice/CallDetailView.tsx`

**Pattern:**
```
┌─────────────────────────────────────┐
│ Call Details                        │
│ Status: [Completed]                 │
│ Duration: 5:23                      │
├─────────────────────────────────────┤
│ [🔒 Review Evidence] [Recording]    │  ← Primary action
│ [Transcript] [Analytics] [Manifest] │
└─────────────────────────────────────┘
```

**Link:** Goes to `/review?callId=xxx`

---

### 7. Settings Organization

Settings are organized by job-to-be-done, not feature name.

**Location:** `app/settings/page.tsx`

**Tab Structure:**
| Tab | Contains | Purpose |
|-----|----------|---------|
| **Call Configuration** | Targets + Caller ID | "Set up calls" |
| **AI & Intelligence** | AI Control + Surveys | "Configure AI features" |
| **Quality Assurance** | Secret Shopper | "Quality testing" |
| **Team & Access** | Team Management | "Manage people" |
| **Billing** | Plan + Payment | "Manage subscription" |

---

## Mobile Patterns

### Bottom Navigation

Mobile uses bottom tab navigation with 4 items:

```
┌─────────────────────────────────────┐
│                                     │
│          Content Area               │
│                                     │
├─────────────────────────────────────┤
│ [📞 Dial] [📋 Calls] [🔔 Activity] [+ Schedule] │
└─────────────────────────────────────┘
```

### Collapsible Sections

On mobile, secondary content uses `<details>` elements:

```html
<details>
  <summary>Call Options</summary>
  <div>...options content...</div>
</details>
```

---

## State Management

### Voice Configuration Context

All voice-related settings are managed through `VoiceConfigProvider`:

```tsx
<VoiceConfigProvider organizationId={orgId}>
  <VoiceOperationsClient />
</VoiceConfigProvider>
```

### Real-time Updates

Active call status updates via `useRealtime` hook:

```tsx
const { updates, connected } = useRealtime(organizationId)

useEffect(() => {
  updates.forEach((update) => {
    if (update.table === 'calls' && update.new?.id === activeCallId) {
      setActiveCallStatus(update.new.status)
    }
  })
}, [updates, activeCallId])
```

---

## Implementation Checklist

When building new features, ensure:

- [ ] Uses `AppShell` for navigation consistency
- [ ] Follows progressive disclosure (hide complexity by default)
- [ ] Shows recent/frequently-used items for quick access
- [ ] Provides clear success/error states
- [ ] Links to Evidence Review where applicable
- [ ] Uses light theme with Navy primary color
- [ ] No emojis in UI labels (use SVG icons)
- [ ] Mobile-responsive with bottom navigation

---

## Related Documents

- [UX Design Principles](./UX_DESIGN_PRINCIPLES.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Artifact Authority Contract](../01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md)
