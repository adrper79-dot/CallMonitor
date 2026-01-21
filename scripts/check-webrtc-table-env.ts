
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load env from .vercel/.env
const envPath = path.resolve(process.cwd(), '.vercel/.env')
if (fs.existsSync(envPath)) {
    console.log('Loading env from .vercel/.env')
    const envConfig = dotenv.parse(fs.readFileSync(envPath))
    for (const k in envConfig) {
        process.env[k] = envConfig[k]
    }
} else {
    // Try .env.local
    const localEnvPath = path.resolve(process.cwd(), '.env.local')
    if (fs.existsSync(localEnvPath)) {
        console.log('Loading env from .env.local')
        const envConfig = dotenv.parse(fs.readFileSync(localEnvPath))
        for (const k in envConfig) {
            process.env[k] = envConfig[k]
        }
    }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in env files.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })

async function check() {
    console.log('Checking webrtc_sessions table...')

    // Checks if table exists by selecting 1 row
    const { data, error } = await supabase.from('webrtc_sessions').select('*').limit(1)

    if (error) {
        console.error('Query Error:', error.message)
        console.log('Status: TABLE MISSING or PERMISSION DENIED')
    } else {
        console.log('Status: TABLE EXISTS')
        console.log('Row count check: Success')

        // Check columns by inspecting the returned data structure if any (or we assume schema is correct if query worked)
        // To be sure, we can try to insert a dummy (and rollback? No, just check Select)
    }
}

check()
