'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface Task {
  id: string
  account_id: string
  type: string
  title: string
  notes: string | null
  due_date: string | null
  status: string
  account_name: string
  primary_phone: string
  balance_due: number
  likelihood_score: number | null
}

interface PastDuePromise {
  id: string
  name: string
  primary_phone: string
  balance_due: number
  promise_date: string
  promise_amount: number | null
  likelihood_score: number | null
}

interface PriorityAccount {
  id: string
  name: string
  primary_phone: string
  balance_due: number
  status: string
  last_contacted_at: string | null
  likelihood_score: number | null
}

interface CampaignStat {
  id: string
  name: string
  status: string
  total_targets: number
  completed_targets: number
  pending_targets: number
}

interface TodayStats {
  calls_today: number
  completed_today: number
  talk_time_today: number
}

interface PlannerData {
  due_tasks: Task[]
  past_due_promises: PastDuePromise[]
  priority_accounts: PriorityAccount[]
  campaign_stats: CampaignStat[]
  today_stats: TodayStats
}

interface DailyPlannerProps {
  onNavigateToAccount?: (accountId: string) => void
  onInitiateCall?: (phone: string) => void
}

/**
 * DailyPlanner — Cross-campaign unified daily view for collections agents.
 *
 * Aggregates:
 * - Due tasks (callbacks, follow-ups, promise follow-ups)
 * - Past-due promises
 * - High-priority accounts (by likelihood score)
 * - Active campaign progress
 * - Today's call stats
 */
export default function DailyPlanner({
  onNavigateToAccount,
  onInitiateCall,
}: DailyPlannerProps) {
  const [data, setData] = useState<PlannerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tasks' | 'promises' | 'priority' | 'campaigns'>(
    'tasks'
  )

  const fetchPlanner = useCallback(async () => {
    try {
      const res = await apiGet('/api/productivity/daily-planner')
      setData(res.planner)
    } catch (err) {
      logger.error('DailyPlanner: fetch failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlanner()
  }, [fetchPlanner])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
  }

  const getLikelihoodColor = (score: number | null) => {
    if (!score) return 'text-gray-500'
    if (score >= 70) return 'text-green-400'
    if (score >= 40) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'promise':
        return '💰'
      case 'payment':
        return '💳'
      case 'followup':
        return '📞'
      case 'escalation':
        return '⚠️'
      default:
        return '📋'
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-20 animate-pulse rounded-lg bg-gray-700/50" />
        <div className="h-8 animate-pulse rounded bg-gray-700/50" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-700/50" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        Failed to load daily planner
      </div>
    )
  }

  const { due_tasks, past_due_promises, priority_accounts, campaign_stats, today_stats } = data

  const tabs = [
    { key: 'tasks' as const, label: 'Tasks', count: due_tasks.length },
    { key: 'promises' as const, label: 'Past-Due', count: past_due_promises.length },
    { key: 'priority' as const, label: 'Priority', count: priority_accounts.length },
    { key: 'campaigns' as const, label: 'Campaigns', count: campaign_stats.length },
  ]

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50">
      {/* Today's Stats Header */}
      <div className="border-b border-gray-700 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-200">Daily Planner</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md bg-gray-700/50 p-2.5 text-center">
            <p className="text-lg font-bold text-white">{today_stats.calls_today}</p>
            <p className="text-xs text-gray-400">Calls Today</p>
          </div>
          <div className="rounded-md bg-gray-700/50 p-2.5 text-center">
            <p className="text-lg font-bold text-green-400">{today_stats.completed_today}</p>
            <p className="text-xs text-gray-400">Completed</p>
          </div>
          <div className="rounded-md bg-gray-700/50 p-2.5 text-center">
            <p className="text-lg font-bold text-blue-400">
              {formatTime(today_stats.talk_time_today)}
            </p>
            <p className="text-xs text-gray-400">Talk Time</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  activeTab === tab.key ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-600 text-gray-300'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto p-3">
        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-2">
            {due_tasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">No tasks due today</p>
            ) : (
              due_tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 rounded-md border border-gray-600/50 bg-gray-700/30 p-3"
                >
                  <span className="mt-0.5 text-lg">{getTaskTypeIcon(task.type)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">
                        {task.title || task.type}
                      </p>
                      <span
                        className={`text-xs ${getLikelihoodColor(task.likelihood_score)}`}
                      >
                        {task.likelihood_score ? `${Math.round(task.likelihood_score)}%` : ''}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-400">
                      {task.account_name} · {formatCurrency(task.balance_due)}
                    </p>
                    {task.notes && (
                      <p className="mt-1 truncate text-xs text-gray-500">{task.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {onInitiateCall && (
                      <button
                        onClick={() => onInitiateCall(task.primary_phone)}
                        className="rounded-md bg-green-500/10 p-1.5 text-green-400 hover:bg-green-500/20"
                        title="Call"
                      >
                        📞
                      </button>
                    )}
                    {onNavigateToAccount && (
                      <button
                        onClick={() => onNavigateToAccount(task.account_id)}
                        className="rounded-md bg-blue-500/10 p-1.5 text-blue-400 hover:bg-blue-500/20"
                        title="View Account"
                      >
                        👤
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Past-Due Promises Tab */}
        {activeTab === 'promises' && (
          <div className="space-y-2">
            {past_due_promises.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">No past-due promises</p>
            ) : (
              past_due_promises.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-md border border-red-500/20 bg-red-500/5 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{account.name}</p>
                    <p className="text-xs text-gray-400">
                      Promised {formatCurrency(account.promise_amount || 0)} on{' '}
                      {new Date(account.promise_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Balance: {formatCurrency(account.balance_due)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium ${getLikelihoodColor(account.likelihood_score)}`}
                  >
                    {account.likelihood_score ? `${Math.round(account.likelihood_score)}%` : '—'}
                  </span>
                  {onInitiateCall && (
                    <button
                      onClick={() => onInitiateCall(account.primary_phone)}
                      className="rounded-md bg-green-500/10 p-1.5 text-green-400 hover:bg-green-500/20"
                      title="Call"
                    >
                      📞
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Priority Accounts Tab */}
        {activeTab === 'priority' && (
          <div className="space-y-2">
            {priority_accounts.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">No priority accounts</p>
            ) : (
              priority_accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-md border border-gray-600/50 bg-gray-700/30 p-3 cursor-pointer hover:bg-gray-700/50"
                  onClick={() => onNavigateToAccount?.(account.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{account.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatCurrency(account.balance_due)} · {account.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${getLikelihoodColor(account.likelihood_score)}`}
                    >
                      {account.likelihood_score
                        ? `${Math.round(account.likelihood_score)}%`
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-500">likelihood</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="space-y-2">
            {campaign_stats.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">No active campaigns</p>
            ) : (
              campaign_stats.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-md border border-gray-600/50 bg-gray-700/30 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-white">{campaign.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        campaign.status === 'active'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-yellow-500/10 text-yellow-400'
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-600">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{
                        width: `${
                          campaign.total_targets > 0
                            ? (campaign.completed_targets / campaign.total_targets) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {campaign.completed_targets}/{campaign.total_targets} completed · {campaign.pending_targets} pending
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
