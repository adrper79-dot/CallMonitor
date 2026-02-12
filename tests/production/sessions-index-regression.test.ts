import { describe, it, expect } from 'vitest'
import { query } from './setup'

describe('sessions.user_id index regression', () => {
  it('has idx_sessions_user_id present', async () => {
    const rows = await query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'sessions' AND indexname = 'idx_sessions_user_id'`
    )
    expect(rows.length).toBeGreaterThan(0)
  })
})
