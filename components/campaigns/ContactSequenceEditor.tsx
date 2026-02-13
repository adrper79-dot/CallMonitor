'use client'

/**
 * ContactSequenceEditor — Multi-step outreach flow builder
 *
 * Lets managers build Email → SMS → Call → Wait sequences
 * with configurable delays, conditions, and branching.
 * Each step is an action card in a vertical timeline.
 */

import React, { useState, useCallback } from 'react'
import { apiPost, apiPut, apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Phone, Mail, MessageSquare, Clock, ArrowDown,
  Plus, Trash2, GripVertical, Save, ChevronDown,
  ChevronUp, Play, Pause, AlertCircle,
} from 'lucide-react'

/* ── Types ── */

type StepType = 'call' | 'email' | 'sms' | 'wait'

interface SequenceStep {
  id: string
  type: StepType
  label: string
  delay_hours: number
  config: StepConfig
  condition?: string // 'no_contact' | 'no_payment' | 'always'
}

interface StepConfig {
  template_id?: string
  template_name?: string
  message?: string
  caller_id?: string
  subject?: string
  max_attempts?: number
}

interface Sequence {
  id?: string
  name: string
  description: string
  steps: SequenceStep[]
  status: 'draft' | 'active' | 'paused'
}

const STEP_META: Record<StepType, { icon: React.ReactNode; color: string; label: string }> = {
  call:  { icon: <Phone className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Call' },
  email: { icon: <Mail className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', label: 'Email' },
  sms:   { icon: <MessageSquare className="w-4 h-4" />, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'SMS' },
  wait:  { icon: <Clock className="w-4 h-4" />, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', label: 'Wait' },
}

const CONDITIONS = [
  { value: 'always', label: 'Always' },
  { value: 'no_contact', label: 'If no contact made' },
  { value: 'no_payment', label: 'If no payment received' },
]

function uid() {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function defaultStep(type: StepType): SequenceStep {
  return {
    id: uid(),
    type,
    label: `${STEP_META[type].label} Step`,
    delay_hours: type === 'wait' ? 24 : 0,
    config: type === 'call' ? { max_attempts: 3 } : type === 'sms' ? { message: '' } : type === 'email' ? { subject: '', message: '' } : {},
    condition: 'always',
  }
}

/* ── Step Card ── */

function StepCard({
  step,
  index,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: SequenceStep
  index: number
  total: number
  onUpdate: (s: SequenceStep) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = STEP_META[step.type]

  return (
    <div className="relative">
      {/* Timeline connector */}
      {index < total - 1 && (
        <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
      )}

      <div className="flex items-start gap-3">
        {/* Icon node */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
          {meta.icon}
        </div>

        {/* Card */}
        <Card className="flex-1">
          <div
            className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
            onClick={() => setExpanded(!expanded)}
          >
            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
            <Badge variant="secondary" className="text-[10px]">{index + 1}</Badge>
            <Badge className={`text-[10px] ${meta.color}`}>{meta.label}</Badge>
            <input
              type="text"
              value={step.label}
              onChange={(e) => onUpdate({ ...step, label: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-sm font-medium bg-transparent border-none focus:ring-0 focus:outline-none text-gray-900 dark:text-gray-100"
            />
            {step.delay_hours > 0 && (
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {step.delay_hours}h delay
              </span>
            )}
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); onMoveUp() }} disabled={index === 0} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onMoveDown() }} disabled={index === total - 1} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-gray-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>

          {expanded && (
            <CardContent className="pt-0 pb-4 px-4 space-y-4 border-t border-gray-100 dark:border-gray-800">
              {/* Delay */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Delay (hours)</label>
                  <input
                    type="number"
                    min={0}
                    value={step.delay_hours}
                    onChange={(e) => onUpdate({ ...step, delay_hours: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Condition</label>
                  <select
                    value={step.condition || 'always'}
                    onChange={(e) => onUpdate({ ...step, condition: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                  >
                    {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Type-specific config */}
              {step.type === 'call' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Max Attempts</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={step.config.max_attempts || 3}
                    onChange={(e) => onUpdate({ ...step, config: { ...step.config, max_attempts: parseInt(e.target.value) || 3 } })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                  />
                </div>
              )}

              {step.type === 'email' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subject</label>
                    <input
                      type="text"
                      value={step.config.subject || ''}
                      onChange={(e) => onUpdate({ ...step, config: { ...step.config, subject: e.target.value } })}
                      placeholder="Payment reminder — {{account_name}}"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Body</label>
                    <textarea
                      value={step.config.message || ''}
                      onChange={(e) => onUpdate({ ...step, config: { ...step.config, message: e.target.value } })}
                      rows={3}
                      placeholder="Dear {{debtor_name}}, ..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                    />
                  </div>
                </>
              )}

              {step.type === 'sms' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Message</label>
                  <textarea
                    value={step.config.message || ''}
                    onChange={(e) => onUpdate({ ...step, config: { ...step.config, message: e.target.value } })}
                    rows={2}
                    placeholder="Hi {{first_name}}, this is a reminder about..."
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Variables: {'{{first_name}}, {{balance}}, {{payment_link}}'}</p>
                </div>
              )}

              {step.type === 'wait' && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>Pause sequence for {step.delay_hours} hours before next step</span>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ── Main Editor ── */

export default function ContactSequenceEditor({
  initialSequence,
  onSave,
}: {
  initialSequence?: Sequence
  onSave?: (seq: Sequence) => void
}) {
  const [sequence, setSequence] = useState<Sequence>(
    initialSequence || {
      name: '',
      description: '',
      steps: [defaultStep('call')],
      status: 'draft',
    }
  )
  const [saving, setSaving] = useState(false)

  const updateStep = useCallback((idx: number, step: SequenceStep) => {
    setSequence((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === idx ? step : s)),
    }))
  }, [])

  const removeStep = useCallback((idx: number) => {
    setSequence((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx),
    }))
  }, [])

  const moveStep = useCallback((idx: number, dir: -1 | 1) => {
    setSequence((prev) => {
      const steps = [...prev.steps]
      const target = idx + dir
      if (target < 0 || target >= steps.length) return prev
      ;[steps[idx], steps[target]] = [steps[target], steps[idx]]
      return { ...prev, steps }
    })
  }, [])

  const addStep = useCallback((type: StepType) => {
    setSequence((prev) => ({
      ...prev,
      steps: [...prev.steps, defaultStep(type)],
    }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!sequence.name.trim()) return
    setSaving(true)
    try {
      if (sequence.id) {
        await apiPut(`/api/campaigns/sequences/${sequence.id}`, sequence)
      } else {
        const res = await apiPost('/api/campaigns/sequences', sequence)
        setSequence((prev) => ({ ...prev, id: res.id || res.data?.id }))
      }
      onSave?.(sequence)
    } catch (err: any) {
      logger.error('Failed to save sequence', { error: err?.message })
    } finally {
      setSaving(false)
    }
  }, [sequence, onSave])

  return (
    <div className="space-y-6">
      {/* Sequence meta */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sequence Name</label>
              <input
                type="text"
                value={sequence.name}
                onChange={(e) => setSequence((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="30-Day Collection Sequence"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input
                type="text"
                value={sequence.description}
                onChange={(e) => setSequence((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Standard collection sequence for delinquent accounts"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {sequence.steps.length} step{sequence.steps.length !== 1 ? 's' : ''}
              </Badge>
              <Badge
                className={`text-xs ${
                  sequence.status === 'active' ? 'bg-green-100 text-green-700' :
                  sequence.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}
              >
                {sequence.status}
              </Badge>
            </div>
            <Button onClick={handleSave} disabled={saving || !sequence.name.trim()} size="sm">
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? 'Saving...' : 'Save Sequence'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline steps */}
      <div className="space-y-4 pl-1">
        {sequence.steps.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            index={i}
            total={sequence.steps.length}
            onUpdate={(s) => updateStep(i, s)}
            onRemove={() => removeStep(i)}
            onMoveUp={() => moveStep(i, -1)}
            onMoveDown={() => moveStep(i, 1)}
          />
        ))}
      </div>

      {/* Add step buttons */}
      <div className="flex items-center justify-center gap-2 py-4">
        <span className="text-xs text-gray-400 mr-2">Add step:</span>
        {(Object.keys(STEP_META) as StepType[]).map((type) => {
          const meta = STEP_META[type]
          return (
            <Button
              key={type}
              variant="outline"
              size="sm"
              onClick={() => addStep(type)}
              className="gap-1.5"
            >
              {meta.icon}
              {meta.label}
            </Button>
          )
        })}
      </div>

      {/* Validation warnings */}
      {sequence.steps.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Add at least one step to your sequence.
        </div>
      )}
    </div>
  )
}
