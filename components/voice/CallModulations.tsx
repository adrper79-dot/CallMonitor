"use client"

import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useRBAC, usePermission } from '@/hooks/useRBAC'
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
  { key: 'transcribe', label: 'Transcribe', desc: 'Generate transcript', feature: 'transcription', plan: 'Pro+' },
  { key: 'translate', label: 'Translate', desc: 'Translate transcript', feature: 'translation', plan: 'Global+' },
  { key: 'survey', label: 'After-call Survey', desc: 'Run after-call survey', feature: 'survey', plan: 'Insights+' },
  { key: 'synthetic_caller', label: 'Secret Shopper', desc: 'Use secret shopper script', feature: 'secret_shopper', plan: 'Insights+' }
]

export default function CallModulations({ callId, organizationId, initialModulations, onChange }: CallModulationsProps) {
  const { role, plan, loading: rbacLoading } = useRBAC(organizationId)
  const { config, updateConfig } = useVoiceConfig(organizationId)
  const [mods, setMods] = useState<Record<ModKey, boolean>>(() => ({ ...initialModulations }))
  const [pending, setPending] = useState<Record<ModKey, boolean>>(() => ({ record: false, transcribe: false, translate: false, survey: false, synthetic_caller: false }))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMods({ ...initialModulations })
  }, [initialModulations])

  const canEdit = role === 'owner' || role === 'admin'

  async function handleToggle(key: ModKey) {
    if (!canEdit) {
      setError('Only Owners and Admins can modify modulations')
      return
    }

    setError(null)
    const prev = { ...mods }
    const next = { ...mods, [key]: !mods[key] }
    
    // Optimistic UI
    setMods(next)
    setPending(p => ({ ...p, [key]: true }))
    
    try {
      // Update via voice config API
      const configKey = key === 'record' ? 'recording_enabled' :
                       key === 'transcribe' ? 'transcription_enabled' :
                       key === 'translate' ? 'translation_enabled' :
                       key === 'survey' ? 'survey_enabled' :
                       'secret_shopper_enabled'
      
      await updateConfig({ [configKey]: next[key] })
      await onChange(next)
    } catch (e: any) {
      // Rollback
      setMods(prev)
      setError(e?.message ?? 'Update failed')
    } finally {
      setPending(p => ({ ...p, [key]: false }))
    }
  }

  function getToggleDisabled(key: ModKey, feature: string): { disabled: boolean; reason?: string } {
    if (rbacLoading) {
      return { disabled: true, reason: 'Loading permissions...' }
    }

    if (!plan) {
      return { disabled: true, reason: 'Plan not available' }
    }

    if (!planSupportsFeature(plan, feature)) {
      return { disabled: true, reason: `This feature requires ${TOGGLES.find(t => t.key === key)?.plan || 'a higher plan'}` }
    }

    if (!canEdit && key !== 'record' && key !== 'transcribe') {
      return { disabled: true, reason: 'Only Owners and Admins can modify this' }
    }

    return { disabled: false }
  }

  return (
    <section aria-labelledby={`call-modulations-${callId}`} className="w-full p-4 bg-slate-950 rounded-md border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h3 id={`call-modulations-${callId}`} className="text-lg font-medium text-slate-100">Call Modulations</h3>
        {!canEdit && (
          <p className="text-sm text-slate-400">Read-only (Owner/Admin can modify)</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {TOGGLES.map(t => {
          const { disabled, reason } = getToggleDisabled(t.key, t.feature)
          const checked = mods[t.key]
          
          return (
            <div key={t.key} className="flex items-center justify-between p-3 rounded-md bg-slate-800 hover:bg-slate-700">
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`mod-${t.key}`} className="text-sm text-slate-100">
                    {t.label}
                  </Label>
                  {disabled && reason && (
                    <Tooltip content={reason}>
                      <span className="text-xs text-amber-400" aria-label={reason}>⚠</span>
                    </Tooltip>
                  )}
                </div>
                <span className="text-xs text-slate-400">{t.desc}</span>
                
                {/* Additional config for specific modulations */}
                {checked && t.key === 'translate' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Select
                      label="From Language"
                      value={config?.translation_from || ''}
                      onChange={(e) => updateConfig({ translation_from: e.target.value })}
                      disabled={!canEdit}
                      className="text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </Select>
                    <Select
                      label="To Language"
                      value={config?.translation_to || ''}
                      onChange={(e) => updateConfig({ translation_to: e.target.value })}
                      disabled={!canEdit}
                      className="text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </Select>
                  </div>
                )}
                
                {checked && t.key === 'survey' && (
                  <div className="mt-2">
                    <Select
                      label="Survey"
                      value={config?.survey_id || ''}
                      onChange={(e) => updateConfig({ survey_id: e.target.value || null })}
                      disabled={!canEdit}
                      className="text-sm"
                    >
                      <option value="">Select a survey...</option>
                      {/* Surveys would be loaded from API */}
                    </Select>
                  </div>
                )}
                
                {checked && t.key === 'synthetic_caller' && (
                  <div className="mt-2">
                    <Select
                      label="Script"
                      value={config?.script_id || ''}
                      onChange={(e) => updateConfig({ script_id: e.target.value || null })}
                      disabled={!canEdit}
                      className="text-sm"
                    >
                      <option value="">Select a script...</option>
                      {/* Scripts would be loaded from API */}
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 ml-4">
                <Switch
                  id={`mod-${t.key}`}
                  checked={checked}
                  onCheckedChange={() => !disabled && !pending[t.key] && handleToggle(t.key)}
                  disabled={disabled || pending[t.key]}
                  aria-label={t.label}
                  aria-describedby={disabled && reason ? `mod-${t.key}-hint` : undefined}
                />
                <div className="text-xs text-slate-400 w-12 text-right">
                  {pending[t.key] ? (
                    <span aria-live="polite">Updating…</span>
                  ) : (
                    checked ? 'On' : 'Off'
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div role="status" aria-live="assertive" className="mt-3 text-sm text-red-400">
          {error}
        </div>
      )}
    </section>
  )
}
