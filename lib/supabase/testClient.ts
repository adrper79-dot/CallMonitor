/**
 * Test client for Supabase mocking
 * Provides a simple in-memory mock that matches Supabase client API
 */

type QueryBuilder = {
  select: (cols?: string) => QueryBuilder
  insert: (row: any) => Promise<{ data: any; error: any }>
  update: (changes: any) => QueryBuilder
  eq: (col: string, val: any) => QueryBuilder
  in: (col: string, arr: any[]) => QueryBuilder
  limit: (n: number) => QueryBuilder
  single: () => Promise<{ data: any; error: any }>
  then: (resolve: (value: { data: any; error: any }) => void) => Promise<{ data: any; error: any }>
}

export function createMockSupabaseClient() {
  const mockData: Record<string, any[]> = {}

  const createQueryBuilder = (tableName: string): QueryBuilder => {
    let chain: Array<{ type: string; args: any[] }> = []

    const builder: QueryBuilder = {
      select: (cols?: string) => {
        chain.push({ type: 'select', args: [cols] })
        return builder
      },
      insert: async (row: any) => {
        if (!mockData[tableName]) mockData[tableName] = []
        mockData[tableName].push(row)
        return { data: row, error: null }
      },
      update: (changes: any) => {
        chain.push({ type: 'update', args: [changes] })
        return builder
      },
      eq: (col: string, val: any) => {
        chain.push({ type: 'eq', args: [col, val] })
        return builder
      },
      in: (col: string, arr: any[]) => {
        chain.push({ type: 'in', args: [col, arr] })
        return builder
      },
      limit: (n: number) => {
        chain.push({ type: 'limit', args: [n] })
        return builder
      },
      single: async () => {
        return { data: mockData[tableName]?.[0] || null, error: null }
      },
      then: async (resolve: (value: { data: any; error: any }) => void) => {
        const result = { data: mockData[tableName] || [], error: null }
        resolve(result)
        return result
      }
    }

    return builder
  }

  return {
    from: (table: string) => createQueryBuilder(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: any, options?: any) => {
          return { data: { path }, error: null }
        },
        download: async (path: string) => {
          return { data: new Blob(), error: null }
        },
        remove: async (paths: string[]) => {
          return { data: {}, error: null }
        },
        createSignedUrl: async (path: string, expiresIn: number) => {
          return { data: { signedUrl: `https://mock.supabase.co/${bucket}/${path}` }, error: null }
        },
        getPublicUrl: (path: string) => {
          return { data: { publicUrl: `https://mock.supabase.co/${bucket}/${path}` } }
        }
      })
    }
  }
}

export const mockSupabaseClient = createMockSupabaseClient()
