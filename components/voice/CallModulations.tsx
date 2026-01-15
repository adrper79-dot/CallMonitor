"use client"

import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useRBAC } from '@/hooks/useRBAC'
import { planSupportsFeature } from '@/lib/rbac'
import { Select } from '@/components/ui/select'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'

export type ModKey = 'record' | 'transcribe' | 'translate' | 'survey' | 'synthetic_caller'

export interface CallModulationsProps {
  callId: string
  organizationId: string | null
  initialModulations: Record<ModKey, boolean>
  onChange: (mods: Record<ModKey, boolean>) => Promise<void>
}

const TOGGLES: { key: ModKey; label: string; desc: string; feature: string; plan: string }[] = [
  { key: 'record', label: 'Recording', desc: 'Capture call audio', feature: 'recording', plan: 'Pro+' },
  { key: 'transcribe', label: 'Transcription', desc: 'Generate text transcript', feature: 'transcription', plan: 'Pro+' },
  { key: 'translate', label: 'Translation', desc: 'Translate transcript', feature: 'translation', plan: 'Global+' },
  { key: 'survey', label: 'Post-call Survey', desc: 'AI-powered survey after call', feature: 'survey', plan: 'Insights+' },
  { key: 'synthetic_caller', label: 'Secret Shopper', desc: 'Use scripted caller', feature: 'secret_shopper', plan: 'Insights+' }
]

function useCallCapabilities(organizationId: string | null) {
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) {
      setCapabilities({})
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)

    fetch(`/api/call-capabilities?orgId=${encodeURIComponent(organizationId)}`, {
      credentials: 'include'
    })
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return
        if (json.success && json.capabilities) {
          setCapabilities(json.capabilities)
        } else {
          setCapabilities({})
        }
        setLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        setCapabilities({})
        setLoading(false)
      })

    return () => { mounted = false }
  }, [organizationId])

  return { capabilities, loading }
}

/**
 * CallModulations - Professional Design System v3.0
 * 
 * Clean toggle switches for call options.
 * Subtle, no emojis, clear hierarchy.
 */
export default function CallModulations({ callId, organizationId, initialModulations, onChange }: CallModulationsProps) {
  const { role, plan, loading: rbacLoading } = useRBAC(organizationId)
  const { config, updateConfig, loading: configLoading } = useVoiceConfig(organizationId)
  const { capabilities } = useCallCapabilities(organizationId)
  
  const effectiveMods = config && !configLoading ? {
    record: config.record ?? false,
    transcribe: config.transcribe ?? false,
    translate: config.translate ?? false,
    survey: config.survey ?? false,
    synthetic_caller: config.synthetic_caller ?? false,
  } : initialModulations
  
  const [mods, setMods] = useState<Record<ModKey, boolean>>(() => ({ ...effectiveMods }))
  const [pending, setPending] = useState<Record<ModKey, boolean>>(() => ({ record: false, transcribe: false, translate: false, survey: false, synthetic_caller: false }))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (config && !configLoading) {
      setMods({
        record: config.record ?? false,
        transcribe: config.transcribe ?? false,
        translate: config.translate ?? false,
        survey: config.survey ?? false,
        synthetic_caller: config.synthetic_caller ?? false,
      })
    } else if (!configLoading) {
      setMods({ ...initialModulations })
    }
  }, [config, configLoading, initialModulations])

  const canEdit = role === 'owner' || role === 'admin'

  async function handleToggle(key: ModKey) {
    if (!canEdit) {
      setError('Only Owners and Admins can modify settings')
      return
    }

    setError(null)
    const prev = { ...mods }
    const next = { ...mods, [key]: !mods[key] }
    
    setMods(next)
    setPending(p => ({ ...p, [key]: true }))
    
    try {
      await updateConfig({ [key]: next[key] })
      await onChange(next)
    } catch (e: any) {
      setMods(prev)
      setError(e?.message ?? 'Update failed')
    } finally {
      setPending(p => ({ ...p, [key]: false }))
    }
  }

  function getToggleDisabled(key: ModKey, feature: string): { disabled: boolean; reason?: string } {
    if (rbacLoading) return { disabled: true, reason: 'Loading...' }
    if (!plan) return { disabled: true, reason: 'Plan not available' }
    if (!planSupportsFeature(plan, feature)) {
      return { disabled: true, reason: `Requires ${TOGGLES.find(t => t.key === key)?.plan || 'upgrade'}` }
    }
    if (!canEdit && key !== 'record' && key !== 'transcribe') {
      return { disabled: true, reason: 'Owner/Admin only' }
    }
    return { disabled: false }
  }

  return (
    <div className="space-y-3">
      {TOGGLES.map(t => {
        const { disabled, reason } = getToggleDisabled(t.key, t.feature)
        const checked = mods[t.key]
        const hasLiveTranslation = t.key === 'translate' && capabilities.real_time_translation_preview === true
        const displayLabel = hasLiveTranslation ? 'Live Translation' : t.label
        const displayDesc = hasLiveTranslation 
          ? 'Real-time voice translation'
          : t.desc
        
        return (
          <div key={t.key} className="p-3 bg-gray-50 rounded-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Label 
                    htmlFor={`mod-${t.key}`} 
                    className="text-sm font-medium text-gray-900"
                  >
                    {displayLabel}
                  </Label>
                  {hasLiveTranslation && (
                    <Badge variant="info">Preview</Badge>
                  )}
                  {disabled && reason && (
                    <span className="text-xs text-gray-400">{reason}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{displayDesc}</p>
              </div>

              <div className="flex items-center gap-3 ml-4">
                <Switch
                  id={`mod-${t.key}`}
                  checked={checked}
                  onCheckedChange={() => !disabled && !pending[t.key] && handleToggle(t.key)}
                  disabled={disabled || pending[t.key]}
                  aria-label={t.label}
                />
                <span className={`text-xs w-10 text-right tabular-nums ${
                  pending[t.key] ? 'text-gray-400' :
                  checked ? 'text-success font-medium' : 'text-gray-400'
                }`}>
                  {pending[t.key] ? '...' : checked ? 'On' : 'Off'}
                </span>
              </div>
            </div>
            
            {/* Expanded config for translate */}
            {checked && t.key === 'translate' && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="From"
                    value={config?.translate_from || ''}
                    onChange={(e) => updateConfig({ translate_from: e.target.value || undefined })}
                    disabled={!canEdit}
                  >
                    <option value="">Select...</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="zh">Chinese</option>
                    <option value="ja">Japanese</option>
                  </Select>
                  <Select
                    label="To"
                    value={config?.translate_to || ''}
                    onChange={(e) => updateConfig({ translate_to: e.target.value || undefined })}
                    disabled={!canEdit}
                  >
                    <option value="">Select...</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="zh">Chinese</option>
                    <option value="ja">Japanese</option>
                  </Select>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                  <div>
                    <span className="text-xs font-medium text-gray-700">Voice Cloning</span>
                    <p className="text-xs text-gray-500">Clone caller voice</p>
                  </div>
                  <Switch
                    id="voice-cloning-toggle"
                    checked={config?.use_voice_cloning || false}
                    onCheckedChange={(checked) => updateConfig({ use_voice_cloning: checked })}
                    disabled={!canEdit}
                    aria-label="Voice Cloning"
                  />
                </div>
              </div>
            )}
            
            {/* Expanded config for survey */}
            {checked && t.key === 'survey' && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Survey Questions
                  </label>
                  <textarea
                    placeholder="On a scale of 1-5, how satisfied were you?&#10;What could we improve?"
                    value={config?.survey_prompts?.join('\n') || ''}
                    onChange={(e) => {
                      const prompts = e.target.value.split('\n').filter(q => q.trim())
                      updateConfig({ survey_prompts: prompts.length > 0 ? prompts : [] })
                    }}
                    disabled={!canEdit}
                    rows={3}
                    className="w-full text-sm p-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email Results To
                  </label>
                  <input
                    type="email"
                    placeholder="results@company.com"
                    value={config?.survey_webhook_email || ''}
                    onChange={(e) => updateConfig({ survey_webhook_email: e.target.value || undefined })}
                    disabled={!canEdit}
                    className="w-full text-sm p-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                  />
                </div>
              </div>
            )}
            
            {/* Expanded config for secret shopper */}
            {checked && t.key === 'synthetic_caller' && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <Select
                  label="Script"
                  value={config?.script_id || ''}
                  onChange={(e) => updateConfig({ script_id: e.target.value || null })}
                  disabled={!canEdit}
                >
                  <option value="">Select a script...</option>
                </Select>
              </div>
            )}
          </div>
        )
      })}

      {error && (
        <div role="alert" className="text-sm text-error bg-error-light rounded-md p-3">
          {error}
        </div>
      )}
    </div>
  )
}
