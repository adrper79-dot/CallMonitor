import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { ensureEvidenceBundle } from '@/app/services/evidenceBundle'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/fix-orphan-bundles
 * Vercel Cron job to ensure every manifest has a bundle.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('Cron: Unauthorized access attempt', {
          environment: process.env.NODE_ENV,
          hasAuth: !!authHeader
        })
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
    } else if (process.env.NODE_ENV === 'production') {
      logger.error('Cron: CRON_SECRET not configured in production')
      return NextResponse.json({
        success: false,
        error: 'Server configuration error: CRON_SECRET required'
      }, { status: 500 })
    }

    const { rows: manifests } = await query(
      `SELECT id FROM evidence_manifests 
       WHERE superseded_at IS NULL 
       ORDER BY created_at DESC 
       LIMIT 50`
    )

    if (!manifests || manifests.length === 0) {
      return NextResponse.json({ success: true, processed: 0, fixed: 0 })
    }

    let fixed = 0
    const checked = manifests.length

    for (const manifest of manifests) {
      const { rows: bundleRows } = await query(
        `SELECT id FROM evidence_bundles 
         WHERE manifest_id = $1 AND superseded_at IS NULL 
         LIMIT 1`,
        [manifest.id]
      )

      if (!bundleRows?.[0]) {
        await ensureEvidenceBundle(manifest.id)
        fixed += 1
      }
    }

    return NextResponse.json({ success: true, processed: checked, fixed })
  } catch (err: any) {
    logger.error('Cron: fix-orphan-bundles error', err)
    return NextResponse.json({ success: false, error: err?.message || 'Cron job failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
