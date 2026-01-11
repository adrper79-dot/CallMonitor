import startCallHandler from '../app/actions/calls/startCallHandler.ts'

async function run() {
  let aiRunInserted = false

  const mockSupabase = {
    from: (table: string) => {
      return {
        select: (cols?: string) => {
          // return data depending on table
          if (table === 'organizations') return { then: (fn: any) => fn({ data: [{ id: 'org-1', plan: 'pro' }], error: null }) }
          if (table === 'org_members') return { then: (fn: any) => fn({ data: [{ id: 'm-1', role: 'member' }], error: null }) }
          if (table === 'systems') return { then: (fn: any) => fn({ data: [{ id: 'sys-cpid', key: 'system-cpid' }, { id: 'sys-ai', key: 'system-ai' }], error: null }) }
          if (table === 'voice_configs') return { then: (fn: any) => fn({ data: [{ id: 'vc-1', organization_id: 'org-1', record: true, transcribe: true, translate: false, translate_from: null, translate_to: null, survey: false, synthetic_caller: false }], error: null }) }
          if (table === 'calls') return { insert: async (row: any) => ({ data: [row], error: null }), update: async (row: any) => ({ data: [row], error: null }), select: () => ({ then: (fn: any) => fn({ data: [{ id: 'call-1' }], error: null }) }) }
          if (table === 'ai_runs') return { insert: async (row: any) => { aiRunInserted = true; return { data: [row], error: null } } }
          if (table === 'audit_logs') return { insert: async (row: any) => ({ data: [row], error: null }) }
          return { then: (fn: any) => fn({ data: null, error: null }) }
        },
        insert: async (row: any) => ({ data: [row], error: null }),
        update: async (row: any) => ({ data: [row], error: null })
      }
    }
  }

  const mockGetSession = async () => ({ user: { id: 'actor-1' } })

  const input = {
    organization_id: 'org-1',
    phone_number: '+15551234567',
    modulations: { record: true, transcribe: true, translate: true }
  }

  try {
    const res = await startCallHandler(input as any, { supabaseAdmin: mockSupabase as any, getSession: mockGetSession as any, env: { SIGNALWIRE_NUMBER: '+15550001111', NEXT_PUBLIC_APP_URL: 'https://example.test' } })
    console.log('handler response', res)
    console.log('aiRunInserted:', aiRunInserted)
    if (aiRunInserted) process.exit(2)
    process.exit(0)
  } catch (e) {
    console.error('error running handler', e)
    process.exit(3)
  }
}

run()
