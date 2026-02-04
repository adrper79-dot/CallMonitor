import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const rbacRoutes = new Hono<{ Bindings: Env }>()

rbacRoutes.get('/context', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  
  const orgId = c.req.query('orgId')
  
  // Stub: basic permissions
  return c.json({
    role: session.role,
    permissions: ['read', 'write'], // expand per org/role
    orgId: orgId || session.organization_id
  })
})