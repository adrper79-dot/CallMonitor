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

    // Get user's organization from org_members table
    const { data: membership, error } = await supabase
      .from('org_members')
      .select('organization_id')
      .eq('user_id', params.userId)
      .limit(1)
      .single()

    if (error || !membership) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      organization_id: membership.organization_id
    })
  } catch (err: any) {
    console.error('Failed to fetch user organization:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
