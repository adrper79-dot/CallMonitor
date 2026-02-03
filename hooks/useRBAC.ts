"use client"

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/apiClient'

export type UserRole = 'owner' | 'admin' | 'operator' | 'analyst' | 'viewer'
export type Plan = 'base' | 'pro' | 'insights' | 'global' | 'business' | 'free' | 'enterprise' | 'trial' | 'standard' | 'active'

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
          role: data.role || null,
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
 */
export function usePermission(
  organizationId: string | null,
  feature: string,
  action: 'read' | 'write' | 'execute'
): boolean {
  const { role, plan, loading } = useRBAC(organizationId)

  if (loading || !role || !plan) {
    return false
  }

  // Import and use permission check
  // For client-side, we'll do a simple check
  // Full validation happens on backend
  const roleCanDo = ['owner', 'admin'].includes(role) || 
    (action === 'read' && ['operator', 'analyst', 'viewer'].includes(role)) ||
    (action === 'execute' && role === 'operator')

  // Plan check would be done here too
  const planSupports = plan !== 'free' || feature === 'call'

  return roleCanDo && planSupports
}
