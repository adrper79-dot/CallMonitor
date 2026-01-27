import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { ApiErrors, apiSuccess } from '@/lib/errors/apiHandler'
import pgClient from '@/lib/pgClient'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(req: Request, { params }: { params: { userId: string } }) {
  try {
    const session = await getServerSession(authOptions as any)
    
    if (!session?.user?.id || session.user.id !== params.userId) {
      return ApiErrors.unauthorized()
    }

    let organizationId: string | null = null

    const memRes = await pgClient.query('SELECT organization_id FROM org_members WHERE user_id = $1 LIMIT 1', [params.userId])
    const membership = memRes.rows?.[0]
    if (membership?.organization_id) {
      organizationId = membership.organization_id
    } else {
      const userRes = await pgClient.query('SELECT organization_id FROM users WHERE id = $1 LIMIT 1', [params.userId])
      const user = userRes.rows?.[0]
      if (user?.organization_id) {
        organizationId = user.organization_id
        try {
          await pgClient.query('INSERT INTO org_members (id, organization_id, user_id, role, created_at) VALUES ($1,$2,$3,$4,$5)', [
            require('uuid').v4(), user.organization_id, params.userId, 'member', new Date().toISOString()
          ])
        } catch (e: any) {
          if (!String(e?.message || '').includes('duplicate')) {
            logger.error('Failed to create org_members record', e)
          }
        }
      }
    }

    if (!organizationId) {
      return ApiErrors.notFound('Organization')
    }

    return apiSuccess({ organization_id: organizationId })
  } catch (err: any) {
    logger.error('Failed to fetch user organization', err)
    return ApiErrors.internal('Internal server error')
  }
}
