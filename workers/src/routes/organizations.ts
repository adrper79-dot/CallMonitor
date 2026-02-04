import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const organizationsRoutes = new Hono<{ Bindings: Env }>()

// Create a new organization
organizationsRoutes.post('/', async (c) => {
  try {
    // Authenticate
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    console.log('Session object:', session)
    const { userId } = session
    console.log('Extracted userId:', userId)

    // Use neon client directly
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    // Check if user already has an organization
    const existingOrg = await sql`
      SELECT organization_id FROM org_members WHERE user_id = ${userId}
    `

    if (existingOrg.length > 0) {
      return c.json({ error: 'User is already part of an organization' }, 400)
    }

    // Parse request body
    const body = await c.req.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'Organization name is required' }, 400)
    }

    // Create organization
    let orgResult
    try {
      orgResult = await sql`
        INSERT INTO organizations (name, created_by)
        VALUES (${name.trim()}, ${userId})
        RETURNING id, name, created_at
      `
      console.log('Org insert result:', orgResult)
      console.log('First row:', orgResult[0])
    } catch (insertError) {
      console.error('INSERT error:', insertError)
      throw insertError
    }

    const org = orgResult[0]

    // Add user as admin member
    await sql`
      INSERT INTO org_members (organization_id, user_id, role)
      VALUES (${org.id}, ${userId}, 'admin')
    `

    return c.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        plan: 'free',
        plan_status: 'active',
        member_count: 1,
        created_at: org.created_at
      },
      role: 'admin',
      message: 'Organization created successfully'
    })
  } catch (err: any) {
    console.error('POST /api/organizations error:', err)
    return c.json({ error: err.message || 'Failed to create organization' }, 500)
  }
})

organizationsRoutes.get('/current', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Use neon client directly
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  const sql = neon(connectionString)

  const result = await sql`
    SELECT o.id, o.name, o.plan, om.role
    FROM organizations o
    JOIN org_members om ON om.organization_id = o.id
    WHERE om.user_id = ${session.userId}
    LIMIT 1
  `

  if (result.length === 0) {
    return c.json({ error: 'Organization not found' }, 404)
  }

  const org = result[0]

  return c.json({
    success: true,
    organization: {
      id: org.id,
      name: org.name,
      plan: org.plan || 'free',
      plan_status: 'active'
    },
    role: org.role || 'viewer'
  })
})