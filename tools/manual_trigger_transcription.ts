
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.vercel/.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!)

async function manualTrigger() {
    const callId = '8d79c4e7-5e48-4cc4-b22e-ed65372be801'
    const recordingId = '2eb7f5ef-7f7a-414e-be6d-d3ab143253fb' // From audit logs
    const organizationId = '3de7c01f-48e8-436a-9b49-f411d2b0bc91'
    const recordingUrl = 'https://fiijrhpjpebevfavzlhu.supabase.co/storage/v1/object/public/recordings/3de7c01f-48e8-436a-9b49-f411d2b0bc91/8d79c4e7-5e48-4cc4-b22e-ed65372be801/2eb7f5ef-7f7a-414e-be6d-d3ab143253fb.wav' // Mocking from audit log structure

    console.log('--- Manual Transcription Trigger ---')
    console.log('Call ID:', callId)

    // 1. Check Config
    const { data: vcRows } = await supabaseAdmin
        .from('voice_configs')
        .select('transcribe')
        .eq('organization_id', organizationId)
        .limit(1)

    console.log('Voice Config:', vcRows?.[0])

    if (vcRows?.[0]?.transcribe !== true) {
        console.log('❌ Transcription disabled in config')
        return
    }

    // 2. Check Plan
    const { data: orgRows } = await supabaseAdmin
        .from('organizations')
        .select('plan')
        .eq('id', organizationId)
        .limit(1)

    console.log('Plan:', orgRows?.[0])
    if (orgRows?.[0]?.plan === 'free') {
        console.log('❌ Plan is free')
        return
    }

    // 3. Check System
    const { data: systemsRows } = await supabaseAdmin
        .from('systems')
        .select('id')
        .eq('key', 'system-ai')
        .limit(1)
    console.log('System AI:', systemsRows?.[0])

    if (!systemsRows?.[0]?.id) {
        console.log('❌ System AI missing')
        return
    }

    // 4. Check Env
    const apiKey = process.env.ASSEMBLYAI_API_KEY
    console.log('API Key Present:', !!apiKey)
    if (!apiKey) {
        console.log('❌ API Key Missing')
        return
    }

    console.log('✅ All checks passed. Simulating Insert...')
}

manualTrigger().catch(console.error)
