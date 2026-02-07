// Read-only verification tool for evidence bundles/manifests
// Usage:
//   NEON_PG_CONNSTRING=postgresql://... node tools/verify_evidence_bundle.ts --bundleId <uuid>
//   NEON_PG_CONNSTRING=postgresql://... node tools/verify_evidence_bundle.ts --manifestId <uuid>

import { neon } from '@neondatabase/serverless'
import { hashPayloadPrefixed } from '@/lib/crypto/canonicalize'

type ArtifactHash = { type: string; id: string; sha256?: string | null }

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

function normalizeArtifactHashes(list: ArtifactHash[] = []) {
  return list
    .map((item) => ({
      type: item.type,
      id: item.id,
      sha256: item.sha256 ?? null,
    }))
    .sort((a, b) => {
      if (a.type === b.type) return a.id.localeCompare(b.id)
      return a.type.localeCompare(b.type)
    })
}

function parseArgs() {
  const args = process.argv.slice(2)
  const out: { bundleId?: string; manifestId?: string } = {}
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--bundleId') out.bundleId = args[i + 1]
    if (arg === '--manifestId') out.manifestId = args[i + 1]
  }
  return out
}

async function main() {
  const { bundleId, manifestId } = parseArgs()
  if (!bundleId && !manifestId) fail('Provide --bundleId or --manifestId')

  const connString = process.env.NEON_PG_CONNSTRING
  if (!connString) fail('Missing NEON_PG_CONNSTRING')

  const sql = neon(connString)

  if (bundleId) {
    const bundleRows = await sql`SELECT * FROM evidence_bundles WHERE id = ${bundleId}`.then(
      (r) => r.rows
    )
    const bundleErr = bundleRows.length === 0 ? new Error('Not found') : null

    if (bundleErr || !bundleRows[0]) fail('Evidence bundle not found')
    const bundle = bundleRows[0]

    const manifestRows =
      await sql`SELECT id, manifest, cryptographic_hash FROM evidence_manifests WHERE id = ${bundle.manifest_id}`.then(
        (r) => r.rows
      )
    const manifestErr = manifestRows.length === 0 ? new Error('Not found') : null

    if (manifestErr || !manifestRows[0]) fail('Manifest missing for bundle')
    const manifest = manifestRows[0]

    const bundlePayload = bundle.bundle_payload
    const computedBundleHash = bundlePayload ? hashPayloadPrefixed(bundlePayload) : null
    const bundleHashMatch = computedBundleHash === bundle.bundle_hash

    const computedManifestHash = hashPayloadPrefixed(manifest.manifest)
    const storedManifestHash =
      manifest.manifest?.manifest_hash || manifest.cryptographic_hash || null
    const manifestHashMatch = computedManifestHash === storedManifestHash

    const bundleArtifactHashes = normalizeArtifactHashes(bundlePayload?.artifact_hashes || [])
    const manifestArtifactHashes = normalizeArtifactHashes(
      (manifest.manifest?.artifacts || []).map((item: any) => ({
        type: item.type,
        id: item.id,
        sha256: item.sha256 ?? null,
      }))
    )
    const artifactHashesMatch =
      JSON.stringify(bundleArtifactHashes) === JSON.stringify(manifestArtifactHashes)

    console.log(
      JSON.stringify(
        {
          ok: bundleHashMatch && manifestHashMatch && artifactHashesMatch,
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
            tsa_error: bundle.tsa_error,
          },
          manifest: {
            id: manifest.id,
            manifest_hash: storedManifestHash,
            computed_manifest_hash: computedManifestHash,
            manifest_hash_match: manifestHashMatch,
          },
          artifacts: {
            bundle_count: bundlePayload?.artifact_hashes?.length || 0,
            manifest_count: manifest.manifest?.artifacts?.length || 0,
            artifact_hashes_match: artifactHashesMatch,
          },
        },
        null,
        2
      )
    )
  }

  if (manifestId) {
    const manifestRows =
      await sql`SELECT id, manifest, cryptographic_hash FROM evidence_manifests WHERE id = ${manifestId}`.then(
        (r) => r.rows
      )
    const manifestErr = manifestRows.length === 0 ? new Error('Not found') : null

    if (manifestErr || !manifestRows[0]) fail('Evidence manifest not found')
    const manifest = manifestRows[0]

    const computedManifestHash = hashPayloadPrefixed(manifest.manifest)
    const storedManifestHash =
      manifest.manifest?.manifest_hash || manifest.cryptographic_hash || null
    const manifestHashMatch = computedManifestHash === storedManifestHash

    const bundleRows =
      await sql`SELECT id FROM evidence_bundles WHERE manifest_id = ${manifestId} AND superseded_at IS NULL`.then(
        (r) => r.rows
      )

    console.log(
      JSON.stringify(
        {
          ok: manifestHashMatch && !!bundleRows?.[0],
          manifest: {
            id: manifest.id,
            manifest_hash: storedManifestHash,
            computed_manifest_hash: computedManifestHash,
            manifest_hash_match: manifestHashMatch,
          },
          bundle: bundleRows?.[0] ? { id: bundleRows[0].id } : null,
        },
        null,
        2
      )
    )
  }
}

main().catch((err) => fail(err?.message || 'Verification failed'))
