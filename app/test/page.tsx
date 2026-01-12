"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'

type TestStatus = 'idle' | 'running' | 'passed' | 'failed' | 'warning'

interface TestResult {
  id: string
  name: string
  description: string
  status: TestStatus
  duration?: number
  details?: string
  error?: string
  output?: string[]
}

interface TestCategory {
  id: string
  name: string
  icon: string
  tests: TestResult[]
}

export default function TestPage() {
  const [categories, setCategories] = useState<TestCategory[]>([
    {
      id: 'unit',
      name: 'Unit Tests',
      icon: '🧪',
      tests: [
        { id: 'vitest', name: 'Vitest Unit Tests', description: 'Run all unit tests', status: 'idle' },
      ]
    },
    {
      id: 'integration',
      name: 'Integration Tests',
      icon: '🔗',
      tests: [
        { id: 'integration', name: 'Integration Tests', description: 'Run all integration tests', status: 'idle' },
      ]
    },
    {
      id: 'compilation',
      name: 'Compilation',
      icon: '⚙️',
      tests: [
        { id: 'typescript', name: 'TypeScript Compilation', description: 'Check for TypeScript errors', status: 'idle' },
        { id: 'eslint', name: 'ESLint', description: 'Check code quality', status: 'idle' },
      ]
    },
    {
      id: 'env',
      name: 'Environment',
      icon: '🌍',
      tests: [
        { id: 'env-vars', name: 'Environment Variables', description: 'Validate required env vars', status: 'idle' },
        { id: 'supabase', name: 'Supabase Connection', description: 'Test database connection', status: 'idle' },
        { id: 'signalwire', name: 'SignalWire API', description: 'Test SignalWire connection', status: 'idle' },
      ]
    },
    {
      id: 'api',
      name: 'API Health',
      icon: '🌐',
      tests: [
        { id: 'api-auth', name: 'Authentication Endpoints', description: 'Test auth routes', status: 'idle' },
        { id: 'api-voice', name: 'Voice Endpoints', description: 'Test voice API routes', status: 'idle' },
        { id: 'api-capabilities', name: 'Capabilities Endpoint', description: 'Test call capabilities', status: 'idle' },
      ]
    },
    {
      id: 'features',
      name: 'Feature Tests',
      icon: '✨',
      tests: [
        { id: 'translation', name: 'Live Translation', description: 'Test translation feature', status: 'idle' },
        { id: 'recording', name: 'Call Recording', description: 'Test recording feature', status: 'idle' },
        { id: 'transcription', name: 'Transcription', description: 'Test transcription feature', status: 'idle' },
      ]
    },
    {
      id: 'rbac',
      name: 'RBAC & Permissions',
      icon: '🔐',
      tests: [
        { id: 'rbac-types', name: 'RBAC Type Consistency', description: 'Check Plan type alignment', status: 'idle' },
        { id: 'permissions', name: 'Permission Matrix', description: 'Validate API permissions', status: 'idle' },
      ]
    },
  ])

  const [isRunningAll, setIsRunningAll] = useState(false)
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null)

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'passed': return '🟢'
      case 'failed': return '🔴'
      case 'warning': return '🟡'
      case 'running': return '⏳'
      default: return '⚪'
    }
  }

  const getStatusColor = (status: TestStatus) => {
    switch (status) {
      case 'passed': return 'text-green-400'
      case 'failed': return 'text-red-400'
      case 'warning': return 'text-yellow-400'
      case 'running': return 'text-blue-400'
      default: return 'text-slate-500'
    }
  }

  const updateTestStatus = (categoryId: string, testId: string, updates: Partial<TestResult>) => {
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
  }

  const runTest = async (categoryId: string, testId: string) => {
    const startTime = Date.now()
    updateTestStatus(categoryId, testId, { status: 'running', duration: undefined, error: undefined, details: undefined })

    try {
      const response = await fetch('/api/test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, testId })
      })

      const result = await response.json()
      const duration = Date.now() - startTime

      updateTestStatus(categoryId, testId, {
        status: result.passed ? 'passed' : (result.warning ? 'warning' : 'failed'),
        duration,
        details: result.details,
        error: result.error,
        output: result.output
      })
    } catch (error) {
      const duration = Date.now() - startTime
      updateTestStatus(categoryId, testId, {
        status: 'failed',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const runAllTests = async () => {
    setIsRunningAll(true)
    setLastRunTime(new Date())

    for (const category of categories) {
      for (const test of category.tests) {
        await runTest(category.id, test.id)
      }
    }

    setIsRunningAll(false)
  }

  const getOverallStatus = () => {
    const allTests = categories.flatMap(cat => cat.tests)
    const failed = allTests.filter(t => t.status === 'failed').length
    const warning = allTests.filter(t => t.status === 'warning').length
    const passed = allTests.filter(t => t.status === 'passed').length
    const total = allTests.length

    if (failed > 0) return { status: 'failed', icon: '🔴', text: `${failed} Failed` }
    if (warning > 0) return { status: 'warning', icon: '🟡', text: `${warning} Warnings` }
    if (passed === total) return { status: 'passed', icon: '🟢', text: 'All Passed' }
    return { status: 'idle', icon: '⚪', text: 'Not Run' }
  }

  const overall = getOverallStatus()

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Test Dashboard</h1>
            <p className="text-slate-400 mt-2">
              Comprehensive test suite for CallMonitor platform
            </p>
            {lastRunTime && (
              <p className="text-sm text-slate-500 mt-1">
                Last run: {lastRunTime.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-slate-400">Overall Status</div>
              <div className={`text-2xl font-bold ${getStatusColor(overall.status as TestStatus)}`}>
                {overall.icon} {overall.text}
              </div>
            </div>
            <Button 
              onClick={runAllTests} 
              disabled={isRunningAll}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRunningAll ? '⏳ Running...' : '▶️ Run All Tests'}
            </Button>
          </div>
        </header>

        {/* Summary Stats */}
        <section className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Tests', value: categories.flatMap(c => c.tests).length, color: 'slate' },
            { label: 'Passed', value: categories.flatMap(c => c.tests).filter(t => t.status === 'passed').length, color: 'green' },
            { label: 'Failed', value: categories.flatMap(c => c.tests).filter(t => t.status === 'failed').length, color: 'red' },
            { label: 'Warnings', value: categories.flatMap(c => c.tests).filter(t => t.status === 'warning').length, color: 'yellow' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-900 p-4 rounded-lg border border-slate-800">
              <div className="text-sm text-slate-400">{stat.label}</div>
              <div className={`text-3xl font-bold text-${stat.color}-400`}>{stat.value}</div>
            </div>
          ))}
        </section>

        {/* Test Categories */}
        <section className="space-y-6">
          {categories.map((category) => (
            <div key={category.id} className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
              {/* Category Header */}
              <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700">
                <h2 className="text-xl font-semibold">
                  {category.icon} {category.name}
                </h2>
              </div>

              {/* Tests */}
              <div className="divide-y divide-slate-800">
                {category.tests.map((test) => (
                  <div key={test.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{getStatusIcon(test.status)}</span>
                          <div>
                            <h3 className="font-semibold text-lg">{test.name}</h3>
                            <p className="text-sm text-slate-400">{test.description}</p>
                          </div>
                        </div>

                        {/* Test Details */}
                        {test.status !== 'idle' && (
                          <div className="ml-11 mt-3 space-y-2">
                            {test.duration && (
                              <div className="text-sm text-slate-400">
                                ⏱️ Duration: <span className="font-mono">{test.duration}ms</span>
                              </div>
                            )}
                            {test.details && (
                              <div className="text-sm bg-slate-800 p-3 rounded border border-slate-700">
                                <pre className="whitespace-pre-wrap text-slate-300">{test.details}</pre>
                              </div>
                            )}
                            {test.error && (
                              <div className="text-sm bg-red-900/20 border border-red-800 p-3 rounded">
                                <div className="font-semibold text-red-400 mb-1">❌ Error:</div>
                                <pre className="whitespace-pre-wrap text-red-300">{test.error}</pre>
                              </div>
                            )}
                            {test.output && test.output.length > 0 && (
                              <div className="text-sm bg-slate-800 p-3 rounded border border-slate-700 max-h-60 overflow-y-auto">
                                <div className="font-semibold text-slate-300 mb-2">📄 Output:</div>
                                {test.output.map((line, i) => (
                                  <div key={i} className="font-mono text-xs text-slate-400">{line}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Run Button */}
                      <Button
                        onClick={() => runTest(category.id, test.id)}
                        disabled={test.status === 'running' || isRunningAll}
                        variant="outline"
                        size="sm"
                        className="ml-4"
                      >
                        {test.status === 'running' ? '⏳' : '▶️'} Run
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Footer Info */}
        <footer className="text-sm text-slate-500 text-center border-t border-slate-800 pt-6">
          <p>Test dashboard provides real-time validation of system health and functionality.</p>
          <p className="mt-1">For CI/CD integration, use: <code className="bg-slate-800 px-2 py-1 rounded">npm test</code></p>
        </footer>
      </div>
    </main>
  )
}
