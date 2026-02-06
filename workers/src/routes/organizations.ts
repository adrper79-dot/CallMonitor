import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CreateOrgSchema } from '../lib/schemas'

export const organizationsRoutes = new Hono<{ Bindings: Env }>()

// Create a new organization
organizationsRoutes.post('/', async (c) => {
  try {
    // Authenticate
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const { user_id } = session

    // Use neon client directly
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    // Check if user already has an organization
    const existingOrg = await sql`
      SELECT organization_id FROM org_members WHERE user_id = ${user_id}
    `

    if (existingOrg.length > 0) {
      return c.json({ error: 'User is already part of an organization' }, 400)
    }

    // Parse request body
    const parsed = await validateBody(c, CreateOrgSchema)
    if (!parsed.success) return parsed.response
    const { name } = parsed.data

    // Create organization
    let orgResult
    try {
      orgResult = await sql`
        INSERT INTO organizations (name, created_by)
        VALUES (${name.trim()}, ${user_id})
        RETURNING id, name, created_at
      `
    } catch (insertError: any) {
      console.error('POST /api/organizations insert error:', insertError?.message)
      throw insertError
    }

    const org = orgResult[0]

    // Add user as admin member
    await sql`
      INSERT INTO org_members (organization_id, user_id, role)
      VALUES (${org.id}, ${user_id}, 'admin')
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
    console.error('POST /api/organizations error:', err?.message)
    return c.json({ error: 'Failed to create organization' }, 500)
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
    WHERE om.user_id = ${session.user_id}
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