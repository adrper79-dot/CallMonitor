import { NextResponse } from 'next/server'
import { requireAuth, success, Errors } from '@/lib/api/utils'
import { getUsageSummary, getPlanLimits } from '@/lib/services/usageTracker'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * GET /api/usage
 * Get usage summary for current billing period
 * 
 * Per ARCH_DOCS: RBAC enforced, rate limited
 * Per ERROR_HANDLING_REVIEW.md: Structured error handling
 */
async function handleGET() {
  const ctx = await requireAuth()
  if (ctx instanceof NextResponse) return ctx

  try {
    const [summary, limits] = await Promise.all([
      getUsageSummary(ctx.orgId),
      getPlanLimits(ctx.orgId)
    ])

    return success({ 
      usage: summary,
      limits: limits || undefined
    })
  } catch (err: any) {
    return Errors.internal(err)
  }
}

export const GET = withRateLimit(handleGET, {
  identifier: (req: Request) => getClientIP(req),
  config: {
    maxAttempts: 60,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000
  }
})
