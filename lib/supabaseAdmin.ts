// Minimal supabaseAdmin stub for tests and DI fallback.
type QueryResult = { data: any; error: any }

function makeQuery(table: string, cols?: string): any {
  const q: any = {
    _table: table,
    _cols: cols,
    eq: (col: string, val: any) => q,
    in: (col: string, arr: any[]) => q,
    limit: (n: number) => q,
    order: (col: string, opts?: any) => q,
    single: async () => ({ data: null, error: null }),
  }
  // make the query thenable so `await supabase.from(...).select(...).eq(...)` works
  q.then = (onFulfilled: any, onRejected?: any) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected)
  q.catch = (onRejected: any) => Promise.resolve({ data: null, error: null }).catch(onRejected)
  return q
}

export default {
  from: (table: string) => ({
    insert: async (row: any) => ({ data: [row], error: null }),
    update: async (row: any) => ({ data: [row], error: null }),
    // select returns a chainable query object; call .single() or await the terminal method
    select: (cols?: string) => makeQuery(table, cols),
    in: (col: string, arr: string[]) => ({ data: null, error: null })
  })
}
