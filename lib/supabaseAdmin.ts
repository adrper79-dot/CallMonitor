/**
 * Supabase Admin Client (Service Role)
 * 
 * This client uses the service role key which bypasses Row Level Security (RLS).
 * Use this ONLY for server-side operations that require elevated permissions.
 * 
 * NEVER expose the service role key to the client!
 */

import { createClient } from '@supabase/supabase-js'

// Support both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL for compatibility
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export default supabaseAdmin
