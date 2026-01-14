/**
 * Supabase Admin Client (Service Role)
 * 
 * This client uses the service role key which bypasses Row Level Security (RLS).
 * Use this ONLY for server-side operations that require elevated permissions.
 * 
 * NEVER expose the service role key to the client!
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton instance - lazily initialized to avoid build-time errors
let supabaseAdminInstance: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance
  }

  // Support both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL for compatibility
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return supabaseAdminInstance
}

// Create a proxy that lazily initializes the client on first access
const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(target, prop, receiver) {
    const client = getSupabaseAdmin()
    const value = (client as any)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})

export default supabaseAdmin
