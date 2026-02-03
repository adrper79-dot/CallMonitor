import { describe, it, expect } from 'vitest'
import startCallHandler from '@/app/actions/calls/startCallHandler'

/**
 * @legacy: This test uses Supabase stubs but startCallHandler now uses pgClient
 * TODO: Migrate to pgClient mocking or full integration test
 * Skip entirely - will be replaced with proper integration tests
 */
const describeOrSkip = describe.skip

function makeSupabaseStub(orgId: string, callId: string) {
  const aiInserts: any[] = []

  const makeBuilder = (table: string) => {
    const builder: any = {
      // eq chains to allow .eq(...).eq(...).limit(1)
      eq: (_col: string, _val: any) => builder,
      in: (_col: string, _vals: any[]) => Promise.resolve({ data: table === 'systems' ? [{ id: 'sys-cpid', key: 'system-cpid' }, { id: 'sys-ai', key: 'system-ai' }] : null, error: null }),
      limit: (_n: number) => {
        if (table === 'organizations') return Promise.resolve({ data: [{ id: orgId, plan: 'pro', tool_id: 'tool-1' }], error: null })
        if (table === 'org_members') return Promise.resolve({ data: [{ id: 'm1', role: 'admin' }], error: null })
        if (table === 'voice_configs') return Promise.resolve({ data: [{ id: 'vc-1', organization_id: orgId, record: true, transcribe: false, translate: false, translate_from: null, translate_to: null, survey: false, synthetic_caller: false }], error: null })
        if (table === 'calls') return Promise.resolve({ data: [{ id: callId, organization_id: orgId, system_id: 'sys-cpid', status: 'in-progress', created_by: 'user-1' }], error: null })
        return Promise.resolve({ data: null, error: null })
      }
    }
    return builder
  }

  return {
    aiInserts,
    from: (table: string) => {
      return {
        select: (_cols?: string) => makeBuilder(table),
        insert: (r: any) => {
          if (table === 'ai_runs') { aiInserts.push(r); return Promise.resolve({ data: null, error: null }) }
          return Promise.resolve({ data: null, error: null })
        },
        update: (_r: any) => ({ eq: (_col: string, _val: any) => Promise.resolve({ data: null, error: null }) }),
        // in is exposed for cases where callers use .select(...).in(...)
        in: (_col: string, _arr: string[]) => makeBuilder(table).in(_col, _arr)
      }
    }
  }
}

describeOrSkip('startCallHandler enforce voice_configs', () => {
  it('does not enqueue translation when voice_configs.translate = false', async () => {
    const orgId = '11111111-1111-1111-1111-111111111111'
    const callId = '22222222-2222-2222-2222-222222222222'
    const supabase = makeSupabaseStub(orgId, callId)

    const deps: any = {
      supabaseAdmin: supabase,
      getSession: async () => ({ user: { id: 'user-1' } }),
      signalwireCall: async () => ({ call_sid: 'mock-sid-123' }),
      env: { NODE_ENV: 'test', NEXT_PUBLIC_APP_URL: 'http://localhost' }
    }

    const res = await startCallHandler({ organization_id: orgId, phone_number: '+14155550100', modulations: { record: true, transcribe: true, translate: true } }, deps)

    // debug output for failures
     
    console.log('startCallHandler response:', res)

    expect(res.success).toBe(true)
    // ensure no ai_runs were inserted because voice_configs.translate = false
    expect(supabase.aiInserts.length).toBe(0)
  })
})
