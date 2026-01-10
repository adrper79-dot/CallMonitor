// Minimal supabaseAdmin stub for tests and DI fallback.
const noop = () => ({ insert: async () => ({ data: null, error: null }), update: async () => ({ data: null, error: null }), select: async () => ({ data: null, error: null }) })

export default {
  from: (table: string) => ({
    insert: async (row: any) => ({ data: null, error: null }),
    update: async (row: any) => ({ data: null, error: null }),
    select: async (cols?: string) => ({ data: null, error: null }),
    in: async (col: string, arr: string[]) => ({ data: null, error: null })
  })
}
