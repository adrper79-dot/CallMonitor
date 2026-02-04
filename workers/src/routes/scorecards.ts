import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const scorecardsRoutes = new Hono<{ Bindings: Env }>()

scorecardsRoutes.post('/', async (c) => {
  // const session = await requireAuth(c)
  // if (!session) return c.json({ error: 'Unauthorized' }, 401)
  
  // Stub: scorecard create
  return c.json({ success: true, scorecardId: crypto.randomUUID() })
})

scorecardsRoutes.get('/alerts', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  
  // Stub: empty alerts
  return c.json({ alerts: [] })
})