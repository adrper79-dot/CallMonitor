
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.vercel/.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPlan() {
    const orgId = '3de7c01f-48e8-436a-9b49-f411d2b0bc91' // From debug output
    console.log(`Checking plan for Org: ${orgId}`)

    const { data, error } = await supabase
        .from('organizations')
        .select('id, name, plan')
        .eq('id', orgId)
        .single()

    if (error) {
        console.error(error)
    } else {
        console.log('Organization Data:', data)
    }
}

checkPlan().catch(console.error)
