import { describe, it, expect } from 'vitest'

// @legacy: This test uses Supabase stubs but startCallHandler now uses pgClient
// TODO: Migrate to pgClient mocking or full integration test
// Skip entirely - will be replaced with proper integration tests
const describeOrSkip = describe.skip

import startCallHandler from '@/app/actions/calls/startCallHandler'

function makeSupabaseStub(orgId: string, callId: string, effectiveOrgId?: string) {
  // effectiveOrgId is the org ID that will actually be used (after override logic)
  const actualOrgId = effectiveOrgId || orgId
  let callInserted = false
  
  return {
    from: (table: string) => {
      // Organizations lookup: .select().eq().limit()
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              // Support lookup by either original or effective org ID
              const lookupId = (val === orgId || val === actualOrgId) ? actualOrgId : val
              return {
                limit: () => Promise.resolve({ data: [{ id: lookupId, plan: 'pro', tool_id: 'tool-1' }], error: null })
              }
            }
          })
        }
      }
      
      // Org members lookup: .select().eq().eq().limit()
      if (table === 'org_members') {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              eq: (col2: string, val2: string) => ({
                limit: () => {
                  // Support lookup by either original or effective org ID
                  const lookupOrgId = (col === 'organization_id' && (val === orgId || val === actualOrgId)) 
                    ? actualOrgId 
                    : (col2 === 'organization_id' && (val2 === orgId || val2 === actualOrgId))
                    ? actualOrgId
                    : val || val2
                  return Promise.resolve({ data: [{ id: 'm1', role: 'admin', organization_id: lookupOrgId }], error: null })
                }
              })
            })
          })
        }
      }
      
      // Systems lookup: .select().in()
      if (table === 'systems') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [{ id: 'sys-cpid', key: 'system-cpid' }, { id: 'sys-ai', key: 'system-ai' }], error: null })
          })
        }
      }
      
      // Voice configs lookup: .select().eq().limit()
      if (table === 'voice_configs') {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              // Support lookup by either original or effective org ID
              const lookupId = (val === orgId || val === actualOrgId) ? actualOrgId : val
              return {
                limit: () => Promise.resolve({ data: [{ record: false, transcribe: false }], error: null })
              }
            }
          })
        }
      }
      
      // Calls table: insert, update, select
      if (table === 'calls') {
        return {
          insert: (row: any) => {
            callInserted = true
            return Promise.resolve({ data: [{ id: callId, ...row }], error: null })
          },
          update: (row: any) => ({
            eq: () => Promise.resolve({ data: null, error: null })
          }),
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [{ id: callId, organization_id: actualOrgId, system_id: 'sys-cpid', status: 'in-progress', created_by: 'user-1', ...(callInserted ? { call_sid: 'mock-sid-123' } : {}) }], error: null })
            })
          })
        }
      }
      
      // AI runs: insert only
      if (table === 'ai_runs') {
        return { 
          insert: (r: any) => Promise.resolve({ data: null, error: null }) 
        }
      }
      
      // Audit logs: insert only
      if (table === 'audit_logs') {
        return { 
          insert: (r: any) => Promise.resolve({ data: null, error: null }) 
        }
      }
      
      // Default fallback
      return {
        select: () => Promise.resolve({ data: null, error: null }),
        insert: (r: any) => Promise.resolve({ data: null, error: null }),
        update: (r: any) => Promise.resolve({ data: null, error: null }),
        eq: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }),
        limit: () => Promise.resolve({ data: null, error: null }),
        in: (col: string, arr: string[]) => Promise.resolve({ data: null, error: null })
      }
    }
  }
}

describeOrSkip('startCallHandler (unit)', () => {
  it('starts call happy path (mock SignalWire)', async () => {
    // Use an allowed organization ID from startCallHandler's OUTBOUND_ORG_IDS
    // This prevents the handler from overriding the org ID
    const orgId = '5f64d900-e212-42ab-bf41-7518f0bbcd4f'
    const callId = '22222222-2222-2222-2222-222222222222'
    const supabase = makeSupabaseStub(orgId, callId, orgId)

    const res = await startCallHandler({ 
      organization_id: orgId, 
      phone_number: '+14155550100', 
      modulations: { record: false, transcribe: false } 
    }, {
      supabaseAdmin: supabase,
      signalwireCall: async () => ({ call_sid: 'mock-sid-123' }),
      env: { 
        NODE_ENV: 'test', 
        NEXT_PUBLIC_APP_URL: 'http://localhost',
        // SignalWire config not needed when signalwireCall is injected
      }
    })

    if (!res.success) {
       
      console.error('startCallHandler test failed:', JSON.stringify(res.error, null, 2))
    }
    expect(res.success).toBe(true)
    if (res.success) expect(res.call_id).toBeDefined()
  })
})
