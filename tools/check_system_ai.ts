
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

async function checkSystem() {
    console.log('Checking for system-ai...')

    const { data, error } = await supabase
        .from('systems')
        .select('*')
        .eq('key', 'system-ai')

    if (error) {
        console.error(error)
    } else {
        console.log('Systems Found:', data)
    }
}

checkSystem().catch(console.error)
