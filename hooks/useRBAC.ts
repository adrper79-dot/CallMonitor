"use client"

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/apiClient'
import { type UserRole, type Plan, normalizeRole } from '@/lib/rbac'

export type { UserRole, Plan }

export interface RBACState {
  role: UserRole | null
  plan: Plan | null
  loading: boolean
  error: string | null
}

/**
 * Hook to get user's RBAC context (role and plan)
 */
export function useRBAC(organizationId: string | null): RBACState {
  const [state, setState] = useState<RBACState>({
    role: null,
    plan: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    if (!organizationId) {
      setState({ role: null, plan: null, loading: false, error: null })
      return
    }

    async function fetchRBAC() {
      if (!organizationId) return // Guard for TypeScript
      try {
        // Fetch user's role and org plan using apiGet (includes credentials)
        const data = await apiGet(`/api/rbac/context?orgId=${encodeURIComponent(organizationId)}`)
        setState({
          role: normalizeRole(data.role),
          plan: data.plan || null,
          loading: false,
          error: null
        })
      } catch (err: any) {
        setState({
          role: null,
          plan: null,
          loading: false,
          error: err?.message || 'Failed to load permissions'
        })
      }
    }

    fetchRBAC()
  }, [organizationId])

  return state
}

/**
 * Hook to check if user can perform an action
 * NOTE: Pass the RBAC state from parent component to avoid duplicate API calls
 */
export function usePermission(
  organizationId: string | null,
  feature: string,
  action: 'read' | 'write' | 'execute',
  rbacState?: RBACState
): boolean {
  // Use provided RBAC state if available, otherwise fetch (for standalone use)
  const fetchedState = useRBAC(organizationId)
  const { role, plan, loading } = rbacState || fetchedState

  if (loading || !role || !plan) {
    return false
  }

  // Import and use permission check
  // For client-side, we'll do a simple hierarchy check
  // Full validation happens on backend
  const WRITE_ROLES: UserRole[] = ['owner', 'admin']
  const EXEC_ROLES: UserRole[] = ['owner', 'admin', 'manager', 'operator', 'agent']
  const READ_ROLES: UserRole[] = ['owner', 'admin', 'manager', 'operator', 'compliance', 'agent', 'analyst', 'viewer', 'member']

  const roleCanDo = 
    (action === 'read' && READ_ROLES.includes(role)) ||
    (action === 'write' && WRITE_ROLES.includes(role)) ||
    (action === 'execute' && EXEC_ROLES.includes(role))

  // Plan check would be done here too
  const planSupports = plan !== 'free' || feature === 'call'

  return roleCanDo && planSupports
}
