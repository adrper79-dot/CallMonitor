"use client"

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

type TestStatus = 'idle' | 'running' | 'passed' | 'failed' | 'warning' | 'service_down'

interface TestResult {
  id: string
  name: string
  description: string
  status: TestStatus
  duration?: number
  details?: string
  error?: string
  differential?: { expected: string; actual: string; context?: string }
  correlation_id?: string
}

interface TestCategory {
  id: string
  name: string
  icon: string
  tests: TestResult[]
}

/**
 * Test categories matching the Workers TEST_REGISTRY exactly.
 * Every test runs LIVE against real services — zero mocks.
 */
const INITIAL_CATEGORIES: TestCategory[] = [
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    icon: '🏗️',
    tests: [
      { id: 'db-connection', name: 'Database Connection', description: 'PostgreSQL connectivity via Hyperdrive', status: 'idle' },
      { id: 'db-schema', name: 'Database Schema', description: 'All 15 required tables exist', status: 'idle' },
      { id: 'kv-store', name: 'KV Store', description: 'Cloudflare KV read/write', status: 'idle' },
      { id: 'r2-storage', name: 'R2 Storage', description: 'Cloudflare R2 bucket access', status: 'idle' },
      { id: 'hyperdrive', name: 'Hyperdrive', description: 'Connection pooler status', status: 'idle' },
    ]
  },
  {
    id: 'auth',
    name: 'Authentication',
    icon: '🔐',
    tests: [
      { id: 'session-valid', name: 'Session Validation', description: 'Session token verification', status: 'idle' },
      { id: 'session-table', name: 'Sessions Table', description: 'sessions table schema check', status: 'idle' },
      { id: 'user-table', name: 'Users Table', description: 'users table schema check', status: 'idle' },
      { id: 'password-security', name: 'Password Security', description: 'PBKDF2-SHA256 hash format', status: 'idle' },
    ]
  },
  {
    id: 'services',
    name: 'External Services',
    icon: '🌐',
    tests: [
      { id: 'telnyx', name: 'Telnyx API', description: 'Voice/SMS provider connectivity', status: 'idle' },
      { id: 'openai', name: 'OpenAI API', description: 'GPT model access', status: 'idle' },
      { id: 'stripe', name: 'Stripe API', description: 'Payment processor connectivity', status: 'idle' },
      { id: 'assemblyai', name: 'AssemblyAI API', description: 'Transcription service connectivity', status: 'idle' },
    ]
  },
  {
    id: 'bond_ai',
    name: 'Bond AI',
    icon: '🤖',
    tests: [
      { id: 'conversations-table', name: 'Conversations Table', description: 'bond_ai_conversations schema', status: 'idle' },
      { id: 'messages-table', name: 'Messages Table', description: 'bond_ai_messages schema', status: 'idle' },
      { id: 'alerts-table', name: 'Alerts Table', description: 'bond_ai_alerts schema', status: 'idle' },
      { id: 'alert-rules-table', name: 'Alert Rules Table', description: 'bond_ai_alert_rules schema', status: 'idle' },
      { id: 'openai-chat', name: 'OpenAI Chat', description: 'Live GPT-4o-mini completion', status: 'idle' },
    ]
  },
  {
    id: 'teams',
    name: 'Teams & RBAC',
    icon: '👥',
    tests: [
      { id: 'teams-table', name: 'Teams Table', description: 'teams table schema', status: 'idle' },
      { id: 'team-members-table', name: 'Team Members', description: 'team_members table schema', status: 'idle' },
      { id: 'rbac-permissions', name: 'RBAC Permissions', description: 'Role-based access control check', status: 'idle' },
      { id: 'org-members', name: 'Org Members', description: 'organization_members table schema', status: 'idle' },
    ]
  },
  {
    id: 'voice',
    name: 'Voice System',
    icon: '📞',
    tests: [
      { id: 'calls-table', name: 'Calls Table', description: 'calls table schema', status: 'idle' },
      { id: 'voice-configs', name: 'Voice Configs', description: 'voice_configs table schema', status: 'idle' },
      { id: 'recordings-table', name: 'Recordings', description: 'call_recordings table schema', status: 'idle' },
      { id: 'telnyx-connection', name: 'Telnyx Live', description: 'Telnyx API connectivity', status: 'idle' },
    ]
  },
  {
    id: 'analytics',
    name: 'Analytics & Audit',
    icon: '📊',
    tests: [
      { id: 'audit-logs', name: 'Audit Logs', description: 'audit_logs table schema', status: 'idle' },
      { id: 'organizations', name: 'Organizations', description: 'organizations table schema', status: 'idle' },
      { id: 'scorecards', name: 'Scorecards', description: 'scorecards table schema', status: 'idle' },
    ]
  },
  {
    id: 'integrity',
    name: 'Data Integrity',
    icon: '🛡️',
    tests: [
      { id: 'fk-constraints', name: 'Foreign Keys', description: 'FK constraint validation', status: 'idle' },
      { id: 'rls-policies', name: 'RLS Policies', description: 'Row-level security check', status: 'idle' },
      { id: 'orphaned-sessions', name: 'Orphaned Sessions', description: 'Detect orphaned session records', status: 'idle' },
    ]
  },
]

export default function TestPage() {
  const [categories, setCategories] = useState<TestCategory[]>(INITIAL_CATEGORIES)
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null)
  const [apiStatus, setApiStatus] = useState<'unknown' | 'up' | 'down'>('unknown')
  const [suiteResult, setSuiteResult] = useState<any>(null)

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'passed': return '✅'
      case 'failed': return '❌'
      case 'warning': return '⚠️'
      case 'running': return '⏳'
      case 'service_down': return '⛔'
      default: return '⚪'
    }
  }

  const getStatusColor = (status: TestStatus) => {
    switch (status) {
      case 'passed': return 'text-green-400'
      case 'failed': return 'text-red-400'
      case 'warning': return 'text-yellow-400'
      case 'running': return 'text-blue-400'
      case 'service_down': return 'text-orange-400'
      default: return 'text-slate-500'
    }
  }

  const getStatusBorder = (status: TestStatus) => {
    switch (status) {
      case 'passed': return 'border-green-800/50'
      case 'failed': return 'border-red-800/50'
      case 'warning': return 'border-yellow-800/50'
      case 'service_down': return 'border-orange-800/50'
      default: return 'border-slate-800'
    }
  }

  const updateTestStatus = useCallback((categoryId: string, testId: string, updates: Partial<TestResult>) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          tests: cat.tests.map(test =>
            test.id === testId ? { ...test, ...updates } : test
          )
        }
      }
      return cat
    }))
  }, [])

  const runSingleTest = async (categoryId: string, testId: string) => {
    updateTestStatus(categoryId, testId, { status: 'running', duration: undefined, error: undefined, details: undefined, differential: undefined })

    try {
      const startTime = Date.now()
      const response = await fetch(`${API_BASE}/api/test/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, testId })
      })

      const result = await response.json()
      const duration = Date.now() - startTime

      let status: TestStatus = 'failed'
      if (result.service_down) status = 'service_down'
      else if (result.passed && !result.warning) status = 'passed'
      else if (result.warning) status = 'warning'

      updateTestStatus(categoryId, testId, {
        status,
        duration: result.duration_ms || duration,
        details: result.details,
        error: result.error,
        differential: result.differential,
        correlation_id: result.correlation_id,
      })
    } catch (error) {
      updateTestStatus(categoryId, testId, {
        status: 'service_down',
        error: error instanceof Error ? `Network error: ${error.message}` : 'Workers API unreachable',
        details: 'Could not reach the Workers API. The service may be down.',
      })
      setApiStatus('down')
    }
  }

  const runAllTests = async () => {
    setIsRunningAll(true)
    setLastRunTime(new Date())
    setSuiteResult(null)

    // First check API health
    try {
      const healthRes = await fetch(`${API_BASE}/api/test/health`)
      if (healthRes.ok) {
        setApiStatus('up')
      } else {
        setApiStatus('down')
      }
    } catch {
      setApiStatus('down')
      setIsRunningAll(false)
      return
    }

    // Run all via the bulk endpoint
    try {
      const res = await fetch(`${API_BASE}/api/test/run-all`, { method: 'POST' })
      const data = await res.json()
      setSuiteResult(data.summary)

      // Map results back to categories
      for (const result of data.results) {
        let status: TestStatus = 'failed'
        if (result.service_down) status = 'service_down'
        else if (result.passed && !result.warning) status = 'passed'
        else if (result.warning) status = 'warning'

        updateTestStatus(result.category, result.test_id, {
          status,
          duration: result.duration_ms,
          details: result.details,
          error: result.error,
          differential: result.differential,
          correlation_id: result.correlation_id,
        })
      }
    } catch (error) {
      // API down — mark everything as service_down
      for (const cat of categories) {
        for (const test of cat.tests) {
          updateTestStatus(cat.id, test.id, {
            status: 'service_down',
            error: 'Workers API unreachable',
          })
        }
      }
    }

    setIsRunningAll(false)
  }

  const resetAll = () => {
    setCategories(INITIAL_CATEGORIES)
    setSuiteResult(null)
    setApiStatus('unknown')
    setLastRunTime(null)
  }

  const allTests = categories.flatMap(cat => cat.tests)
  const counts = {
    total: allTests.length,
    passed: allTests.filter(t => t.status === 'passed').length,
    failed: allTests.filter(t => t.status === 'failed').length,
    warnings: allTests.filter(t => t.status === 'warning').length,
    down: allTests.filter(t => t.status === 'service_down').length,
    idle: allTests.filter(t => t.status === 'idle').length,
  }

  const overallStatus: TestStatus =
    counts.down > 0 ? 'service_down' :
    counts.failed > 0 ? 'failed' :
    counts.warnings > 0 ? 'warning' :
    counts.passed === counts.total ? 'passed' : 'idle'

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">🧪 Live Test Dashboard</h1>
            <p className="text-slate-400 mt-1">
              Real integration tests — zero mocks — every test hits live services
            </p>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
              <span>API: <span className={apiStatus === 'up' ? 'text-green-400' : apiStatus === 'down' ? 'text-red-400' : 'text-slate-400'}>{apiStatus.toUpperCase()}</span></span>
              {lastRunTime && <span>Last run: {lastRunTime.toLocaleString()}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right mr-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Status</div>
              <div className={`text-xl font-bold ${getStatusColor(overallStatus)}`}>
                {getStatusIcon(overallStatus)} {overallStatus === 'idle' ? 'Ready' : overallStatus.replace('_', ' ').toUpperCase()}
              </div>
            </div>
            <Button
              onClick={runAllTests}
              disabled={isRunningAll}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isRunningAll ? '⏳ Running...' : '▶️ Run All'}
            </Button>
            <Button onClick={resetAll} variant="outline" className="border-slate-700">
              🔄 Reset
            </Button>
          </div>
        </header>

        {/* Summary Stats */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: counts.total, color: 'text-slate-300' },
            { label: 'Passed', value: counts.passed, color: 'text-green-400' },
            { label: 'Failed', value: counts.failed, color: 'text-red-400' },
            { label: 'Warnings', value: counts.warnings, color: 'text-yellow-400' },
            { label: 'Down', value: counts.down, color: 'text-orange-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wide">{stat.label}</div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </section>

        {/* Suite Result Banner */}
        {suiteResult && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Full Suite Complete</h3>
              <span className="text-sm text-slate-400">{suiteResult.suite_duration_ms}ms</span>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
              <div>✅ {suiteResult.passed} passed</div>
              <div>❌ {suiteResult.failed} failed</div>
              <div>⚠️ {suiteResult.warnings} warnings</div>
              <div>⛔ {suiteResult.services_down} down</div>
            </div>
          </div>
        )}

        {/* Test Categories */}
        <section className="space-y-4">
          {categories.map((category) => {
            const catPassed = category.tests.filter(t => t.status === 'passed').length
            const catTotal = category.tests.length
            return (
              <div key={category.id} className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                {/* Category Header */}
                <div className="bg-slate-800/50 px-5 py-3 border-b border-slate-700 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {category.icon} {category.name}
                  </h2>
                  <span className="text-sm text-slate-400">
                    {catPassed}/{catTotal} passed
                  </span>
                </div>

                {/* Tests */}
                <div className="divide-y divide-slate-800/50">
                  {category.tests.map((test) => (
                    <div key={test.id} className={`p-4 border-l-2 ${getStatusBorder(test.status)} transition-colors`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getStatusIcon(test.status)}</span>
                            <div>
                              <h3 className="font-medium">{test.name}</h3>
                              <p className="text-xs text-slate-500">{test.description}</p>
                            </div>
                          </div>

                          {/* Result Details */}
                          {test.status !== 'idle' && test.status !== 'running' && (
                            <div className="ml-8 mt-2 space-y-1.5 text-sm">
                              {test.duration !== undefined && (
                                <span className="text-slate-500">⏱️ {test.duration}ms</span>
                              )}
                              {test.details && (
                                <div className="bg-slate-800/50 p-2 rounded text-slate-300 text-xs font-mono">
                                  {test.details}
                                </div>
                              )}
                              {test.error && (
                                <div className="bg-red-900/20 border border-red-900/30 p-2 rounded text-xs">
                                  <span className="text-red-400 font-semibold">Error: </span>
                                  <span className="text-red-300">{test.error}</span>
                                </div>
                              )}
                              {test.differential && (
                                <div className="bg-amber-900/20 border border-amber-900/30 p-2 rounded text-xs font-mono">
                                  <div className="text-amber-400">Differential:</div>
                                  <div className="text-green-400">  Expected: {test.differential.expected}</div>
                                  <div className="text-red-400">  Actual:   {test.differential.actual}</div>
                                  {test.differential.context && (
                                    <div className="text-slate-400">  Context:  {test.differential.context}</div>
                                  )}
                                </div>
                              )}
                              {test.correlation_id && (
                                <div className="text-slate-600 text-xs">ID: {test.correlation_id}</div>
                              )}
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={() => runSingleTest(category.id, test.id)}
                          disabled={test.status === 'running' || isRunningAll}
                          variant="outline"
                          size="sm"
                          className="ml-3 shrink-0 border-slate-700 text-xs"
                        >
                          {test.status === 'running' ? '⏳' : '▶️'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </section>

        {/* Footer */}
        <footer className="text-xs text-slate-600 text-center border-t border-slate-800 pt-4 space-y-1">
          <p>Live Test Dashboard — every test hits production services, zero mocks</p>
          <p>CLI: <code className="bg-slate-800 px-1.5 py-0.5 rounded">npm run test:live</code> | API: <code className="bg-slate-800 px-1.5 py-0.5 rounded">{API_BASE}/api/test/catalog</code></p>
        </footer>
      </div>
    </main>
  )
}
