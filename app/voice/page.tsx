import React from 'react'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getServerSession } from 'next-auth/next'
import VoiceOperationsClient from '@/components/voice/VoiceOperationsClient'
import { logger } from '@/lib/logger'

// Interfaces (derived from ARCH_DOCS/Schema.txt)
export interface Call {
  id: string
  organization_id: string | null
  system_id: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  created_by: string | null
  call_sid: string | null
}

type PageProps = {}

export default async function VoiceOperationsPage(_props: PageProps) {
  // server-side session check - import authOptions for proper session
  const { authOptions } = await import('@/lib/auth')
  const session = await getServerSession(authOptions)
  
  // Check for user ID in either standard location or custom extension
  const userId = (session?.user as any)?.id || session?.user?.email
  
  if (!session?.user || !userId) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <h2 className="text-xl">Authentication required</h2>
          <p className="mt-2 text-slate-400">Please sign in to view Voice Operations.</p>
          <a href="/admin/auth" className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white">
            Sign In
          </a>
        </div>
      </div>
    )
  }
  
  // Get user ID - need to look up by email if id not in token
  let actualUserId = (session.user as any)?.id
  if (!actualUserId && session.user?.email) {
    const { data: userData } = await (supabaseAdmin as any)
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()
    actualUserId = userData?.id
  }

  // Get organization ID from session or user
  let organizationId: string | null = null
  let organizationName: string | null = null
  
  try {
    // Fetch user's organization using actual user ID
    const userIdToQuery = actualUserId || (session.user as any)?.id
    if (!userIdToQuery) {
      logger.warn('Voice page: No user ID available for org lookup')
    }
    
    const { data: userData } = await (supabaseAdmin as any)
      .from('users')
      .select('organization_id')
      .eq('id', userIdToQuery)
      .single()

    if (userData?.organization_id) {
      organizationId = userData.organization_id
      
      // Fetch organization name
      const { data: orgData } = await (supabaseAdmin as any)
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single()
      
      organizationName = orgData?.name || null
    }
  } catch (e) {
    logger.error('Failed to fetch organization for voice page', e)
  }

  // read-only: fetch calls using allowed columns from TOOL_TABLE_ALIGNMENT / Schema.txt
  let calls: Call[] = []
  try {
    const query = (supabaseAdmin as any)
      .from('calls')
      .select('id,organization_id,system_id,status,started_at,ended_at,created_by,call_sid')
      .order('started_at', { ascending: false })
      .limit(50)

    if (organizationId) {
      query.eq('organization_id', organizationId)
    }

    const { data, error } = await query

    if (error) throw error
    calls = (data || []) as Call[]
  } catch (e: any) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-red-500 text-4xl">⚠️</div>
          <h2 className="mt-4 text-xl">Error loading calls</h2>
          <p className="mt-2 text-slate-400">{String(e?.message ?? 'Failed to load calls')}</p>
        </div>
      </div>
    )
  }

  return (
    <VoiceOperationsClient
      initialCalls={calls}
      organizationId={organizationId}
      organizationName={organizationName || undefined}
    />
  )
}
