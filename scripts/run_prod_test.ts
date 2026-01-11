import { createClient } from '@supabase/supabase-js'
import startCallHandler from '../app/actions/calls/startCallHandler.ts'
import readline from 'readline'

function checkRequiredEnv(required: string[]) {
  const missing = required.filter(k => !process.env[k])
  if (missing.length) {
    console.error('Missing required env vars:', missing.join(', '))
    process.exit(1)
  }
}

async function promptConfirm(question: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise<string>((resolve) => {
    rl.question(question, (ans) => { rl.close(); resolve(ans) })
  })
}

async function main() {
  if (process.env.RUN_TEST_IN_PROD !== 'true') {
    console.error('Refusing to run: set RUN_TEST_IN_PROD=true to confirm you understand this will operate against production systems')
    process.exit(1)
  }

  const required = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SIGNALWIRE_PROJECT_ID','SIGNALWIRE_TOKEN','SIGNALWIRE_SPACE','SIGNALWIRE_NUMBER','NEXT_PUBLIC_APP_URL','TEST_ORG_ID','TEST_FROM_NUMBER','TEST_TO_NUMBER']
  checkRequiredEnv(required)

  const confirm = (process.env.RUN_TEST_CONFIRMATION || (await promptConfirm('Type YES to run in prod: '))).trim()
  if (confirm !== 'YES') {
    console.error('Aborted by user — confirmation not provided')
    process.exit(1)
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const signalwireProject = process.env.SIGNALWIRE_PROJECT_ID!
  const signalwireToken = process.env.SIGNALWIRE_TOKEN!
  const rawSpace = process.env.SIGNALWIRE_SPACE!
  const swSpace = rawSpace.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\.signalwire\.com$/i, '').trim()
  const swNumber = process.env.SIGNALWIRE_NUMBER!

  const signalwireCall = async ({ from, to, url, statusCallback }: { from: string; to: string; url: string; statusCallback: string }) => {
    const auth = Buffer.from(`${signalwireProject}:${signalwireToken}`).toString('base64')
    const params = new URLSearchParams()
    params.append('From', from)
    params.append('To', to)
    params.append('Url', url)
    params.append('StatusCallback', statusCallback)
    const endpoint = `https://${swSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${signalwireProject}/Calls.json`
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params })
    if (!res.ok) throw new Error(`SignalWire call failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    return { call_sid: data?.sid }
  }

  const input = {
    organization_id: process.env.TEST_ORG_ID!,
    from_number: process.env.TEST_FROM_NUMBER!,
    phone_number: process.env.TEST_TO_NUMBER!,
    flow_type: 'bridge',
    modulations: { record: true, transcribe: true, translate: true }
  }

  const res = await startCallHandler(input as any, { supabaseAdmin: supabase as any, getSession: async () => ({ user: { id: process.env.TEST_ACTOR_ID ?? null } }), signalwireCall: signalwireCall as any, env: process.env })
  console.log('prod startCall result:', res)
}

main().catch((e) => { console.error('prod-run failed', e); process.exit(1) })
