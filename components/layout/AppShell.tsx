'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { signOut } from '@/components/AuthProvider'
import { BottomNav } from './BottomNav'
import { ModeToggle } from '@/components/mode-toggle'
import { BondAIChat, BondAIAlertsPanel } from '@/components/bond-ai'
import OrgSwitcher from '@/components/teams/OrgSwitcher'
import { logger } from '@/lib/logger'
import { apiGet } from '@/lib/apiClient'
import { useRBAC } from '@/hooks/useRBAC'
import { useUnreadCount } from '@/hooks/useUnreadCount'

interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  badge?: number | string
  isActive?: boolean
}

interface NavSection {
  title: string
  items: NavItemProps[]
}

function NavItem({ href, icon, label, badge, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 px-3 py-1 rounded-md text-sm font-medium transition-colors
        ${isActive ? 'bg-navy-50 text-navy-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}
      `}
    >
      <span className={`w-5 h-5 ${isActive ? 'text-navy-600' : 'text-gray-400'}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span
          className={`
          text-xs px-2 py-0.5 rounded-full font-medium
          ${isActive ? 'bg-navy-100 text-navy-700' : 'bg-gray-100 text-gray-600'}
        `}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

interface AppShellProps {
  children: React.ReactNode
  organizationName?: string
  organizationId?: string | null
  userEmail?: string
}

/**
 * AppShell - Unified Navigation Shell
 *
 * Provides consistent navigation across all authenticated pages.
 * Professional Design System v3.0
 */
export function AppShell({ children, organizationName, organizationId, userEmail }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [organizationPlan, setOrganizationPlan] = useState<string | null>(null)
  const { role } = useRBAC(organizationId ?? null)
  const { count: unreadCount } = useUnreadCount(organizationId ?? null)

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/signin' })
    } catch (error) {
      logger.error('Sign out failed', { error })
      router.push('/signin')
    }
  }

  // Fetch organization plan for feature gating
  useEffect(() => {
    if (!organizationId) return

    apiGet(`/api/organizations/${organizationId}`)
      .then((data) => {
        if (data.organization?.plan) {
          setOrganizationPlan(data.organization.plan)
        }
      })
      .catch((err) => logger.error('Failed to fetch organization plan', { error: err }))
  }, [organizationId])

  // ---------------------------------------------------------------------------
  // Reusable SVG icon helpers — eliminates 700+ lines of inline SVG repetition
  // ---------------------------------------------------------------------------
  const ni = (d: string) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
  const nim = (...ds: string[]) => (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {ds.map((d, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />)}
    </svg>
  )

  // Icon library — all heroicons outline paths used in navigation
  const ic = {
    home: ni('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'),
    inbox: ni('M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'),
    doc: ni('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
    phone: ni('M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z'),
    phoneActive: ni('M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z'),
    card: ni('M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z'),
    money: ni('M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z'),
    upload: ni('M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5'),
    warn: ni('M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z'),
    cal: ni('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'),
    clock: ni('M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'),
    calDays: ni('M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5'),
    template: ni('M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'),
    book: ni('M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25'),
    grid: ni('M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'),
    calc: ni('M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V15.75zm0 2.25h.008v.008H8.25v-.008zm2.498-6.75h-.007v.008h-.007v-.008zm0 2.25h.007v.008H10.5V13.5zm0 2.25h.007v.008H10.5v-.008zm0 2.25h.007v.008H10.5v-.008zm0 2.25h.007v.008H10.5V15.75zm7.5-6.75h-.007v.008H18v-.008zm0 2.25h-.007v.008H18V13.5z'),
    chart: ni('M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'),
    users: ni('M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z'),
    check: ni('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'),
    mega: ni('M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46'),
    swap: ni('M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5'),
    gear: nim('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'),
    user: ni('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'),
    dnc: ni('M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5zM12 12a3 3 0 100-6 3 3 0 000 6z'),
    list: ni('M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25'),
    sparkle: ni('M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 001.423 1.423L19.5 18.75l-1.183.394a2.25 2.25 0 00-1.423 1.423z'),
    archive: ni('M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'),
    key: ni('M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z'),
    headphones: ni('M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z'),
    bell: ni('M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'),
    clipboard: ni('M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75'),
    flag: ni('M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5'),
    plus: ni('M12 4.5v15m7.5-7.5h-15'),
    shield: ni('M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z'),
    sentiment: ni('M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z'),
    bookmark: ni('M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z'),
  }

  // ---------------------------------------------------------------------------
  // Navigation sections by role — every authenticated page is reachable
  // ---------------------------------------------------------------------------
  const getNavSections = (): NavSection[] => {
    const isAgent = role === 'agent' || role === 'analyst'
    const isManager = role === 'manager' || role === 'operator' || role === 'compliance'
    const isAdmin = role === 'admin' || role === 'owner'

    // ── Agent / Analyst ─────────────────────────────────────────────────────
    if (isAgent) {
      return [
        { title: '', items: [
          { href: '/dashboard', label: 'Dashboard', icon: ic.home },
          { href: '/work', label: "Today's Queue", icon: ic.doc },
        ]},
        { title: 'COLLECT', items: [
          { href: '/inbox', label: 'Inbox', icon: ic.inbox, badge: unreadCount?.total || undefined },
          { href: '/work/queue', label: 'Work Queue', icon: ic.doc },
          { href: '/work/dialer', label: 'Dialer', icon: ic.phone },
          { href: '/work/call', label: 'Active Call', icon: ic.phoneActive },
          { href: '/voice-operations', label: 'Voice Ops', icon: ic.headphones },
          { href: '/work/payments', label: 'Payment Links', icon: ic.card },
        ]},
        { title: 'ACCOUNTS', items: [
          { href: '/accounts', label: 'All Accounts', icon: ic.money },
          { href: '/accounts/import', label: 'Import', icon: ic.upload },
          { href: '/accounts/disputes', label: 'Disputes', icon: ic.warn },
        ]},
        { title: 'SCHEDULE', items: [
          { href: '/schedule/callbacks', label: 'Callbacks', icon: ic.cal },
          { href: '/schedule/follow-ups', label: 'Follow-ups', icon: ic.clock },
          { href: '/schedule', label: 'Appointments', icon: ic.calDays },
          { href: '/bookings', label: 'Bookings', icon: ic.bookmark },
        ]},
        { title: 'TOOLS', items: [
          { href: '/tools/templates', label: 'Note Templates', icon: ic.template },
          { href: '/tools/objections', label: 'Objection Library', icon: ic.book },
          { href: '/tools/scripts', label: 'Scripts', icon: ic.grid },
          { href: '/tools/calculator', label: 'Payment Calculator', icon: ic.calc },
        ]},
        { title: 'AI', items: [
          { href: '/bond-ai/alerts', label: 'Bond AI Alerts', icon: ic.bell },
        ]},
        { title: '', items: [
          { href: '/analytics/me', label: 'My Performance', icon: ic.chart },
        ]},
      ]
    }

    // ── Manager / Operator / Compliance ─────────────────────────────────────
    if (isManager) {
      return [
        { title: '', items: [
          { href: '/dashboard', label: 'Dashboard', icon: ic.home },
          { href: '/command', label: 'Command Center', icon: ic.chart },
        ]},
        { title: 'TEAM', items: [
          { href: '/command/live', label: 'Live Board', icon: ic.doc },
          { href: '/teams', label: 'Members', icon: ic.users },
          { href: '/command/scorecards', label: 'Scorecards', icon: ic.check },
          { href: '/command/coaching', label: 'Coaching', icon: ic.book },
          { href: '/manager', label: 'Team Overview', icon: ic.user },
          { href: '/review', label: 'QA Review', icon: ic.clipboard },
        ]},
        { title: 'COLLECT', items: [
          { href: '/inbox', label: 'Inbox', icon: ic.inbox, badge: unreadCount?.total || undefined },
          { href: '/voice-operations', label: 'Voice Ops', icon: ic.headphones },
        ]},
        { title: 'ACCOUNTS', items: [
          { href: '/accounts', label: 'All Accounts', icon: ic.money },
          { href: '/accounts/import', label: 'Import', icon: ic.upload },
          { href: '/accounts/disputes', label: 'Disputes', icon: ic.warn },
        ]},
        { title: 'ANALYTICS', items: [
          { href: '/analytics/collections', label: 'Collections KPIs', icon: ic.chart },
          { href: '/analytics/agents', label: 'Agent Performance', icon: ic.user },
          { href: '/analytics/sentiment', label: 'Sentiment', icon: ic.sentiment },
          { href: '/analytics', label: 'Campaign Results', icon: ic.mega },
          { href: '/reports', label: 'Reports', icon: ic.template },
        ]},
        { title: 'COMPLIANCE', items: [
          { href: '/compliance', label: 'Overview', icon: ic.shield },
          { href: '/compliance/violations', label: 'Violations', icon: ic.warn },
          { href: '/compliance/audit', label: 'Audit Trail', icon: ic.doc },
          { href: '/compliance/dnc', label: 'DNC Management', icon: ic.dnc },
          { href: '/compliance/disputes', label: 'Dispute Queue', icon: ic.clock },
        ]},
        { title: 'PAYMENTS', items: [
          { href: '/payments/plans', label: 'Payment Plans', icon: ic.card },
          { href: '/payments/reconciliation', label: 'Reconciliation', icon: ic.swap },
          { href: '/payments/failed', label: 'Failed Payments', icon: ic.warn },
          { href: '/payments', label: 'Receipts', icon: ic.doc },
        ]},
        { title: 'CAMPAIGNS', items: [
          { href: '/campaigns', label: 'Active Campaigns', icon: ic.mega },
          { href: '/campaigns/new', label: 'Create Campaign', icon: ic.plus },
          { href: '/campaigns/sequences', label: 'Contact Sequences', icon: ic.list },
          { href: '/campaigns/surveys', label: 'Surveys', icon: ic.doc },
        ]},
        { title: 'SCHEDULE', items: [
          { href: '/schedule', label: 'Schedule', icon: ic.calDays },
          { href: '/bookings', label: 'Bookings', icon: ic.bookmark },
        ]},
        { title: 'AI', items: [
          { href: '/bond-ai/alerts', label: 'Bond AI Alerts', icon: ic.bell },
        ]},
        { title: '', items: [
          { href: '/settings', label: 'Settings', icon: ic.gear },
        ]},
      ]
    }

    // ── Admin / Owner ───────────────────────────────────────────────────────
    if (isAdmin) {
      return [
        { title: '', items: [
          { href: '/dashboard', label: 'Dashboard', icon: ic.home },
        ]},
        { title: 'TEAM', items: [
          { href: '/command', label: 'Command Center', icon: ic.chart },
          { href: '/command/live', label: 'Live Board', icon: ic.doc },
          { href: '/teams', label: 'Members', icon: ic.users },
          { href: '/command/scorecards', label: 'Scorecards', icon: ic.check },
          { href: '/command/coaching', label: 'Coaching', icon: ic.book },
          { href: '/manager', label: 'Team Overview', icon: ic.user },
          { href: '/review', label: 'QA Review', icon: ic.clipboard },
        ]},
        { title: 'COLLECT', items: [
          { href: '/inbox', label: 'Inbox', icon: ic.inbox, badge: unreadCount?.total || undefined },
          { href: '/voice-operations', label: 'Voice Ops', icon: ic.headphones },
        ]},
        { title: 'ACCOUNTS', items: [
          { href: '/accounts', label: 'All Accounts', icon: ic.money },
          { href: '/accounts/import', label: 'Import', icon: ic.upload },
          { href: '/accounts/disputes', label: 'Disputes', icon: ic.warn },
        ]},
        { title: 'ANALYTICS', items: [
          { href: '/analytics', label: 'Overview', icon: ic.chart },
          { href: '/analytics/collections', label: 'Collections KPIs', icon: ic.chart },
          { href: '/analytics/agents', label: 'Agent Performance', icon: ic.user },
          { href: '/analytics/sentiment', label: 'Sentiment', icon: ic.sentiment },
          { href: '/reports', label: 'Reports', icon: ic.template },
        ]},
        { title: 'COMPLIANCE', items: [
          { href: '/compliance', label: 'Overview', icon: ic.shield },
          { href: '/compliance/violations', label: 'Violations', icon: ic.warn },
          { href: '/compliance/audit', label: 'Audit Trail', icon: ic.doc },
          { href: '/compliance/dnc', label: 'DNC Management', icon: ic.dnc },
          { href: '/compliance/disputes', label: 'Dispute Queue', icon: ic.clock },
        ]},
        { title: 'PAYMENTS', items: [
          { href: '/payments/plans', label: 'Payment Plans', icon: ic.card },
          { href: '/payments/reconciliation', label: 'Reconciliation', icon: ic.swap },
          { href: '/payments/failed', label: 'Failed Payments', icon: ic.warn },
          { href: '/payments', label: 'Receipts', icon: ic.doc },
        ]},
        { title: 'CAMPAIGNS', items: [
          { href: '/campaigns', label: 'Active Campaigns', icon: ic.mega },
          { href: '/campaigns/new', label: 'Create Campaign', icon: ic.plus },
          { href: '/campaigns/sequences', label: 'Contact Sequences', icon: ic.list },
          { href: '/campaigns/surveys', label: 'Surveys', icon: ic.doc },
        ]},
        { title: 'SCHEDULE', items: [
          { href: '/schedule', label: 'Schedule', icon: ic.calDays },
          { href: '/bookings', label: 'Bookings', icon: ic.bookmark },
        ]},
        { title: 'AI', items: [
          { href: '/bond-ai/alerts', label: 'Bond AI Alerts', icon: ic.bell },
        ]},
        { title: 'ADMIN', items: [
          { href: '/admin/metrics', label: 'Platform Metrics', icon: ic.chart },
          { href: '/admin/billing', label: 'Billing & Plans', icon: ic.card },
          { href: '/admin/voice', label: 'Voice Config', icon: ic.phone },
          { href: '/admin/ai', label: 'AI Config', icon: ic.sparkle },
          { href: '/admin/retention', label: 'Data Retention', icon: ic.archive },
          { href: '/admin/api', label: 'API Keys', icon: ic.key },
          { href: '/admin/feature-flags', label: 'Feature Flags', icon: ic.flag },
        ]},
        { title: '', items: [
          { href: '/settings', label: 'Settings', icon: ic.gear },
        ]},
      ]
    }

    // ── Viewer / Unknown (read-only) ────────────────────────────────────────
    return [
      { title: '', items: [
        { href: '/dashboard', label: 'Dashboard', icon: ic.home },
      ]},
      { title: 'ANALYTICS', items: [
        { href: '/analytics', label: 'Overview', icon: ic.chart },
        { href: '/reports', label: 'Reports', icon: ic.template },
      ]},
    ]
  }

  const navSections = getNavSections()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-6 border-b border-gray-200">
          <Logo size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Wordis Bond</p>
            <OrgSwitcher currentOrgName={organizationName} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {navSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.title && (
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {section.title}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Help / Tour Trigger */}
        <div className="px-3 pb-2">
          <button
            onClick={() => {
              // Dispatch custom event to restart tour
              window.dispatchEvent(new CustomEvent('tour:restart'))
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Show tutorial"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
              />
            </svg>
            <span>Show tour</span>
          </button>
        </div>

        {/* Trust Signals */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 text-[10px] text-gray-400 tracking-wide">
            <svg className="w-3 h-3 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            <span>SOC 2 | HIPAA | 256-bit encryption</span>
          </div>
        </div>

        {/* User Section */}
        {userEmail && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-700">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{userEmail}</p>
                {!organizationId && (
                  <Link
                    href="/settings/org-create"
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Create Organization
                  </Link>
                )}
              </div>

              <ModeToggle />

              <button
                onClick={handleSignOut}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                title="Sign out"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-sm font-semibold text-gray-900">Wordis Bond</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="px-4 py-3 border-t border-gray-100 bg-white">
            <div className="space-y-4">
              {navSections.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                  {section.title && (
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {section.title}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <NavItem
                        key={item.href}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {userEmail && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-600 truncate">{userEmail}</p>
                    <ModeToggle />
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="lg:pl-64 pb-20 lg:pb-0 min-h-screen">{children}</main>

      {/* Mobile Bottom Navigation — hidden on lg+ via lg:hidden and CSS fallback */}
      <div className="lg:hidden">
        <BottomNav />
      </div>

      {/* Bond AI Chat — Global Floating Widget */}
      <BondAIChat />
    </div>
  )
}

export default AppShell
