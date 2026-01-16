# Artifact Authority Contract

**Version:** 1.0  
**Last Updated:** January 16, 2026  
**Status:** Canonical  
**Purpose:** Define what artifacts are authoritative (legally defensible) vs preview (assist-only)

---

## Executive Summary

Word Is Bond operates as a **System of Record** for business conversations. This contract formally declares which artifacts are **authoritative** (canonical, immutable, legally defensible) and which are **preview** (real-time assist only, not evidential).

All authoritative artifacts follow the principle: **evidence, not opinions**. Source recordings are never modified. Transcripts are produced by a single canonical provider (AssemblyAI). Every mutation is logged in `audit_logs` with actor attribution. Preview artifacts (live translation) assist users in real-time but are explicitly non-authoritative.

---

## Trust Boundary Declaration

This table defines explicit authority boundaries for audit and legal review:

| Component | Trust Level | Notes |
|-----------|-------------|-------|
| SignalWire recording | Authoritative input | Source audio, immutable |
| AssemblyAI transcript | Canonical derivative | Versioned, append-only |
| Evidence manifest | Authoritative record | Hash + provenance |
| Evidence bundle | Authoritative record | Bundle hash + TSA-ready |
| WebRTC live translation | Non-authoritative | Preview only, not persisted |
| ElevenLabs TTS | Non-authoritative | Playback convenience only |
| AI summaries | Non-authoritative | Assistive, not evidential |

---

## Artifact Authority Classification

### Authoritative Artifacts (Evidential)

These artifacts are canonical, immutable, and legally defensible.

| Artifact | Table | Authoritative | Mutable | Producer | Enforcement | Use Case |
|----------|-------|---------------|---------|----------|-------------|----------|
| **Calls** | `calls` | Yes | Limited | Server | `soft_delete_call()` trigger | Root entity for all artifacts |
| **Recordings** | `recordings` | Yes | No | SignalWire | Insert-only policy | Source media (never modified) |
| **Transcripts** | `transcript_versions` | Yes | No | AssemblyAI | Versioned append-only | Canonical text transcript |
| **Evidence Manifests** | `evidence_manifests` | Yes | No | Server CAS | `prevent_evidence_manifest_content_update()` | Cryptographic provenance chain |
| **Audit Logs** | `audit_logs` | Yes | No | Server | Insert-only policy | Actor attribution for all writes |
| **Survey Results** | `survey_responses` | Yes | No | AI Survey Bot | Insert-only | Post-call survey data |

### Limited Mutability Artifacts

| Artifact | Table | What Can Change | What Cannot Change | Enforcement |
|----------|-------|-----------------|-------------------|-------------|
| **Calls** | `calls` | `status`, `ended_at`, `call_sid` | `id`, `created_at`, `organization_id`, `created_by` | Trigger validation |
| **AI Runs** | `ai_runs` | `status`, `completed_at`, `output` | `id`, `call_id`, `started_at`, `model` | Server-side validation |

### Non-Authoritative Artifacts (Preview Only)

These artifacts assist users in real-time but are **not recorded as evidence**.

| Artifact | Provider | Why Non-Authoritative | What Happens After Call |
|----------|----------|----------------------|------------------------|
| **Live Translation** | SignalWire AI Agent | Real-time assist, latency-optimized (not accuracy-optimized) | Not persisted |
| **Live Captions** | SignalWire | Real-time display only | Not persisted |
| **AI Summaries** | OpenAI (preview) | LLM inference, not source | Marked as `is_authoritative: false` |

---

## Immutability Policy

### Policy Levels

| Level | Description | Tables | Enforcement |
|-------|-------------|--------|-------------|
| **Immutable** | No updates or deletes allowed | `recordings`, `transcript_versions`, `evidence_manifests`, `audit_logs` | Database triggers + RLS |
| **Limited** | Specific fields updatable, most locked | `calls`, `ai_runs` | Database triggers |
| **Mutable** | Full CRUD allowed | `voice_configs`, `campaigns`, `voice_targets` | Application logic |

### Technical Enforcement

```sql
-- Recordings: Insert-only (no UPDATE/DELETE)
-- Enforced via RLS policy: only INSERT allowed for service role

-- Evidence Manifests: Immutable after creation
-- Enforced via trigger: prevent_evidence_manifest_content_update()

-- Transcript Versions: Append-only (new versions, no edits)
-- Enforced via versioning: parent_version_id chain

-- Calls: Soft delete only
-- Enforced via trigger: soft_delete_call()
```

---

## Producer Attribution

Every authoritative artifact must have clear producer attribution.

| Producer | Artifacts Produced | Trust Level | Notes |
|----------|-------------------|-------------|-------|
| **SignalWire** | `recordings` | High | Carrier-grade media capture |
| **AssemblyAI** | `transcript_versions` | High | Canonical transcription |
| **Server (Word Is Bond)** | `calls`, `evidence_manifests`, `audit_logs` | High | System-generated |
| **AI Survey Bot** | `survey_responses` | Medium | Automated collection |
| **SignalWire AI Agent** | Live translation | Low (Preview) | Real-time assist only |
| **User** | Manual notes, dispositions | Medium | Human input |

---

## Actor Taxonomy (Audit Semantics)

Actors are explicitly labeled in `audit_logs.actor_type`:

| Actor Type | Example | Notes |
|-----------|---------|------|
| human | Operator / Admin | Authenticated user session |
| system | wordis-bond-core | Server-side service actor |
| vendor | signalwire-webhook | External vendor webhook |
| automation | nightly-export | Scheduled system automation |

The audit insert trigger assigns `actor_type` when not provided.

---

## Decision Framework

When adding a new artifact type, answer these questions:

### 1. Is this artifact generated from source media?

- **Yes**: Likely authoritative (follow recording/transcript pattern)
- **No**: Evaluate further

### 2. Is accuracy more important than latency?

- **Accuracy-first**: Authoritative (post-call processing)
- **Latency-first**: Preview (real-time assist)

### 3. Would this artifact be cited in a legal dispute?

- **Yes**: Must be authoritative with full provenance
- **No**: Can be preview/mutable

### 4. Is the producer a canonical source?

- **Canonical provider** (AssemblyAI, SignalWire): Authoritative
- **LLM inference** (OpenAI, Claude): Preview unless explicitly validated

### 5. Can this artifact be reconstructed from authoritative sources?

- **Yes**: May be preview (cache/derived)
- **No**: Must be authoritative (source)

---

## Artifact Lifecycle

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│  Call Start │────▶│  Recording   │────▶│  Transcript (v1)    │
│  (calls)    │     │  (immutable) │     │  (append-only)      │
└─────────────┘     └──────────────┘     └─────────────────────┘
                                                   │
                                                   ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│  AI Runs    │◀────│  Translation │◀────│  Evidence Manifest  │
│  (limited)  │     │  (if needed) │     │  (immutable)        │
└─────────────┘     └──────────────┘     └─────────────────────┘
                                                   │
                                                   ▼
                                         ┌─────────────────────┐
                                         │  Evidence Bundle    │
                                         │  (custody-grade)    │
                                         └─────────────────────┘
                                                   │
                                                   ▼
                                         ┌─────────────────────┐
                                         │  Export Bundle      │
                                         │  (ZIP archive)      │
                                         └─────────────────────┘
```

---

## API Contract

### Reading Authoritative Artifacts

```typescript
// Always include is_authoritative in queries
const { data: transcript } = await supabase
  .from('transcript_versions')
  .select('*, is_authoritative, produced_by')
  .eq('call_id', callId)
  .eq('is_authoritative', true)  // Filter for canonical
  .order('version', { ascending: false })
  .limit(1)
```

### Creating Artifacts

```typescript
// Server-side only, with attribution
await supabase.from('recordings').insert({
  id: uuidv4(),
  call_id: callId,
  url: signalwireUrl,
  is_authoritative: true,        // Always true for recordings
  produced_by: 'signalwire',     // Producer attribution
  immutability_policy: 'immutable'
})
```

### Updating Limited-Mutability Artifacts

```typescript
// Only allowed fields for calls
const ALLOWED_CALL_UPDATES = ['status', 'ended_at', 'call_sid']

await supabase
  .from('calls')
  .update({ status: 'completed', ended_at: new Date() })
  .eq('id', callId)
```

---

## UI Display Guidelines

### Authoritative Artifacts

- Display green "Authoritative" badge
- Show producer attribution
- Include timestamp and provenance link
- No edit controls

### Preview Artifacts

- Display amber "Preview" badge
- Show warning: "Not recorded as evidence"
- May include edit/dismiss controls

### Example Badge Usage

```tsx
<AuthorityBadge 
  isAuthoritative={transcript.is_authoritative} 
  producer={transcript.produced_by} 
/>
```

---

## How to Use This Document

1. **Before adding a new artifact type**: Use the Decision Framework
2. **When querying artifacts**: Filter by `is_authoritative` when needed
3. **When displaying artifacts**: Show appropriate authority badge
4. **When exporting evidence**: Include only authoritative artifacts
5. **When in doubt**: Default to authoritative (stricter is safer)

---

## Related Documents

- `ARCH_DOCS/01-CORE/GRAPHICAL_ARCHITECTURE.md` - System architecture
- `ARCH_DOCS/01-CORE/Schema.txt` - Database schema
- `SIGNALWIRE_LIVE_TRANSLATION_STATUS.md` - Live translation implementation
- `migrations/2026-01-15-system-of-record-compliance.sql` - Enforcement triggers

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-15 | Initial contract |
