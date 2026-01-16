# Evidence Bundle Improvements - Implementation Plan

**Date:** January 16, 2026  
**Status:** Implemented (v1.4.1)  
**Reference:** ARCH_DOCS/01-CORE/THE_FINAL_ARCHITECTURE_MINIMAL_ADDITIONS.md

---

## Executive Summary

Five targeted improvements to harden the evidence bundle system for custody-grade compliance:

| # | Recommendation | Risk | Effort |
|---|----------------|------|--------|
| 1 | Canonical manifest hashing | High (hash mismatch) | ✅ Done |
| 2 | Resilient bundle creation | Medium (orphan manifests) | ✅ Done |
| 3 | Async TSA requests | Medium (blocking I/O) | ✅ Done |
| 4 | Tighter RLS on insert | Medium (security) | ✅ Done |
| 5 | Schema docs + tests | Low (maintainability) | ✅ Docs done |

---

## 1. Canonical Manifest Hashing

### Problem
`evidenceManifest.ts` uses `JSON.stringify(obj, Object.keys(obj).sort())` which only sorts top-level keys.
`evidenceBundle.ts` uses `stableStringify()` which recursively sorts all keys.

This could cause hash mismatches if manifest is re-generated.

### Solution
Extract `stableStringify()` to shared utility, use in both services.

### Implemented In
- `lib/crypto/canonicalize.ts`
- `app/services/evidenceManifest.ts`
- `app/services/evidenceBundle.ts`

### Code Changes

```typescript
// lib/crypto/canonicalize.ts (NEW)
/**
 * Canonical JSON serialization for cryptographic hashing
 * 
 * Ensures deterministic output regardless of key insertion order.
 * Required for hash reproducibility per SYSTEM_OF_RECORD_COMPLIANCE.
 */

export function sortObject(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortObject)
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    const sorted: Record<string, any> = {}
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortObject(value[key])
    }
    return sorted
  }
  return value
}

export function stableStringify(value: any): string {
  return JSON.stringify(sortObject(value))
}

export function hashPayload(payload: any, algorithm = 'sha256'): string {
  const crypto = require('crypto')
  const canonical = stableStringify(payload)
  return crypto.createHash(algorithm).update(canonical).digest('hex')
}
```

```typescript
// evidenceManifest.ts - CHANGE
import { stableStringify, hashPayload } from '@/lib/crypto/canonicalize'

// BEFORE:
const manifestJson = JSON.stringify(manifestData, Object.keys(manifestData).sort())
const hash = crypto.createHash('sha256').update(manifestJson).digest('hex')

// AFTER:
const hash = hashPayload(manifestData)
```

---

## 2. Resilient Bundle Creation

### Problem
If `createEvidenceBundle()` fails after `generateEvidenceManifest()` succeeds, manifest exists without bundle.

### Solution
Option A: Database transaction (requires RPC function)
Option B: Recovery check + retry in bundle creation (simpler)

### Implemented: Recovery Check

Add a function to recover orphan manifests:

```typescript
// app/services/evidenceBundle.ts

/**
 * Create bundle for manifest, or recover if manifest exists but bundle doesn't
 */
export async function ensureEvidenceBundle(options: CreateEvidenceBundleOptions): Promise<string> {
  const { manifestId } = options

  // Check if bundle already exists
  const { data: existingBundle } = await supabaseAdmin
    .from('evidence_bundles')
    .select('id')
    .eq('manifest_id', manifestId)
    .is('superseded_at', null)
    .limit(1)

  if (existingBundle?.[0]) {
    return existingBundle[0].id
  }

  // Check if manifest exists (for recovery scenarios)
  const { data: manifest } = await supabaseAdmin
    .from('evidence_manifests')
    .select('id, manifest, organization_id, recording_id, version, parent_manifest_id')
    .eq('id', manifestId)
    .limit(1)

  if (!manifest?.[0]) {
    throw new Error(`Manifest ${manifestId} not found`)
  }

  // Create bundle with recovered data
  return createEvidenceBundle({
    manifestId,
    manifestHash: manifest[0].manifest?.manifest_hash,
    organizationId: manifest[0].organization_id,
    callId: manifest[0].manifest?.call_id,
    recordingId: manifest[0].recording_id,
    artifacts: manifest[0].manifest?.artifacts || [],
    version: manifest[0].version,
    parentManifestId: manifest[0].parent_manifest_id
  })
}
```

Optional: add a cron job to find and fix orphans:

```typescript
// app/api/cron/fix-orphan-manifests/route.ts
export async function GET() {
  // Find manifests without bundles
  const { data: orphans } = await supabaseAdmin.rpc('find_orphan_manifests')
  
  for (const manifest of orphans || []) {
    await ensureEvidenceBundle({ manifestId: manifest.id, ... })
  }
  
  return NextResponse.json({ fixed: orphans?.length || 0 })
}
```

---

## 3. Async TSA Requests

### Problem
`requestRfc3161Token()` is called synchronously during bundle creation, blocking I/O.

### Solution
Insert bundle with `tsa_status='pending'`, then:
- Option A: Background job updates TSA fields
- Option B: Webhook callback from TSA proxy

### Implemented: Async TSA queue (best-effort)

### Code Changes

```typescript
// app/services/evidenceBundle.ts

export async function createEvidenceBundle(options: CreateEvidenceBundleOptions): Promise<string> {
  // ... existing code ...

  // Insert bundle with pending TSA status
  const bundleId = uuidv4()
  const { error: insertErr } = await supabaseAdmin.from('evidence_bundles').insert({
    id: bundleId,
    // ... other fields ...
    tsa_status: process.env.RFC3161_TSA_PROXY_URL ? 'pending' : 'not_configured',
    tsa_requested_at: null,
    tsa_received_at: null,
    tsa_error: null,
    created_at: createdAt
  })

  if (insertErr) throw new Error(`Failed to store evidence bundle: ${insertErr.message}`)

  // Enqueue TSA request (non-blocking)
  if (process.env.RFC3161_TSA_PROXY_URL) {
    enqueueTsaRequest(bundleId, bundleHashHex).catch(err => {
      logger.warn('evidenceBundle: TSA enqueue failed', { bundleId, error: err.message })
    })
  }

  return bundleId
}

/**
 * Enqueue TSA request for background processing
 */
async function enqueueTsaRequest(bundleId: string, bundleHashHex: string): Promise<void> {
  // Option 1: Direct async call (simple, works for Vercel)
  setImmediate(async () => {
    await processTsaRequest(bundleId, bundleHashHex)
  })
  
  // Option 2: Queue system (for production scale)
  // await queueClient.enqueue('tsa-request', { bundleId, bundleHashHex })
}

/**
 * Process TSA request and update bundle
 */
export async function processTsaRequest(bundleId: string, bundleHashHex: string): Promise<void> {
  const requestedAt = new Date().toISOString()
  
  try {
    await supabaseAdmin.from('evidence_bundles')
      .update({ tsa_requested_at: requestedAt })
      .eq('id', bundleId)

    const result = await requestRfc3161Token(bundleHashHex)

    await supabaseAdmin.from('evidence_bundles')
      .update({
        tsa: result.tsa,
        tsa_status: result.tsaStatus,
        tsa_received_at: result.tsaReceivedAt,
        tsa_error: result.tsaError
      })
      .eq('id', bundleId)

    logger.info('evidenceBundle: TSA completed', { bundleId, status: result.tsaStatus })
  } catch (err: any) {
    await supabaseAdmin.from('evidence_bundles')
      .update({
        tsa_status: 'error',
        tsa_error: err?.message || 'TSA request failed'
      })
      .eq('id', bundleId)

    logger.error('evidenceBundle: TSA request failed', err, { bundleId })
  }
}
```

Add cron job to retry failed TSA requests:

```typescript
// app/api/cron/retry-tsa/route.ts
export async function GET() {
  const { data: pending } = await supabaseAdmin
    .from('evidence_bundles')
    .select('id, bundle_hash')
    .in('tsa_status', ['pending', 'error'])
    .lt('tsa_requested_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5 min old
    .limit(10)

  for (const bundle of pending || []) {
    const hashHex = bundle.bundle_hash.replace('sha256:', '')
    await processTsaRequest(bundle.id, hashHex)
  }

  return NextResponse.json({ processed: pending?.length || 0 })
}
```

---

## 4. Tighter RLS on Insert

### Problem
Current RLS allows any insert:
```sql
CREATE POLICY "evidence_bundles_insert_all"
  ON public.evidence_bundles FOR INSERT
  WITH CHECK (true);
```

### Solution
Require organization match (unless service role):

### Implemented In

```sql
-- migrations/2026-01-16-tighten-evidence-bundles-rls.sql

BEGIN;

-- Drop permissive insert policy
DROP POLICY IF EXISTS "evidence_bundles_insert_all" ON public.evidence_bundles;

-- Create org-scoped insert policy
CREATE POLICY "evidence_bundles_insert_org"
  ON public.evidence_bundles FOR INSERT
  WITH CHECK (
    -- Service role bypasses RLS, so this only affects user-context inserts
    organization_id IN (
      SELECT om.organization_id 
      FROM public.org_members om 
      WHERE om.user_id = auth.uid()
    )
    OR
    -- Allow system inserts (service role context)
    auth.uid() IS NULL
  );

COMMIT;
```

---

## 5. Schema Docs + Tests

### Schema.txt Update (Done)

Add to ARCH_DOCS/01-CORE/Schema.txt:

```
─────────────────────────────────────────────────────────────────────────────
TABLE: evidence_bundles
Purpose: Custody-grade evidence packages with RFC3161 timestamping
─────────────────────────────────────────────────────────────────────────────
id                  uuid PK
organization_id     uuid FK → organizations.id
call_id             uuid FK → calls.id
recording_id        uuid FK → recordings.id (nullable)
manifest_id         uuid FK → evidence_manifests.id UNIQUE WHERE superseded_at IS NULL
manifest_hash       text NOT NULL (sha256:hex)
artifact_hashes     jsonb NOT NULL (array of {type, id, sha256})
bundle_payload      jsonb NOT NULL (canonical payload for hashing)
bundle_hash         text NOT NULL (sha256:hex)
bundle_hash_algo    text NOT NULL DEFAULT 'sha256'
version             integer NOT NULL DEFAULT 1
parent_bundle_id    uuid FK → evidence_bundles.id (nullable)
superseded_at       timestamptz (nullable)
superseded_by       uuid FK → evidence_bundles.id (nullable)
immutable_storage   boolean NOT NULL DEFAULT true
is_authoritative    boolean NOT NULL DEFAULT true
produced_by         text NOT NULL DEFAULT 'system_cas'
immutability_policy text NOT NULL DEFAULT 'immutable' CHECK IN ('immutable','limited','mutable')
tsa                 jsonb (nullable) - RFC3161 token data
tsa_status          text NOT NULL DEFAULT 'not_configured' CHECK IN ('not_configured','pending','completed','error')
tsa_requested_at    timestamptz (nullable)
tsa_received_at     timestamptz (nullable)
tsa_error           text (nullable)
created_at          timestamptz NOT NULL DEFAULT now()

Indexes:
  idx_evidence_bundles_org_created (organization_id, created_at DESC)
  idx_evidence_bundles_call (call_id, created_at DESC)
  idx_evidence_bundles_manifest (manifest_id)
  uq_evidence_bundles_manifest_active UNIQUE (manifest_id) WHERE superseded_at IS NULL

Triggers:
  evidence_bundles_immutable - BEFORE UPDATE prevents content changes (allows TSA + supersession)

RLS:
  SELECT: org match or admin
  INSERT: org match (service role bypasses)
```

### Test Files

```typescript
// tests/unit/evidenceBundle.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvidenceBundle, processTsaRequest, ensureEvidenceBundle } from '@/app/services/evidenceBundle'

describe('createEvidenceBundle', () => {
  it('should create bundle with canonical hash', async () => {
    const result = await createEvidenceBundle({
      manifestId: 'test-manifest-id',
      manifestHash: 'sha256:abc123',
      organizationId: 'test-org',
      callId: 'test-call',
      artifacts: [],
      version: 1
    })
    
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should return existing bundle if manifest already has one', async () => {
    // First call creates
    const first = await createEvidenceBundle({ ... })
    // Second call returns same
    const second = await createEvidenceBundle({ ... })
    
    expect(first).toBe(second)
  })

  it('should set tsa_status to pending when TSA configured', async () => {
    process.env.RFC3161_TSA_PROXY_URL = 'https://tsa.example.com'
    
    const bundleId = await createEvidenceBundle({ ... })
    
    const { data } = await supabaseAdmin
      .from('evidence_bundles')
      .select('tsa_status')
      .eq('id', bundleId)
      .single()
    
    expect(data.tsa_status).toBe('pending')
  })
})

describe('processTsaRequest', () => {
  it('should update bundle with TSA token on success', async () => {
    // Mock TSA proxy
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        token_der_base64: 'base64token',
        timestamp: '2026-01-16T00:00:00Z',
        policy_oid: '1.2.3.4'
      })
    })

    await processTsaRequest('test-bundle-id', 'abc123hex')

    const { data } = await supabaseAdmin
      .from('evidence_bundles')
      .select('tsa_status, tsa')
      .eq('id', 'test-bundle-id')
      .single()

    expect(data.tsa_status).toBe('completed')
    expect(data.tsa.token_der_base64).toBe('base64token')
  })

  it('should set error status on TSA failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

    await processTsaRequest('test-bundle-id', 'abc123hex')

    const { data } = await supabaseAdmin
      .from('evidence_bundles')
      .select('tsa_status, tsa_error')
      .eq('id', 'test-bundle-id')
      .single()

    expect(data.tsa_status).toBe('error')
    expect(data.tsa_error).toContain('Network error')
  })
})

describe('ensureEvidenceBundle', () => {
  it('should recover orphan manifest without bundle', async () => {
    // Create manifest without bundle (simulating failure)
    const manifestId = 'orphan-manifest'
    await supabaseAdmin.from('evidence_manifests').insert({
      id: manifestId,
      organization_id: 'test-org',
      recording_id: 'test-recording',
      manifest: { artifacts: [], manifest_hash: 'sha256:test' },
      version: 1
    })

    const bundleId = await ensureEvidenceBundle({ manifestId, ... })

    expect(bundleId).toBeDefined()
    
    const { data } = await supabaseAdmin
      .from('evidence_bundles')
      .select('id')
      .eq('manifest_id', manifestId)
      .single()

    expect(data.id).toBe(bundleId)
  })
})
```

---

## Implementation Order

1. **Canonical hashing** (low risk, immediate benefit)
2. **Tighter RLS** (security fix, quick migration)
3. **Async TSA** (performance, needs testing)
4. **Resilient bundle creation** (reliability)
5. **Schema docs + tests** (maintainability)

---

## Success Criteria

- [ ] Manifest and bundle hashes are reproducible (same input = same hash)
- [ ] Orphan manifests are automatically recovered
- [ ] TSA requests don't block bundle creation
- [ ] Non-service-role inserts require org membership
- [ ] Schema.txt documents evidence_bundles table
- [ ] Tests cover happy path + failure cases for TSA
