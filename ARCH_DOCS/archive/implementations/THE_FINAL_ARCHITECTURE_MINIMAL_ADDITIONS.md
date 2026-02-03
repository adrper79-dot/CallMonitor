# The Final Architecture (Minimal Additions)

**Purpose:** Assess feature fit and define the minimal additions required to support custody‑grade evidence bundles.  
**Scope:** Evidence Bundle Hash, RFC 3161 Timestamp Token, Immutable Storage Flag, Evidence Custody v1 spec, legal‑safe wording, SOC 2 / ISO 27001 mapping, Evidence Bundle schema.  
**Status:** Draft (implementation‑ready design).  

---

## 1) Fit Assessment: Should and Can We Build This?

### Does it fit the current offering?
**Yes.** The current system already treats recordings/transcripts as a system‑of‑record and generates immutable evidence manifests with cryptographic hashes and provenance (see `app/services/evidenceManifest.ts`). These features are a natural extension of that model, not a departure:
- **Evidence Bundle Hash** extends the existing manifest hashing to a bundle‑level hash that includes all referenced artifacts.
- **RFC 3161 Timestamp Token** provides third‑party time attestation for the bundle hash (external trust anchor).
- **Immutable Storage Flag** formalizes retention and immutability in storage/metadata.
- **Evidence Custody v1** codifies chain‑of‑custody practices already implied by provenance tables.

### Can we build this with minimal additions?
**Yes.** Minimal additions focus on:
- A new **Evidence Bundle** object, persisted as a small metadata table.
- A **bundle hash** derived from manifest + artifact hashes.
- A **TSA token** (RFC 3161) stored alongside the bundle record.
- A **storage immutability marker** at the record and/or bucket level.

No changes are required to the existing manifest generation flow other than attaching the manifest to a bundle and storing the bundle record.

---

## 2) Minimal Additions: Architectural Overview

### Existing Components (already aligned)
- **Evidence Manifest:** append‑only, hash‑anchored manifest with provenance.
- **Transcript Versioning:** immutable transcript versions with hashes.
- **Artifact Provenance:** chain‑of‑custody metadata for every artifact.

### New Minimal Components
1) **Evidence Bundle Record**
   - Points to a single manifest and the set of artifact hashes referenced by it.
   - Stores the bundle hash and RFC 3161 timestamp token.
2) **Bundle Hashing**
   - Deterministic hash over a canonicalized bundle payload.
3) **RFC 3161 Timestamp**
   - Optional but recommended for legal defensibility and auditability.
4) **Immutable Storage Flag**
   - Logical flag + storage policy (e.g., bucket WORM, retention lock).

---

## 3) Evidence Custody v1 Spec (Design)

### 3.1 Objectives
- **Integrity:** Detect any post‑facto changes to evidence.
- **Provenance:** Track who/what/when/how for each evidence artifact.
- **Immutability:** Enforce append‑only behavior in DB and storage.
- **External Time Anchor:** Provide third‑party timestamping (RFC 3161).

### 3.2 Core Objects
- **Artifact:** Recording, transcript, translation, survey, score.
- **Manifest:** Immutable list of artifacts + provenance + hash.
- **Bundle:** Manifest + artifact hash list + timestamp token.

### 3.3 Custody Workflow
1) **Artifact creation** (recording/transcript/etc.)
2) **Manifest generation** (append‑only, hash created)
3) **Bundle creation** (bundle hash computed)
4) **Timestamp attestation** (RFC 3161 token stored)
5) **Immutable storage flag** set

### 3.4 Integrity Rules
- Manifests and bundles are append‑only and immutable.
- Hashes are computed using canonical JSON sorting and SHA‑256.
- Any change yields a new version with a new hash.

---

## 4) Evidence Bundle Hash

### 4.1 What is hashed?
**Bundle Hash = SHA‑256 of canonicalized bundle payload:**
- `manifest_hash`
- `manifest_id`
- `artifact_hashes[]`
- `organization_id`
- `call_id`
- `created_at`
- `version`

### 4.2 Canonicalization
Use deterministic JSON serialization:
- Stable key ordering (lexicographic)
- Strict UTF‑8
- No whitespace variance

---

## 5) RFC 3161 Timestamp Token

### 5.1 Purpose
Provides cryptographic proof that the bundle hash existed at or before a specific time, issued by an independent TSA (Time Stamping Authority).

### 5.2 Token Storage
Store:
- `tsa_url`
- `tsa_serial`
- `tsa_policy_oid`
- `tsa_timestamp`
- `token_der` (binary/base64)
- `token_hash` (sha256 of the token for quick integrity checks)

### 5.3 Minimal Implementation
Use a TSA provider that supports RFC 3161.  
The token is stored per evidence bundle.

---

## 6) Immutable Storage Flag

### 6.1 Purpose
Explicitly marks the artifact set as immutable and governed by retention policy.

### 6.2 Placement
- **Bundle record:** `immutable_storage = true`
- **Storage layer:** bucket retention lock / WORM policy where supported

### 6.3 Behavior
- Immutable flag is set once and never cleared.
- Any correction creates a new bundle version.

---

## 7) Draft Legal‑Safe Wording (Non‑advisory)

> **Evidence Integrity Notice**  
> This evidence bundle includes cryptographic hashes and a timestamp token designed to detect tampering and provide proof of existence at a specific time. These controls help preserve the integrity and custody history of call artifacts. This is a technical integrity measure and does not constitute legal advice or a guarantee of admissibility in any specific legal forum. For legal interpretation or evidentiary requirements, consult qualified counsel.

---

## 8) SOC 2 / ISO 27001 Mapping (Controls Map)

### SOC 2 (Trust Services Criteria)
- **CC6.1 / CC6.2 (Logical access controls):** custody records link artifacts to org/user provenance.
- **CC7.2 (Change management):** append‑only manifests and bundles prevent untracked modification.
- **CC7.4 (Monitoring):** auditability via hashes and timestamp token checks.
- **CC8.1 (System changes):** evidence versioning provides traceable change history.

### ISO 27001:2022 Annex A
- **A.8.15 (Logging):** immutable manifest and bundle logs provide evidence trails.
- **A.8.24 (Use of cryptography):** SHA‑256 hashes, RFC 3161 tokens.
- **A.5.12 (Classification):** evidence bundles can be classified as “protected records.”
- **A.5.28 (Records protection):** immutability + retention policy support.

---

## 9) Evidence Bundle Schema (Design)

### 9.1 Logical Shape
```json
{
  "bundle_id": "uuid",
  "version": 1,
  "organization_id": "uuid",
  "call_id": "uuid",
  "manifest_id": "uuid",
  "manifest_hash": "sha256:...",
  "artifact_hashes": [
    { "type": "recording", "id": "uuid", "sha256": "..." },
    { "type": "transcript", "id": "uuid", "sha256": "..." }
  ],
  "bundle_hash": "sha256:...",
  "immutable_storage": true,
  "created_at": "ISO-8601",
  "created_by": "system|user|model",
  "tsa": {
    "tsa_url": "https://tsa.example.com",
    "timestamp": "ISO-8601",
    "policy_oid": "1.2.3.4",
    "serial": "hex|string",
    "token_der_base64": "base64",
    "token_hash": "sha256:..."
  },
  "notes": "optional"
}
```

### 9.2 Storage Mapping (Minimal)
- **Table:** `evidence_bundles`
- **Primary fields:** `id`, `organization_id`, `call_id`, `manifest_id`, `bundle_hash`, `immutable_storage`, `created_at`
- **JSON fields:** `artifact_hashes`, `tsa`
- **Append‑only:** enforced by DB trigger (same pattern as `evidence_manifests`)

---

## 10) Minimal Implementation Notes

### Delivery Plan (Best Practices)
1) **Schema first**
   - Create `evidence_bundles` table with append‑only trigger.
   - Add `bundle_version` + `parent_bundle_id` for supersession.
2) **Service layer**
   - Add bundle creation after manifest generation.
   - Canonicalize payload before hashing.
   - Store RFC 3161 token if configured (via TSA proxy).
   - Use async TSA processing to avoid blocking request flow.
   - Provide recovery path for orphan manifests without bundles.
   - Note: serverless async is best-effort; use a worker/queue for hard guarantees.
3) **Storage immutability**
   - Set `immutable_storage = true` on bundle + artifacts.
   - Apply bucket retention lock/WORM policy where supported.
4) **Audit & compliance**
   - Verify hash reproducibility and TSA token verification.
   - Document custody workflow for SOC 2 / ISO 27001 evidence.
5) **Verification & reconstitution**
   - Add read-only verification endpoint for bundle/manifest hashes.
   - Publish a simple verification procedure for third parties.

### Database (minimal)
- Add `evidence_bundles` table.
- Add append‑only trigger (no updates; only inserts).
- Optional: `bundle_version` and `parent_bundle_id` for supersession.

### Services (minimal)
- After `generateEvidenceManifest`, create bundle:
  - Gather artifact hashes referenced by manifest.
  - Compute bundle hash.
  - Store bundle record.
  - Request RFC 3161 token asynchronously (optional) and store it.
  - Run recovery if manifest exists without bundle.
  - Expose verification endpoint to recompute hashes.
  - Provide read-only CLI verification for offline review.

### Storage (minimal)
- Mark artifacts in storage with `immutable_storage` metadata.
- Use bucket retention policy where available.
 
### Custody policy (minimal)
- Add `custody_status`, `retention_class`, and `legal_hold_flag` to custody tables.
- Define `evidence_completeness` for bundle readiness.

---

## 11) Hosting, TLS, and Portability

### TLS (SSL) Requirement
- **Required for production** to secure evidence transport and TSA/webhook calls.
- **Vercel:** TLS is automatic and auto‑renewed for custom domains.
- **Self‑hosted:** provision and renew certs (Let’s Encrypt is standard).

### Vercel Suitability
- **OK for MVP and growth** when heavy work is offloaded.
- Avoid long‑running CPU tasks in request/response; use background workers.
- WebSockets and persistent connections should use a dedicated realtime service.

### Immutability & Hashing Independence
- Hashing and immutability are **application and storage concerns**, not hosting concerns.
- TLS does not change hashes; it only protects transport.
- RFC 3161 uses external TSA time, not server clock.

---

## 12) Readiness Summary

**Should build:** Yes — aligns with system‑of‑record model and boosts trust.  
**Can build:** Yes — minimal additions (bundle table + TSA integration).  
**Risks:** TSA provider availability, storage retention lock governance, legal alignment for retention policies.  
**Dependencies:** None that block MVP; TSA token can be phased in.

