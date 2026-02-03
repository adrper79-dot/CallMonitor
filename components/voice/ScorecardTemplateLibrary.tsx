"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type ScorecardTemplate = {
  id: string
  name: string
  description: string
  criteria: Array<{
    id: string
    name: string
    weight: number
    type: 'numeric' | 'boolean' | 'text'
    min?: number
    max?: number
  }>
}

const TEMPLATE_LIBRARY: ScorecardTemplate[] = [
  {
    id: 'qa-basic',
    name: 'QA Fundamentals',
    description: 'Baseline QA checks for call quality and compliance.',
    criteria: [
      { id: 'greeting', name: 'Proper greeting', weight: 20, type: 'boolean' },
      { id: 'resolution', name: 'Issue resolution', weight: 30, type: 'text', min: 70 },
      { id: 'compliance', name: 'Compliance disclosure', weight: 30, type: 'boolean' },
      { id: 'duration', name: 'Call duration', weight: 20, type: 'numeric', min: 60, max: 600 },
    ],
  },
  {
    id: 'sales-qa',
    name: 'Sales QA',
    description: 'Sales-oriented criteria focused on conversion signals.',
    criteria: [
      { id: 'needs', name: 'Needs discovery', weight: 25, type: 'text', min: 70 },
      { id: 'pricing', name: 'Pricing clarity', weight: 25, type: 'text', min: 70 },
      { id: 'next_step', name: 'Clear next step', weight: 25, type: 'boolean' },
      { id: 'sentiment', name: 'Positive sentiment', weight: 25, type: 'text', min: 60 },
    ],
  },
  {
    id: 'compliance',
    name: 'Compliance Essentials',
    description: 'Disclosure and policy adherence checks.',
    criteria: [
      { id: 'consent', name: 'Consent captured', weight: 40, type: 'boolean' },
      { id: 'disclosure', name: 'Required disclosure', weight: 40, type: 'boolean' },
      { id: 'duration', name: 'Call duration', weight: 20, type: 'numeric', min: 30, max: 900 },
    ],
  }
]

export default function ScorecardTemplateLibrary({
  organizationId,
  disabled
}: {
  organizationId: string
  disabled?: boolean
}) {
  const [creating, setCreating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function createFromTemplate(template: ScorecardTemplate) {
    if (!organizationId || disabled) return
    setCreating(template.id)
    setError(null)
    try {
      const res = await fetch('/api/scorecards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          structure: { criteria: template.criteria },
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error?.message || 'Failed to create scorecard')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create scorecard')
    } finally {
      setCreating(null)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Scorecard Template Library</h3>
        <p className="text-sm text-gray-500">
          Start with vetted templates and customize as needed.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-error-light border border-red-200 rounded-md text-error text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {TEMPLATE_LIBRARY.map((template) => (
          <div key={template.id} className="bg-white border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900">{template.name}</p>
              <Badge variant="info">Template</Badge>
            </div>
            <p className="text-xs text-gray-600 mb-3">{template.description}</p>
            <ul className="text-xs text-gray-600 space-y-1 mb-4">
              {template.criteria.map((criterion) => (
                <li key={criterion.id}>• {criterion.name}</li>
              ))}
            </ul>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => createFromTemplate(template)}
              disabled={!!disabled || creating === template.id}
            >
              {creating === template.id ? 'Creating...' : 'Use Template'}
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
