/**
 * Compliance Tests
 * HIPAA isolation and SOC2 immutability
 */

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:password@localhost:5432/neondb'
})

describe('HIPAA Compliance', () => {
  test('cross-tenant query fails', async () => {
    // Set session for org A
    await pool.query('SET LOCAL current_organization_id = $1', ['org-a'])

    // Try to query org B data
    const result = await pool.query('SELECT * FROM calls WHERE organization_id = $1', ['org-b'])
    expect(result.rows.length).toBe(0) // RLS should block
  })
})

describe('SOC2 Immutability', () => {
  test('no UPDATE on PHI tables', async () => {
    try {
      await pool.query('UPDATE calls SET notes = $1 WHERE id = $2', ['test', 'some-id'])
      expect(true).toBe(false) // Should not reach
    } catch (error) {
      expect((error as Error).message).toContain('immutable')
    }
  })
})