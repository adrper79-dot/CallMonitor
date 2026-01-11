import startCallHandler from '../app/actions/calls/startCallHandler.ts'
import { v4 as uuidv4 } from 'uuid'

const ORG_ID = '5f64d900-e212-42ab-bf41-7518f0bbcd4f'

// Minimal mock supabaseAdmin to let the handler run in a simulation
const mockSupabase = {
  from: (table: string) => {
    const dataFor = (t: string) => {
      if (t === 'organizations') return [{ id: ORG_ID, plan: 'pro', tool_id: 'tool-1' }]
      if (t === 'org_members') return [{ id: 'm1', role: 'admin' }]
      if (t === 'systems') return [{ id: 'sys-cpid', key: 'system-cpid' }, { id: 'sys-ai', key: 'system-ai' }]
      if (t === 'calls') return [{ id: 'call-1', organization_id: ORG_ID, system_id: 'sys-cpid', status: 'in-progress', started_at: new Date().toISOString(), ended_at: null, created_by: 'actor' }]
      return []
    }

    // return a small chainable query builder that implements select().eq().limit() and select().in()
    const builder = {
      _table: table,
      _filters: [] as any[],
      select(cols?: string) {
        return this
      },
      eq(col: string, val: any) {
        this._filters.push({ type: 'eq', col, val })
        return this
      },
      in(col: string, arr: any[]) {
        this._filters.push({ type: 'in', col, arr })
        return Promise.resolve({ data: dataFor(table), error: null })
      },
      limit: async (_n: number) => ({ data: dataFor(table), error: null })
    }

    return {
      select: (cols?: string) => builder.select(cols),
      insert: async (_row: any) => ({ data: null, error: null }),
      update: (_row: any) => ({ eq: async (_col: string, _val: any) => ({ data: null, error: null }) }),
      in: async (_col: string, _arr: any[]) => ({ data: dataFor(table), error: null }),
      // support calling builder methods directly if user destructures
      __builder: builder
    }
  }
}

// Mock session getter
const mockGetSession = async () => ({ user: { id: 'actor' } })

// Mock SignalWire caller to avoid real network
const mockSignalwireCall = async ({ from, to, url, statusCallback }: { from: string; to: string; url: string; statusCallback: string }) => {
  console.log('Mock SignalWire call placed', { from, to, url, statusCallback })
  return { call_sid: `mock-sid-${uuidv4()}` }
}

async function run() {
  const input = {
    organization_id: ORG_ID,
    from_number: '+17062677235',
    phone_number: '+12392027345',
    flow_type: 'bridge',
    modulations: { record: true, transcribe: true, translate: true }
  }

  const res = await startCallHandler(input as any, { supabaseAdmin: mockSupabase as any, getSession: mockGetSession as any, signalwireCall: mockSignalwireCall as any, env: { SIGNALWIRE_NUMBER: '+15551234567', NEXT_PUBLIC_APP_URL: 'https://example.test' } })
  console.log('startCallHandler result:', res)
}

run().catch((e) => { console.error('simulation failed', e) })
