import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../auth/[...nextauth]/route'

export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    // Verify the user is requesting their own organization
    const session = await getServerSession(authOptions as any)
    
    if (!session?.user?.id || session.user.id !== params.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Try org_members first, fallback to users.organization_id
    let organizationId: string | null = null
    
    // Check org_members
    const { data: membership } = await supabase
      .from('org_members')
      .select('organization_id')
      .eq('user_id', params.userId)
      .limit(1)
      .single()
    
    if (membership?.organization_id) {
      organizationId = membership.organization_id
    } else {
      // Fallback to users table
      const { data: user } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', params.userId)
        .limit(1)
        .single()
      
      if (user?.organization_id) {
        organizationId = user.organization_id
        
        // Auto-create missing org_members record
        await supabase.from('org_members').insert({
          organization_id: user.organization_id,
          user_id: params.userId,
          role: 'member'
        }).catch(() => {}) // Ignore errors if already exists
      }
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      organization_id: organizationId
    })
  } catch (err: any) {
    console.error('Failed to fetch user organization:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
