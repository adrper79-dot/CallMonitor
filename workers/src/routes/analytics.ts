import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const analyticsRoutes = new Hono<{ Bindings: Env }>()

// Stub all analytics endpoints
analyticsRoutes.get('*', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  
  return c.json({ data: [], total: 0 })
})

analyticsRoutes.post('/export', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  
  return c.json({ success: true, downloadUrl: '/api/export-placeholder.csv' })
})