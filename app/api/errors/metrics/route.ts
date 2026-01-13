import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getErrorKPIs, getEndpointKPIs, getSystemHealth } from '@/lib/errors/kpi'

/**
 * Error Metrics Endpoint
 * 
 * Returns error KPIs for dashboards and alerting.
 * Per ERROR_HANDLING_PLAN.txt
 */
export async function GET(req: Request) {
  try {
    // Require authentication (admin only in production)
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required', severity: 'high' } },
        { status: 401 }
      )
    }

    const errorKPIs = getErrorKPIs()
    const endpointKPIs = getEndpointKPIs()
    const systemHealth = getSystemHealth()

    return NextResponse.json({
      success: true,
      metrics: {
        errors: errorKPIs,
        endpoints: endpointKPIs,
        systemHealth
      },
      timestamp: new Date().toISOString()
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'METRICS_ERROR', message: err?.message || 'Failed to get metrics', severity: 'high' } },
      { status: 500 }
    )
  }
}
