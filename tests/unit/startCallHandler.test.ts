import { describe, it, expect } from 'vitest'
import startCallHandler from '@/app/actions/calls/startCallHandler'

function makeSupabaseStub(orgId: string, callId: string) {
  return {
    from: (table: string) => {
      return {
        select: (cols?: string) => {
          if (table === 'organizations') return Promise.resolve({ data: [{ id: orgId, plan: 'pro', tool_id: 'tool-1' }], error: null })
          if (table === 'org_members') return Promise.resolve({ data: [{ id: 'm1', role: 'admin' }], error: null })
          if (table === 'systems') return Promise.resolve({ data: [{ id: 'sys-cpid', key: 'system-cpid' }, { id: 'sys-ai', key: 'system-ai' }], error: null })
          if (table === 'calls') return {
            insert: (row: any) => Promise.resolve({ data: null, error: null }),
            update: (row: any) => Promise.resolve({ data: null, error: null }),
            select: (cols?: string) => Promise.resolve({ data: [{ id: callId, organization_id: orgId, system_id: 'sys-cpid', status: 'in-progress', created_by: 'user-1' }], error: null })
          }
          if (table === 'ai_runs') return { insert: (r: any) => Promise.resolve({ data: null, error: null }) }
          if (table === 'audit_logs') return { insert: (r: any) => Promise.resolve({ data: null, error: null }) }
          return Promise.resolve({ data: null, error: null })
        },
        eq: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }),
        limit: () => Promise.resolve({ data: null, error: null }),
        insert: (r: any) => Promise.resolve({ data: null, error: null }),
        update: (r: any) => Promise.resolve({ data: null, error: null }),
        in: (col: string, arr: string[]) => Promise.resolve({ data: null, error: null })
      }
    }
  }
}

describe('startCallHandler (unit)', () => {
  it('starts call happy path (mock SignalWire)', async () => {
    const orgId = '11111111-1111-1111-1111-111111111111'
    const callId = '22222222-2222-2222-2222-222222222222'
    const supabase = makeSupabaseStub(orgId, callId)

    const res = await startCallHandler({ organization_id: orgId, phone_number: '+14155550100', modulations: { record: false, transcribe: false } }, {
      supabaseAdmin: supabase,
      getSession: async () => ({ user: { id: 'user-1' } }),
      signalwireCall: async () => ({ call_sid: 'mock-sid-123' }),
      env: { NODE_ENV: 'test', NEXT_PUBLIC_APP_URL: 'http://localhost' }
    })

    expect(res.success).toBe(true)
    if (res.success) expect(res.call_id).toBeDefined()
  })
})
