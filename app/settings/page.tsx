'use client'

import React, { useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import Link from 'next/link'
import { apiGet } from '@/lib/apiClient'
import { useRBAC } from '@/hooks/useRBAC'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { logger } from '@/lib/logger'
import { ProductTour, SETTINGS_TOUR } from '@/components/tour'
import {
  Phone,
  Brain,
  ClipboardCheck,
  Users,
  CreditCard,
  Webhook,
  Shield,
  ChevronRight,
  Zap,
} from 'lucide-react'

/**
 * Settings Hub — decomposed from the former 676-line mega-page.
 * Org-level concerns live as /settings/* sub-routes.
 * Admin concerns (billing, voice, AI, retention, webhooks) link to /admin/*.
 */
export default function SettingsPage() {
  const { data: session } = useSession()
  const userId = (session?.user as any)?.id

  const [organizationId, setOrganizationId] = React.useState<string>('')
  const [organizationName, setOrganizationName] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    async function fetchOrganization() {
      try {
        const data = await apiGet<{
          success: boolean
          organization: { id: string; name: string; plan: string; plan_status: string }
          role: string
        }>(`/api/users/${userId}/organization`)
        setOrganizationId(data.organization?.id || '')
        setOrganizationName(data.organization?.name || null)
      } catch (e) {
        logger.error('Failed to fetch organization', e, { userId })
      } finally {
        setLoading(false)
      }
    }
    fetchOrganization()
  }, [userId])

  const { role, plan } = useRBAC(organizationId)
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    )
  }

  if (!session || !userId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Sign in required</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Please sign in to access settings.</p>
          <a href="/signin?callbackUrl=/settings" className="text-primary-600 hover:underline font-medium">Sign In</a>
        </div>
      </div>
    )
  }

  type SettingsCard = {
    title: string
    description: string
    href: string
    icon: React.ReactNode
    ownerOnly?: boolean
    external?: boolean
    dataTour?: string
  }

  const cards: SettingsCard[] = [
    {
      title: 'Call Configuration',
      description: 'Targets, Caller ID, dial defaults',
      href: '/settings/call-config',
      icon: <Phone className="h-5 w-5" />,
      dataTour: 'tab-call-config',
    },
    {
      title: 'Dialer & Auto-Advance',
      description: 'Power dialer settings, auto-advance preferences',
      href: '/settings/dialer',
      icon: <Zap className="h-5 w-5" />,
    },
    {
      title: 'AI & Intelligence',
      description: 'Transcription, translation, surveys, AI agent config',
      href: '/settings/ai',
      icon: <Brain className="h-5 w-5" />,
    },
    {
      title: 'Evidence Quality',
      description: 'QA scripts and scorecard templates',
      href: '/settings/quality',
      icon: <ClipboardCheck className="h-5 w-5" />,
      ownerOnly: true,
    },
    {
      title: 'Team & Access',
      description: 'Members, roles, permissions',
      href: '/settings/team',
      icon: <Users className="h-5 w-5" />,
      ownerOnly: true,
      dataTour: 'tab-team',
    },
    {
      title: 'Compliance',
      description: 'Retention policies, legal holds',
      href: '/admin/retention',
      icon: <Shield className="h-5 w-5" />,
      ownerOnly: true,
      external: true,
    },
    {
      title: 'Webhooks & API',
      description: 'Event subscriptions, integrations',
      href: '/admin/api',
      icon: <Webhook className="h-5 w-5" />,
      ownerOnly: true,
      external: true,
    },
    {
      title: 'Billing & Plan',
      description: 'Subscription, payment methods, invoices',
      href: '/admin/billing',
      icon: <CreditCard className="h-5 w-5" />,
      ownerOnly: true,
      external: true,
      dataTour: 'tab-billing',
    },
  ]

  const visibleCards = isOwnerOrAdmin ? cards : cards.filter((c) => !c.ownerOnly)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {organizationName || 'Your Organization'}
              {plan && (
                <Badge variant="default" className="ml-2">
                  {plan.charAt(0).toUpperCase() + plan.slice(1)}
                </Badge>
              )}
            </p>
          </div>
          {!isOwnerOrAdmin && (
            <Badge variant="secondary" className="text-xs">
              {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member'} — limited access
            </Badge>
          )}
        </div>
      </div>

      {/* Settings Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-tour="settings-tabs">
        {visibleCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="h-full hover:border-primary-400 hover:shadow-md transition-all cursor-pointer dark:bg-gray-800 dark:border-gray-700" data-tour={card.dataTour}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                      {card.icon}
                    </div>
                    <CardTitle className="text-base">{card.title}</CardTitle>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{card.description}</CardDescription>
                {card.external && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 mt-2 block">
                    Opens in Admin
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Role Info */}
      {role && (
        <div className="text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4 mt-8">
          Your role: <span className="text-gray-900 dark:text-white font-medium">{role}</span>
          {isOwnerOrAdmin ? (
            <span className="text-success ml-2">Full settings access</span>
          ) : (
            <span className="text-warning ml-2">Limited access</span>
          )}
        </div>
      )}

      {/* Tutorial Tour */}
      <ProductTour tourId="settings" steps={SETTINGS_TOUR} />
    </div>
  )
}
