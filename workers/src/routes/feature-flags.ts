/**
 * Feature Flags Routes - Dynamic feature flag management
 *
 * Endpoints:
 *   GET  /global          - List global feature flags
 *   POST /global          - Create global feature flag
 *   GET  /global/:feature - Get global feature flag
 *   PUT  /global/:feature - Update global feature flag
 *   DEL  /global/:feature - Delete global feature flag
 *   GET  /org             - List org feature flags
 *   POST /org             - Create org feature flag
 *   GET  /org/:feature    - Get org feature flag
 *   PUT  /org/:feature    - Update org feature flag
 *   DEL  /org/:feature    - Delete org feature flag
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import {
  CreateGlobalFeatureFlagSchema,
  UpdateGlobalFeatureFlagSchema,
  CreateOrgFeatureFlagSchema,
  UpdateOrgFeatureFlagSchema,
} from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { adminRateLimit } from '../lib/rate-limit'

export const featureFlagRoutes = new Hono<AppEnv>()

/** Roles at admin level or above in the RBAC hierarchy (for org-scoped flags) */
const ADMIN_ROLES = ['admin', 'owner']

/**
 * Guard for global feature flag endpoints.
 * Global flags affect ALL tenants — requires platform_admin role.
 * @see ARCH_DOCS/06-REFERENCE/ENGINEERING_GUIDE.md Appendix A, Issue #6
 */
function requirePlatformAdmin(session: { platform_role?: string; role: string }): boolean {
  return session.platform_role === 'platform_admin'
}

// Global Feature Flags

// GET /global - List all global feature flags
featureFlagRoutes.get('/global', adminRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!requirePlatformAdmin(session)) return c.json({ error: 'Platform admin access required' }, 403)

  const db = getDb(c.env)
  try {
    const result = await db.query(
      'SELECT id, feature, enabled, created_at FROM global_feature_flags ORDER BY feature ASC'
    )

    return c.json({ data: result.rows })
  } catch (err: any) {
    logger.error('Failed to list global feature flags', { error: err?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// POST /global - Create global feature flag
featureFlagRoutes.post('/global', adminRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!requirePlatformAdmin(session)) return c.json({ error: 'Platform admin access required' }, 403)

  const parsed = await validateBody(c, CreateGlobalFeatureFlagSchema)
  if (!parsed.success) return c.json({ error: parsed.error }, 400)

  const db = getDb(c.env)
  try {
    const result = await db.query(
      'INSERT INTO global_feature_flags (feature, enabled) VALUES ($1, $2) RETURNING *',
      [parsed.data.feature, parsed.data.enabled]
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.FEATURE_FLAG_CREATED,
      resourceType: 'global_feature_flag',
      resourceId: result.rows[0].id,
      oldValue: null,
      newValue: result.rows[0],
    })

    return c.json({ data: result.rows[0] }, 201)
  } catch (error: any) {
    if (error.code === '23505') { // unique violation
      return c.json({ error: 'Feature flag already exists' }, 409)
    }
    logger.error('Failed to create global feature flag', { error: error?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// GET /global/:feature - Get specific global feature flag
featureFlagRoutes.get('/global/:feature', adminRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!requirePlatformAdmin(session)) return c.json({ error: 'Platform admin access required' }, 403)

  const feature = c.req.param('feature')
  const db = getDb(c.env)
  try {
    const result = await db.query(
      'SELECT id, feature, enabled, created_at FROM global_feature_flags WHERE feature = $1',
      [feature]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Feature flag not found' }, 404)
    }

    return c.json({ data: result.rows[0] })
  } catch (err: any) {
    logger.error('Failed to get global feature flag', { error: err?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// PUT /global/:feature - Update global feature flag
featureFlagRoutes.put('/global/:feature', adminRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!requirePlatformAdmin(session)) return c.json({ error: 'Platform admin access required' }, 403)

  const feature = c.req.param('feature')
  const parsed = await validateBody(c, UpdateGlobalFeatureFlagSchema)
  if (!parsed.success) return c.json({ error: parsed.error }, 400)

  const db = getDb(c.env)
  try {
    const existing = await db.query(
      'SELECT * FROM global_feature_flags WHERE feature = $1',
      [feature]
    )

    if (existing.rows.length === 0) {
      return c.json({ error: 'Feature flag not found' }, 404)
    }

    const updates = []
    const values = []
    let paramIndex = 1

    if (parsed.data.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`)
      values.push(parsed.data.enabled)
    }

    if (updates.length === 0) {
      return c.json({ data: existing.rows[0] })
    }

    values.push(feature)
    const result = await db.query(
      `UPDATE global_feature_flags SET ${updates.join(', ')} WHERE feature = $${paramIndex} RETURNING *`,
      values
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.FEATURE_FLAG_UPDATED,
      resourceType: 'global_feature_flag',
      resourceId: result.rows[0].id,
      oldValue: existing.rows[0],
      newValue: result.rows[0],
    })

    return c.json({ data: result.rows[0] })
  } catch (err: any) {
    logger.error('Failed to update global feature flag', { error: err?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /global/:feature - Delete global feature flag
featureFlagRoutes.delete('/global/:feature', adminRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!requirePlatformAdmin(session)) return c.json({ error: 'Platform admin access required' }, 403)

  const feature = c.req.param('feature')
  const db = getDb(c.env)
  try {
    const existing = await db.query(
      'SELECT * FROM global_feature_flags WHERE feature = $1',
      [feature]
    )

    if (existing.rows.length === 0) {
      return c.json({ error: 'Feature flag not found' }, 404)
    }

    await db.query('DELETE FROM global_feature_flags WHERE feature = $1', [feature])

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.FEATURE_FLAG_DELETED,
      resourceType: 'global_feature_flag',
      resourceId: existing.rows[0].id,
      oldValue: existing.rows[0],
      newValue: null,
    })

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('Failed to delete global feature flag', { error: err?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// Org Feature Flags

// GET /org - List org feature flags
featureFlagRoutes.get('/org', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!ADMIN_ROLES.includes(session.role)) return c.json({ error: 'Admin access required' }, 403)

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `SELECT id, organization_id, feature, enabled, disabled_reason, disabled_at, disabled_by,
              daily_limit, monthly_limit, current_daily_usage, current_monthly_usage, usage_reset_at, created_at, updated_at
       FROM org_feature_flags
       WHERE organization_id = $1
       ORDER BY feature ASC`,
      [session.organization_id]
    )

    return c.json({ data: result.rows })
  } catch (err: any) {
    logger.error('Failed to list org feature flags', { error: err?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// POST /org - Create org feature flag
featureFlagRoutes.post('/org', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!ADMIN_ROLES.includes(session.role)) return c.json({ error: 'Admin access required' }, 403)

  const parsed = await validateBody(c, CreateOrgFeatureFlagSchema)
  if (!parsed.success) return c.json({ error: parsed.error }, 400)

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `INSERT INTO org_feature_flags (organization_id, feature, enabled, disabled_reason, daily_limit, monthly_limit)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        session.organization_id,
        parsed.data.feature,
        parsed.data.enabled,
        parsed.data.disabled_reason,
        parsed.data.daily_limit,
        parsed.data.monthly_limit,
      ]
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.FEATURE_FLAG_CREATED,
      resourceType: 'org_feature_flag',
      resourceId: result.rows[0].id,
      oldValue: null,
      newValue: result.rows[0],
    })

    return c.json({ data: result.rows[0] }, 201)
  } catch (error: any) {
    if (error.code === '23505') { // unique violation
      return c.json({ error: 'Feature flag already exists for this organization' }, 409)
    }
    logger.error('Failed to create org feature flag', { error: error?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// GET /org/:feature - Get specific org feature flag
featureFlagRoutes.get('/org/:feature', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!ADMIN_ROLES.includes(session.role)) return c.json({ error: 'Admin access required' }, 403)

  const feature = c.req.param('feature')
  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `SELECT id, organization_id, feature, enabled, disabled_reason, disabled_at, disabled_by,
              daily_limit, monthly_limit, current_daily_usage, current_monthly_usage, usage_reset_at, created_at, updated_at
       FROM org_feature_flags
       WHERE organization_id = $1 AND feature = $2`,
      [session.organization_id, feature]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Feature flag not found' }, 404)
    }

    return c.json({ data: result.rows[0] })
  } catch (err: any) {
    logger.error('Failed to get org feature flag', { error: err?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// PUT /org/:feature - Update org feature flag
featureFlagRoutes.put('/org/:feature', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!ADMIN_ROLES.includes(session.role)) return c.json({ error: 'Admin access required' }, 403)

  const feature = c.req.param('feature')
  const parsed = await validateBody(c, UpdateOrgFeatureFlagSchema)
  if (!parsed.success) return c.json({ error: parsed.error }, 400)

  const db = getDb(c.env, session.organization_id)
  try {
    const existing = await db.query(
      'SELECT * FROM org_feature_flags WHERE organization_id = $1 AND feature = $2',
      [session.organization_id, feature]
    )

    if (existing.rows.length === 0) {
      return c.json({ error: 'Feature flag not found' }, 404)
    }

    const updates = []
    const values = []
    let paramIndex = 1

    if (parsed.data.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`)
      values.push(parsed.data.enabled)
      if (!parsed.data.enabled) {
        updates.push(`disabled_at = NOW()`)
        updates.push(`disabled_by = $${paramIndex++}`)
        values.push(session.user_id)
      } else {
        updates.push(`disabled_at = NULL`)
        updates.push(`disabled_by = NULL`)
      }
    }

    if (parsed.data.disabled_reason !== undefined) {
      updates.push(`disabled_reason = $${paramIndex++}`)
      values.push(parsed.data.disabled_reason)
    }

    if (parsed.data.daily_limit !== undefined) {
      updates.push(`daily_limit = $${paramIndex++}`)
      values.push(parsed.data.daily_limit)
    }

    if (parsed.data.monthly_limit !== undefined) {
      updates.push(`monthly_limit = $${paramIndex++}`)
      values.push(parsed.data.monthly_limit)
    }

    updates.push(`updated_at = NOW()`)

    if (updates.length === 1) { // only updated_at
      return c.json({ data: existing.rows[0] })
    }

    values.push(session.organization_id, feature)
    const result = await db.query(
      `UPDATE org_feature_flags SET ${updates.join(', ')} WHERE organization_id = $${paramIndex} AND feature = $${paramIndex + 1} RETURNING *`,
      values
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.FEATURE_FLAG_UPDATED,
      resourceType: 'org_feature_flag',
      resourceId: result.rows[0].id,
      oldValue: existing.rows[0],
      newValue: result.rows[0],
    })

    return c.json({ data: result.rows[0] })
  } catch (err: any) {
    logger.error('Failed to update org feature flag', { error: err?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /org/:feature - Delete org feature flag
featureFlagRoutes.delete('/org/:feature', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!ADMIN_ROLES.includes(session.role)) return c.json({ error: 'Admin access required' }, 403)

  const feature = c.req.param('feature')
  const db = getDb(c.env, session.organization_id)
  try {
    const existing = await db.query(
      'SELECT * FROM org_feature_flags WHERE organization_id = $1 AND feature = $2',
      [session.organization_id, feature]
    )

    if (existing.rows.length === 0) {
      return c.json({ error: 'Feature flag not found' }, 404)
    }

    await db.query('DELETE FROM org_feature_flags WHERE organization_id = $1 AND feature = $2', [session.organization_id, feature])

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.FEATURE_FLAG_DELETED,
      resourceType: 'org_feature_flag',
      resourceId: existing.rows[0].id,
      oldValue: existing.rows[0],
      newValue: null,
    })

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('Failed to delete org feature flag', { error: err?.message })
    return c.json({ error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})