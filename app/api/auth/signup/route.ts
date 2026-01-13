import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Public Signup API
 * 
 * Allows users to create new accounts.
 * Creates a user in Supabase Auth and returns success.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = body?.email
    const password = body?.password
    const name = body?.name

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_EMAIL', message: 'Invalid email format' } },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } },
        { status: 400 }
      )
    }

    // Use centralized config per architecture
    const { config } = await import('@/lib/config')
    const supabaseUrl = config.supabase.url
    const serviceKey = config.supabase.serviceRoleKey

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: 'Server configuration error' } },
        { status: 500 }
      )
    }

    // Create user via Supabase Admin API
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`
    const userMetadata: Record<string, any> = {}
    if (name) userMetadata.name = name

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true, // Auto-confirm email (you may want to change this)
        user_metadata: Object.keys(userMetadata).length ? userMetadata : undefined,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      // Handle common errors
      if (res.status === 422 && data?.message?.includes('already registered')) {
        return NextResponse.json(
          { success: false, error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' } },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { success: false, error: { code: 'SIGNUP_FAILED', message: data?.message || 'Failed to create account' } },
        { status: res.status }
      )
    }

    // Create user in public.users and organization
    const supabase = createClient(supabaseUrl, serviceKey)
    
    // Check if user already exists in public.users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', data.id)
      .single()
    
    if (!existingUser) {
      // Get or create default organization
      let orgId: string | null = null
      
      // Try to find existing organizations
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (orgs && orgs.length > 0) {
        // Use existing organization
        orgId = orgs[0].id
        console.log(`Signup: using existing organization ${orgId} for ${email}`)
      } else {
        // Create new organization for this user
        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: `${name || email}'s Organization`,
            plan: 'professional',
            plan_status: 'active',
            created_by: data.id
          })
          .select()
          .single()
        
        if (orgError) {
          console.error('Failed to create organization:', orgError)
          return NextResponse.json(
            { success: false, error: { code: 'ORG_CREATION_FAILED', message: 'Failed to create organization. Please try again.' } },
            { status: 500 }
          )
        }
        
        orgId = newOrg.id
        console.log(`Signup: created organization ${orgId} for ${email}`)
        
        // Create default tool for this organization
        const { data: tool, error: toolError } = await supabase
          .from('tools')
          .insert({
            name: `Default Voice Tool`,
            description: `Default tool for call recordings and AI services`
          })
          .select('id')
          .single()
        
        if (toolError) {
          console.error('Failed to create tool:', toolError)
          // Continue without tool - organization will still work but recording might fail
        } else if (tool) {
          // Link tool to organization
          const { error: updateError } = await supabase
            .from('organizations')
            .update({ tool_id: tool.id })
            .eq('id', orgId)
          
          if (updateError) {
            console.error('Failed to link tool to organization:', updateError)
          } else {
            console.log(`Signup: created and linked tool ${tool.id} to organization ${orgId}`)
          }
        }
      }
      
      // CRITICAL: Always create user in public.users (orgId is now guaranteed to exist)
      if (!orgId) {
        return NextResponse.json(
          { success: false, error: { code: 'ORG_REQUIRED', message: 'Organization is required but missing' } },
          { status: 500 }
        )
      }
      
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: data.id,
          email: data.email,
          organization_id: orgId,
          role: 'member',
          is_admin: false
        })
      
      if (userError) {
        console.error('Failed to create user in public.users:', userError)
        return NextResponse.json(
          { success: false, error: { code: 'USER_CREATION_FAILED', message: 'Failed to create user record' } },
          { status: 500 }
        )
      }
      
      console.log(`Signup: created user ${data.id} in public.users with organization ${orgId}`)
      
      // Create org membership (first user becomes owner, others are members)
      const isFirstUser = !orgs || orgs.length === 0
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          organization_id: orgId,
          user_id: data.id,
          role: isFirstUser ? 'owner' : 'member'
        })
      
      if (memberError) {
        console.error('Failed to create org membership:', memberError)
        return NextResponse.json(
          { success: false, error: { code: 'MEMBER_CREATION_FAILED', message: 'Failed to create organization membership' } },
          { status: 500 }
        )
      }
      
      console.log(`Signup: created org_members record for ${email} as ${isFirstUser ? 'owner' : 'member'}`)
      
      // Create default voice_configs for new organization
      const { error: voiceConfigError } = await supabase
        .from('voice_configs')
        .insert({
          organization_id: orgId,
          record: true,
          transcribe: true,
          translate: false,
          translate_from: 'en-US',
          translate_to: 'es-ES',
          survey: false,
          synthetic_caller: false
        })
      
      if (voiceConfigError) {
        console.error('Failed to create voice_configs:', voiceConfigError)
        // Don't fail signup, but log the error
      } else {
        console.log(`Signup: created voice_configs for organization ${orgId}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. You can now sign in.',
      user: {
        id: data?.id,
        email: data?.email,
      }
    })

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: err?.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}

// Apply rate limiting per architecture: Security boundaries
export const POST = withRateLimit(handleSignup, {
  identifier: (req) => getClientIP(req),
  config: {
    maxAttempts: 5, // 5 signup attempts
    windowMs: 60 * 60 * 1000, // per hour
    blockMs: 60 * 60 * 1000 // 1 hour block on abuse
  }
})
