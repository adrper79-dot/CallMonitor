'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { signOut, useSession } from '@/components/AuthProvider'
import { ModeToggle } from '@/components/mode-toggle'
import { BondAIChat } from '@/components/bond-ai'
import OrgSwitcher from '@/components/teams/OrgSwitcher'
import { useRBAC } from '@/hooks/useRBAC'
import { logger } from '@/lib/logger'
import {
  getRoleShell,
  getNavGroups,
  isNavActive,
  type NavGroup,
  type NavItem,
  type RoleShell as RoleShellType,
} from '@/lib/navigation'
import CommandPalette from '@/components/layout/CommandPalette'
import {
  Home, Phone, Users, Calendar, Wrench, BarChart3, Monitor,
  Shield, DollarSign, Megaphone, FileBarChart, Settings, ShieldCheck,
  CalendarCheck, ListOrdered, PhoneOutgoing, PhoneCall, CreditCard,
  Upload, AlertTriangle, Clock, CalendarDays, FileText, BookOpen,
  ScrollText, Calculator, Trophy, LayoutDashboard, Radio, UserCog,
  ClipboardCheck, GraduationCap, ShieldAlert, PhoneOff, Scale,
  Wallet, CalendarRange, ArrowLeftRight, XCircle, TrendingUp, Target,
  UserCheck, Play, GitBranch, MessageSquare, Building2, Activity,
  Receipt, Mic, Brain, Database, Webhook, ChevronDown, ChevronRight,
  LogOut, HelpCircle, Search, type LucideIcon,
} from 'lucide-react'

// Icon map for dynamic icon resolution
const ICON_MAP: Record<string, LucideIcon> = {
  Home, Phone, Users, Calendar, Wrench, BarChart3, Monitor,
  Shield, DollarSign, Megaphone, FileBarChart, Settings, ShieldCheck,
  CalendarCheck, ListOrdered, PhoneOutgoing, PhoneCall, CreditCard,
  Upload, AlertTriangle, Clock, CalendarDays, FileText, BookOpen,
  ScrollText, Calculator, Trophy, LayoutDashboard, Radio, UserCog,
  ClipboardCheck, GraduationCap, ShieldAlert, PhoneOff, Scale,
  Wallet, CalendarRange, ArrowLeftRight, XCircle, TrendingUp, Target,
  UserCheck, Play, GitBranch, MessageSquare, Building2, Activity,
  Receipt, Mic, Brain, Database, Webhook,
}

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Home
}

// ─────────────────────────────────────────────
// Nav Group Component — Collapsible group
// ─────────────────────────────────────────────

function NavGroupSection({
  group,
  pathname,
  collapsed,
  onToggle,
}: {
  group: NavGroup
  pathname: string
  collapsed: boolean
  onToggle: () => void
}) {
  const GroupIcon = getIcon(group.icon)
  const hasActiveChild = group.items.some((item) => isNavActive(pathname, item.href))

  // Single-item groups render as direct links
  if (group.items.length === 1) {
    const item = group.items[0]
    const ItemIcon = getIcon(item.icon)
    const active = isNavActive(pathname, item.href)
    return (
      <Link
        href={item.href}
        className={`
          flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
          ${active
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'}
        `}
      >
        <ItemIcon className={`w-4 h-4 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
        <span>{group.label}</span>
      </Link>
    )
  }

  return (
    <div>
      {/* Group header — toggles collapse */}
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
          ${hasActiveChild
            ? 'text-primary-700 dark:text-primary-400'
            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}
        `}
      >
        <GroupIcon className={`w-4 h-4 ${hasActiveChild ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
        <span className="flex-1 text-left">{group.label}</span>
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>

      {/* Child items */}
      {!collapsed && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-3">
          {group.items.map((item) => {
            const ItemIcon = getIcon(item.icon)
            const active = isNavActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors
                  ${active
                    ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/20 dark:text-primary-400'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'}
                `}
              >
                <ItemIcon className={`w-3.5 h-3.5 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-medium">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Role Shell Badge
// ─────────────────────────────────────────────

function RoleBadge({ shell }: { shell: RoleShellType }) {
  const colors: Record<RoleShellType, string> = {
    agent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    manager: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    admin: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  }
  const labels: Record<RoleShellType, string> = {
    agent: 'Agent',
    manager: 'Manager',
    admin: 'Admin',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[shell]}`}>
      {labels[shell]}
    </span>
  )
}

// ─────────────────────────────────────────────
// Main Export: RoleShell
// ─────────────────────────────────────────────

interface RoleShellProps {
  children: React.ReactNode
  organizationName?: string
  organizationId?: string | null
  userEmail?: string
}

/**
 * RoleShell — Role-aware navigation shell
 *
 * Replaces AppShell with flow-grouped, collapsible navigation.
 * Auto-detects role via useRBAC and shows appropriate nav groups.
 *
 * Feature flag: NEXT_PUBLIC_NEW_NAV=true to enable.
 * If disabled, falls back to original AppShell.
 */
export function RoleShell({ children, organizationName, organizationId, userEmail }: RoleShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { role, loading: rbacLoading } = useRBAC(organizationId ?? null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Collapse state per group (persisted in sessionStorage)
  const shell = getRoleShell(role)
  const navGroups = getNavGroups(shell)

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = sessionStorage.getItem('wb-nav-collapsed')
      if (stored) return JSON.parse(stored)
    } catch {}
    // Default: collapse groups marked as defaultCollapsed
    const defaults: Record<string, boolean> = {}
    navGroups.forEach((g) => {
      if (g.defaultCollapsed) defaults[g.id] = true
    })
    return defaults
  })

  // Persist collapse state
  useEffect(() => {
    try {
      sessionStorage.setItem('wb-nav-collapsed', JSON.stringify(collapsedGroups))
    } catch {}
  }, [collapsedGroups])

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/signin' })
    } catch (error) {
      logger.error('Sign out failed', { error })
      router.push('/signin')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <CommandPalette />
      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        {/* Logo + Org */}
        <div className="flex items-center gap-2.5 h-14 px-4 border-b border-gray-200 dark:border-gray-800">
          <Logo size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">Word Is Bond</p>
            <OrgSwitcher currentOrgName={organizationName} />
          </div>
        </div>

        {/* Role indicator */}
        <div className="px-4 py-2 flex items-center gap-2">
          <RoleBadge shell={shell} />
          {rbacLoading && (
            <span className="text-[10px] text-gray-400 animate-pulse">Loading...</span>
          )}
        </div>

        {/* Quick search trigger */}
        <div className="px-3 pb-1">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="text-[9px] px-1 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-mono">⌘K</kbd>
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-2 py-1 space-y-1 overflow-y-auto scrollbar-thin">
          {navGroups.map((group) => (
            <NavGroupSection
              key={group.id}
              group={group}
              pathname={pathname || ''}
              collapsed={!!collapsedGroups[group.id]}
              onToggle={() => toggleGroup(group.id)}
            />
          ))}
        </nav>

        {/* Help / Tour */}
        <div className="px-3 pb-1">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('tour:restart'))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 rounded-md transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Show tour</span>
          </button>
        </div>

        {/* Trust Signals */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 tracking-wide">
            <Shield className="w-3 h-3 text-green-500 shrink-0" />
            <span>SOC 2 | HIPAA | 256-bit</span>
          </div>
        </div>

        {/* User Section */}
        {userEmail && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{userEmail}</p>
              </div>
              <ModeToggle />
              <button
                onClick={handleSignOut}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ═══ Mobile Header ═══ */}
      <header className="lg:hidden sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">WIB</span>
            <RoleBadge shell={shell} />
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <XCircle className="w-5 h-5" />
            ) : (
              <ListOrdered className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <nav className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 max-h-[80vh] overflow-y-auto">
            <div className="space-y-1">
              {navGroups.map((group) => (
                <NavGroupSection
                  key={group.id}
                  group={group}
                  pathname={pathname || ''}
                  collapsed={!!collapsedGroups[group.id]}
                  onToggle={() => toggleGroup(group.id)}
                />
              ))}
            </div>
            {userEmail && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{userEmail}</p>
                    <ModeToggle />
                  </div>
                  <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-gray-700">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </nav>
        )}
      </header>

      {/* ═══ Main Content ═══ */}
      <main className="lg:pl-56 min-h-screen">{children}</main>

      {/* ═══ Mobile Bottom Nav (Agent only — simplified) ═══ */}
      {shell === 'agent' && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40">
          <div className="flex items-center justify-around h-14 px-2">
            {[
              { href: '/work', icon: Home, label: 'Today' },
              { href: '/work/call', icon: PhoneCall, label: 'Call' },
              { href: '/accounts', icon: Users, label: 'Accounts' },
              { href: '/schedule', icon: Calendar, label: 'Schedules' },
            ].map((tab) => {
              const active = isNavActive(pathname || '', tab.href)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md transition-colors min-w-[48px]
                    ${active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600'}
                  `}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ Bond AI Chat ═══ */}
      <BondAIChat />
    </div>
  )
}

export default RoleShell
