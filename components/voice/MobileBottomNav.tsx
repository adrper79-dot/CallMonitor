'use client'

import React from 'react'
import {
  Phone,
  PhoneIncoming,
  Activity,
  LayoutDashboard,
  BarChart3,
  Users,
  Calendar,
  ListChecks,
  UserCircle2,
} from 'lucide-react'
import type { UserRole } from '@/hooks/useRBAC'

// Collector tabs: Queue, Dial, Accounts, Activity
// Supervisor tabs: Dashboard, Analytics, Teams, Activity
export type MobileTab =
  | 'dial'
  | 'calls'
  | 'updates'
  | 'queue'
  | 'accounts'
  | 'dashboard'
  | 'analytics'
  | 'teams'

interface MobileBottomNavProps {
  currentTab: MobileTab
  onTabChange: (tab: MobileTab) => void
  callsCount: number
  onScheduleClick: () => void
  role?: UserRole | null
}

interface NavItem {
  id: MobileTab
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>
  badge?: number
}

function getNavItems(
  role: UserRole | null | undefined,
  callsCount: number
): NavItem[] {
  // Supervisors: owner, admin, analyst
  if (role && ['owner', 'admin', 'analyst'].includes(role)) {
    return [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'teams', label: 'Teams', icon: Users },
      { id: 'updates', label: 'Activity', icon: Activity, badge: callsCount },
    ]
  }

  // Collectors / operators: queue-focused
  return [
    { id: 'queue', label: 'Queue', icon: ListChecks },
    { id: 'dial', label: 'Dial', icon: Phone },
    { id: 'calls', label: 'Accounts', icon: UserCircle2 },
    { id: 'updates', label: 'Activity', icon: Activity, badge: callsCount },
  ]
}

/**
 * MobileBottomNav - Persona-Based Design
 *
 * Collectors see: Queue | Dial | Accounts | Activity
 * Supervisors/owners see: Dashboard | Analytics | Teams | Activity
 * Schedule lives behind long-press or action sheet, not nav.
 */
export function MobileBottomNav({
  currentTab,
  onTabChange,
  callsCount,
  onScheduleClick,
  role,
}: MobileBottomNavProps) {
  const navItems = getNavItems(role, callsCount)

  // If current tab is not in the persona set, default to first
  const validTabs = navItems.map((n) => n.id)
  const activeTab = validTabs.includes(currentTab) ? currentTab : validTabs[0]

  return (
    <nav className="lg:hidden flex border-t border-gray-200 bg-white safe-area-bottom">
      {navItems.map((item) => {
        const isActive = activeTab === item.id
        const Icon = item.icon

        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`
              flex-1 flex flex-col items-center py-3 px-2 min-h-[56px] transition-colors relative
              ${isActive ? 'text-primary-600 bg-primary-50' : 'text-gray-500 hover:bg-gray-50'}
            `}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-5 h-5 mb-1" strokeWidth={2} />
            <span className="text-xs font-medium">{item.label}</span>

            {/* Notification Badge */}
            {item.badge && item.badge > 0 && (
              <span className="absolute top-2 right-1/4 bg-primary-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}