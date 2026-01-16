import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth, Errors } from '@/lib/api/utils'
import { hashPayloadPrefixed } from '@/lib/crypto/canonicalize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type ArtifactHash = { type: string; id: string; sha256?: string | null }

function normalizeArtifactHashes(list: ArtifactHash[] = []) {
  return list
    .map((item) => ({
      type: item.type,
      id: item.id,
      sha256: item.sha256 ?? null
    }))
    .sort((a, b) => {
      if (a.type === b.type) return a.id.localeCompare(b.id)
      return a.type.localeCompare(b.type)
    })
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { searchParams } = new URL(req.url)
    const bundleId = searchParams.get('bundleId')
    const manifestId = searchParams.get('manifestId')

    if (!bundleId && !manifestId) {
      return Errors.badRequest('bundleId or manifestId is required')
    }

    const issues: string[] = []

    if (bundleId) {
      const { data: bundleRows, error: bundleErr } = await supabaseAdmin
        .from('evidence_bundles')
        .select('*')
        .eq('id', bundleId)
        .limit(1)

      if (bundleErr || !bundleRows?.[0]) {
        return Errors.notFound('Evidence bundle not found')
      }

      const bundle = bundleRows[0]

      const { data: memberRows } = await supabaseAdmin
        .from('org_members')
        .select('id')
        .eq('organization_id', bundle.organization_id)
        .eq('user_id', ctx.userId)
        .limit(1)

      if (!memberRows?.[0]) {
        return Errors.forbidden('Not authorized to verify this bundle')
      }

      const bundlePayload = bundle.bundle_payload
      const computedBundleHash = bundlePayload ? hashPayloadPrefixed(bundlePayload) : null
      const bundleHashMatch = !!computedBundleHash && computedBundleHash === bundle.bundle_hash

      if (!bundlePayload) issues.push('Bundle payload missing')
      if (computedBundleHash && !bundleHashMatch) issues.push('Bundle hash mismatch')

      const { data: manifestRows, error: manifestErr } = await supabaseAdmin
        .from('evidence_manifests')
        .select('id, manifest, cryptographic_hash')
        .eq('id', bundle.manifest_id)
        .limit(1)

      const manifest = manifestRows?.[0] || null
      if (manifestErr || !manifest) {
        issues.push('Manifest missing for bundle')
      }

      let computedManifestHash: string | null = null
      let storedManifestHash: string | null = null
      let manifestHashMatch = false
      let artifactHashesMatch = false

      if (manifest?.manifest) {
        computedManifestHash = hashPayloadPrefixed(manifest.manifest)
        storedManifestHash = manifest.manifest?.manifest_hash || manifest.cryptographic_hash || null
        manifestHashMatch = !!storedManifestHash && computedManifestHash === storedManifestHash
        if (!manifestHashMatch) issues.push('Manifest hash mismatch')

        const bundleArtifactHashes = normalizeArtifactHashes(bundlePayload?.artifact_hashes || [])
        const manifestArtifactHashes = normalizeArtifactHashes(
          (manifest.manifest?.artifacts || []).map((item: any) => ({
            type: item.type,
            id: item.id,
            sha256: item.sha256 ?? null
          }))
        )
        artifactHashesMatch = JSON.stringify(bundleArtifactHashes) === JSON.stringify(manifestArtifactHashes)
        if (!artifactHashesMatch) issues.push('Artifact hashes mismatch between bundle and manifest')

        if (bundlePayload?.manifest_hash && storedManifestHash && bundlePayload.manifest_hash !== storedManifestHash) {
          issues.push('Bundle manifest_hash does not match stored manifest hash')
        }
      }

      return NextResponse.json({
        ok: issues.length === 0,
        bundle: {
          id: bundle.id,
          bundle_hash: bundle.bundle_hash,
          computed_bundle_hash: computedBundleHash,
          bundle_hash_match: bundleHashMatch,
          evidence_completeness: bundle.evidence_completeness,
          custody_status: bundle.custody_status,
          retention_class: bundle.retention_class,
          legal_hold_flag: bundle.legal_hold_flag,
          tsa_status: bundle.tsa_status,
          tsa_received_at: bundle.tsa_received_at,
          tsa_error: bundle.tsa_error
        },
        manifest: manifest
          ? {
              id: manifest.id,
              manifest_hash: storedManifestHash,
              computed_manifest_hash: computedManifestHash,
              manifest_hash_match: manifestHashMatch
            }
          : null,
        artifacts: manifest
          ? {
              bundle_count: bundlePayload?.artifact_hashes?.length || 0,
              manifest_count: manifest.manifest?.artifacts?.length || 0,
              artifact_hashes_match: artifactHashesMatch
            }
          : null,
        issues
      })
    }

    if (manifestId) {
      const { data: manifestRows, error: manifestErr } = await supabaseAdmin
        .from('evidence_manifests')
        .select('id, manifest, organization_id, cryptographic_hash')
        .eq('id', manifestId)
        .limit(1)

      if (manifestErr || !manifestRows?.[0]) {
        return Errors.notFound('Evidence manifest not found')
      }

      const manifest = manifestRows[0]

      const { data: memberRows } = await supabaseAdmin
        .from('org_members')
        .select('id')
        .eq('organization_id', manifest.organization_id)
        .eq('user_id', ctx.userId)
        .limit(1)

      if (!memberRows?.[0]) {
        return Errors.forbidden('Not authorized to verify this manifest')
      }

      const computedManifestHash = hashPayloadPrefixed(manifest.manifest)
      const storedManifestHash = manifest.manifest?.manifest_hash || manifest.cryptographic_hash || null
      const manifestHashMatch = !!storedManifestHash && computedManifestHash === storedManifestHash

      if (!manifestHashMatch) issues.push('Manifest hash mismatch')

      const { data: bundleRows } = await supabaseAdmin
        .from('evidence_bundles')
        .select('id')
        .eq('manifest_id', manifestId)
        .is('superseded_at', null)
        .limit(1)

      if (!bundleRows?.[0]) {
        issues.push('No active evidence bundle found for manifest')
      }

      return NextResponse.json({
        ok: issues.length === 0,
        manifest: {
          id: manifest.id,
          manifest_hash: storedManifestHash,
          computed_manifest_hash: computedManifestHash,
          manifest_hash_match: manifestHashMatch
        },
        bundle: bundleRows?.[0] ? { id: bundleRows[0].id } : null,
        issues
      })
    }

    return Errors.badRequest('Invalid verification request')
  } catch (err: any) {
    logger.error('evidenceVerify: error', err)
    return Errors.internal(err || new Error('Failed to verify evidence'))
  }
}
