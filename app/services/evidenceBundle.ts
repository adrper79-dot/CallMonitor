import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { stableStringify, hashPayload } from '@/lib/crypto/canonicalize'
import type { ArtifactReference } from '@/app/services/evidenceTypes'

/**
 * Evidence Bundle Service - Creates custody-grade evidence packages
 * 
 * Per ARCH_DOCS/01-CORE/THE_FINAL_ARCHITECTURE_MINIMAL_ADDITIONS.md:
 * - Bundle hash is SHA-256 of canonicalized payload
 * - TSA (RFC3161) is requested asynchronously
 * - Bundles are immutable (database trigger enforced)
 */

export interface EvidenceBundleArtifactHash {
  type: ArtifactReference['type'] | 'evidence_manifest'
  id: string
  sha256?: string | null
}

export interface EvidenceBundlePayload {
  manifest_id: string
  manifest_hash: string
  artifact_hashes: EvidenceBundleArtifactHash[]
  organization_id: string
  call_id: string
  created_at: string
  version: number
}

export interface CreateEvidenceBundleOptions {
  manifestId: string
  manifestHash: string
  organizationId: string
  callId: string
  recordingId?: string | null
  artifacts: ArtifactReference[]
  version: number
  parentManifestId?: string | null
}

function buildArtifactHashes(artifacts: ArtifactReference[]): EvidenceBundleArtifactHash[] {
  return artifacts
    .map((artifact) => ({
      type: artifact.type,
      id: artifact.id,
      sha256: artifact.sha256 ?? null
    }))
    .sort((a, b) => {
      if (a.type === b.type) return a.id.localeCompare(b.id)
      return a.type.localeCompare(b.type)
    })
}

/**
 * Request RFC3161 timestamp token from TSA proxy
 * Called asynchronously after bundle creation
 */
async function requestRfc3161Token(bundleHashHex: string): Promise<{
  tsa: any | null
  tsaStatus: 'not_configured' | 'completed' | 'error'
  tsaRequestedAt?: string
  tsaReceivedAt?: string
  tsaError?: string
}> {
  const proxyUrl = process.env.RFC3161_TSA_PROXY_URL
  if (!proxyUrl) {
    return { tsa: null, tsaStatus: 'not_configured' }
  }

  const requestedAt = new Date().toISOString()
  try {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash_hex: bundleHashHex,
        hash_algorithm: 'sha256'
      })
    })

    if (!response.ok) {
      return {
        tsa: null,
        tsaStatus: 'error',
        tsaRequestedAt: requestedAt,
        tsaError: `RFC3161 proxy responded ${response.status}`
      }
    }

    const payload = await response.json()
    const tokenBase64 = payload?.token_der_base64 || payload?.token_base64 || null
    const tokenHash = tokenBase64 ? `sha256:${hashPayload(tokenBase64)}` : null

    return {
      tsa: {
        tsa_url: payload?.tsa_url || proxyUrl,
        timestamp: payload?.timestamp,
        policy_oid: payload?.policy_oid,
        serial: payload?.serial,
        token_der_base64: tokenBase64,
        token_hash: tokenHash
      },
      tsaStatus: 'completed',
      tsaRequestedAt: requestedAt,
      tsaReceivedAt: new Date().toISOString()
    }
  } catch (err: any) {
    return {
      tsa: null,
      tsaStatus: 'error',
      tsaRequestedAt: requestedAt,
      tsaError: err?.message || 'RFC3161 request failed'
    }
  }
}

/**
 * Process TSA request asynchronously and update bundle
 * Called after bundle is created with tsa_status='pending'
 */
export async function processTsaRequest(bundleId: string, bundleHashHex: string): Promise<void> {
  const requestedAt = new Date().toISOString()
  
  try {
    // Mark as requested
    await supabaseAdmin.from('evidence_bundles')
      .update({ tsa_requested_at: requestedAt })
      .eq('id', bundleId)

    // Request TSA token
    const result = await requestRfc3161Token(bundleHashHex)

    // Update bundle with result
    await supabaseAdmin.from('evidence_bundles')
      .update({
        tsa: result.tsa,
        tsa_status: result.tsaStatus,
        tsa_received_at: result.tsaReceivedAt,
        tsa_error: result.tsaError
      })
      .eq('id', bundleId)

    logger.info('evidenceBundle: TSA request completed', { 
      bundleId, 
      status: result.tsaStatus 
    })
  } catch (err: any) {
    // Update with error status
    await supabaseAdmin.from('evidence_bundles')
      .update({
        tsa_status: 'error',
        tsa_error: err?.message || 'TSA request failed'
      })
      .eq('id', bundleId)

    logger.error('evidenceBundle: TSA request failed', err, { bundleId })
  }
}

/**
 * Enqueue TSA request for async processing
 * Non-blocking - bundle creation continues immediately
 */
function enqueueTsaRequest(bundleId: string, bundleHashHex: string): void {
  // Use setImmediate for non-blocking async execution
  // This works in Vercel serverless - the request continues in background
  setImmediate(async () => {
    try {
      await processTsaRequest(bundleId, bundleHashHex)
    } catch (err) {
      logger.warn('evidenceBundle: async TSA request failed', { bundleId, error: String(err) })
    }
  })
}

/**
 * Create evidence bundle for a manifest
 * 
 * Bundle creation is non-blocking:
 * - Bundle is inserted immediately with tsa_status='pending'
 * - TSA request is enqueued for async processing
 * - Returns bundle ID immediately
 */
export async function createEvidenceBundle(options: CreateEvidenceBundleOptions): Promise<string> {
  const {
    manifestId,
    manifestHash,
    organizationId,
    callId,
    recordingId,
    artifacts,
    version,
    parentManifestId
  } = options

  try {
    // Check for existing bundle (idempotent)
    const { data: existing } = await supabaseAdmin
      .from('evidence_bundles')
      .select('id')
      .eq('manifest_id', manifestId)
      .is('superseded_at', null)
      .limit(1)

    if (existing?.[0]) {
      return existing[0].id
    }

    // Build canonical payload
    const artifactHashes = buildArtifactHashes(artifacts)
    const createdAt = new Date().toISOString()
    const bundlePayload: EvidenceBundlePayload = {
      manifest_id: manifestId,
      manifest_hash: manifestHash,
      artifact_hashes: artifactHashes,
      organization_id: organizationId,
      call_id: callId,
      created_at: createdAt,
      version
    }

    // Hash using canonical serialization
    const bundleHashHex = hashPayload(bundlePayload)
    const bundleHash = `sha256:${bundleHashHex}`

    // Find parent bundle if manifest has parent
    let parentBundleId: string | null = null
    if (parentManifestId) {
      const { data: parentBundleRows } = await supabaseAdmin
        .from('evidence_bundles')
        .select('id')
        .eq('manifest_id', parentManifestId)
        .is('superseded_at', null)
        .limit(1)

      parentBundleId = parentBundleRows?.[0]?.id || null
    }

    // Determine initial TSA status
    const tsaConfigured = !!process.env.RFC3161_TSA_PROXY_URL
    const initialTsaStatus = tsaConfigured ? 'pending' : 'not_configured'

    // Insert bundle with pending TSA status (non-blocking)
    const bundleId = uuidv4()
    const { error: insertErr } = await supabaseAdmin.from('evidence_bundles').insert({
      id: bundleId,
      organization_id: organizationId,
      call_id: callId,
      recording_id: recordingId || null,
      manifest_id: manifestId,
      manifest_hash: manifestHash,
      artifact_hashes: artifactHashes,
      bundle_payload: bundlePayload,
      bundle_hash: bundleHash,
      bundle_hash_algo: 'sha256',
      version,
      parent_bundle_id: parentBundleId,
      immutable_storage: true,
      tsa: null,
      tsa_status: initialTsaStatus,
      tsa_requested_at: null,
      tsa_received_at: null,
      tsa_error: null,
      created_at: createdAt
    })

    if (insertErr) {
      logger.error('evidenceBundle: failed to insert bundle', insertErr, { manifestId, callId })
      throw new Error(`Failed to store evidence bundle: ${insertErr.message}`)
    }

    logger.info('evidenceBundle: created bundle', {
      bundleId,
      manifestId,
      callId,
      bundleHash,
      tsaStatus: initialTsaStatus
    })

    // Enqueue TSA request asynchronously (non-blocking)
    if (tsaConfigured) {
      enqueueTsaRequest(bundleId, bundleHashHex)
    }

    return bundleId
  } catch (err: any) {
    logger.error('evidenceBundle: creation error', err, { manifestId, callId })
    throw err
  }
}

/**
 * Ensure bundle exists for manifest (recovery function)
 * 
 * Use this to recover orphan manifests that don't have bundles.
 * Idempotent - returns existing bundle if present.
 */
export async function ensureEvidenceBundle(manifestId: string): Promise<string> {
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

  // Fetch manifest data for recovery
  const { data: manifest, error: manifestErr } = await supabaseAdmin
    .from('evidence_manifests')
    .select('id, manifest, organization_id, recording_id, version, parent_manifest_id')
    .eq('id', manifestId)
    .single()

  if (manifestErr || !manifest) {
    throw new Error(`Manifest ${manifestId} not found for bundle recovery`)
  }

  // Create bundle from manifest data
  return createEvidenceBundle({
    manifestId,
    manifestHash: manifest.manifest?.manifest_hash || '',
    organizationId: manifest.organization_id,
    callId: manifest.manifest?.call_id || '',
    recordingId: manifest.recording_id,
    artifacts: manifest.manifest?.artifacts || [],
    version: manifest.version,
    parentManifestId: manifest.parent_manifest_id
  })
}
