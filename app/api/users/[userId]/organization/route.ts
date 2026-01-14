import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { userId: string } }) {
  try {
    const session = await getServerSession(authOptions as any)
    
    if (!session?.user?.id || session.user.id !== params.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let organizationId: string | null = null
    
    const { data: membership } = await supabase
      .from('org_members')
      .select('organization_id')
      .eq('user_id', params.userId)
      .limit(1)
      .single()
    
    if (membership?.organization_id) {
      organizationId = membership.organization_id
    } else {
      const { data: user } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', params.userId)
        .limit(1)
        .single()
      
      if (user?.organization_id) {
        organizationId = user.organization_id
        
        const { error: orgMemberError } = await supabase.from('org_members').insert({
          organization_id: user.organization_id, user_id: params.userId, role: 'member'
        })
        if (orgMemberError && !orgMemberError.message.includes('duplicate')) {
          logger.error('Failed to create org_members record', orgMemberError)
        }
      }
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    return NextResponse.json({ organization_id: organizationId })
  } catch (err: any) {
    logger.error('Failed to fetch user organization', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
