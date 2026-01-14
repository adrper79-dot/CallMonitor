"use client"

import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
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

/**
 * Hook to fetch call capabilities
 */
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

    fetch(`/api/call-capabilities?orgId=${encodeURIComponent(organizationId)}`)
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

    return () => {
      mounted = false
    }
  }, [organizationId])

  return { capabilities, loading }
}

export default function CallModulations({ callId, organizationId, initialModulations, onChange }: CallModulationsProps) {
  const { role, plan, loading: rbacLoading } = useRBAC(organizationId)
  const { config, updateConfig, loading: configLoading } = useVoiceConfig(organizationId)
  const { capabilities, loading: capabilitiesLoading } = useCallCapabilities(organizationId)
  
  // Use config from database if available, otherwise fall back to initialModulations
  // Use config from database if available, otherwise fall back to initialModulations
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

  // Update mods when config loads or changes
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
      // Update via voice config API - maps to database column names
      // Key names match database columns: record, transcribe, translate, survey, synthetic_caller
      await updateConfig({ [key]: next[key] })
      // Notify parent component of change
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
    <section aria-labelledby={`call-modulations-${callId}`} className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 id={`call-modulations-${callId}`} className="text-base font-semibold text-[#333333]">Call Features</h3>
        {!canEdit && (
          <p className="text-xs text-[#666666]">Read-only (Owner/Admin can modify)</p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {TOGGLES.map(t => {
          const { disabled, reason } = getToggleDisabled(t.key, t.feature)
          const checked = mods[t.key]
          const hasLiveTranslationPreview = t.key === 'translate' && capabilities.real_time_translation_preview === true
          const displayLabel = hasLiveTranslationPreview ? 'Live Translation' : t.label
          const displayDesc = hasLiveTranslationPreview 
            ? 'Real-time voice translation (post-call transcripts are authoritative)'
            : t.desc
          
          return (
            <div key={t.key} className="flex items-center justify-between p-3 rounded-lg bg-white border border-[#E5E5E5] hover:border-[#D0D0D0] transition-all duration-200">
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`mod-${t.key}`} className="text-sm font-medium text-[#333333]">
                    {displayLabel}
                  </Label>
                  {hasLiveTranslationPreview && (
                    <Badge variant="default" className="text-xs bg-blue-600 text-white">
                      Preview
                    </Badge>
                  )}
                  {hasLiveTranslationPreview && (
                    <span 
                      className="text-xs text-blue-400 cursor-help" 
                      aria-label="Live translation info"
                      title="Live translation is immediate. Post-call transcripts are authoritative."
                    >
                      ℹ️
                    </span>
                  )}
                  {disabled && reason && !hasLiveTranslationPreview && (
                    <span 
                      className="text-xs text-amber-400" 
                      aria-label={reason}
                      title={reason}
                    >
                      ⚠
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{displayDesc}</span>
                
                {/* Additional config for specific modulations */}
                {checked && t.key === 'translate' && (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        label="From Language"
                        value={config?.translate_from || ''}
                        onChange={(e) => updateConfig({ translate_from: e.target.value || undefined })}
                        disabled={!canEdit}
                        className="text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="it">Italian</option>
                        <option value="pt">Portuguese</option>
                        <option value="zh">Chinese</option>
                        <option value="ja">Japanese</option>
                        <option value="ko">Korean</option>
                        <option value="ar">Arabic</option>
                        <option value="hi">Hindi</option>
                        <option value="ru">Russian</option>
                      </Select>
                      <Select
                        label="To Language"
                        value={config?.translate_to || ''}
                        onChange={(e) => updateConfig({ translate_to: e.target.value || undefined })}
                        disabled={!canEdit}
                        className="text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="it">Italian</option>
                        <option value="pt">Portuguese</option>
                        <option value="zh">Chinese</option>
                        <option value="ja">Japanese</option>
                        <option value="ko">Korean</option>
                        <option value="ar">Arabic</option>
                        <option value="hi">Hindi</option>
                        <option value="ru">Russian</option>
                      </Select>
                    </div>
                    {/* Voice cloning toggle */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAFA] border border-[#E5E5E5]">
                      <div className="flex flex-col">
                        <span className="text-xs text-[#333333] font-medium">Voice Cloning</span>
                        <span className="text-xs text-[#666666]">Clone caller&apos;s voice for translated audio</span>
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
                
                {checked && t.key === 'survey' && (
                  <div className="mt-2 space-y-3">
                    {/* AI Survey Bot Prompts */}
                    <div>
                      <label className="block text-xs font-medium text-[#333333] mb-1">Survey Questions (one per line)</label>
                      <textarea
                        placeholder="On a scale of 1-5, how satisfied were you?&#10;What could we improve?&#10;Would you recommend us to others?"
                        value={config?.survey_prompts?.join('\n') || ''}
                        onChange={(e) => {
                          const prompts = e.target.value.split('\n').filter(q => q.trim())
                          updateConfig({ survey_prompts: prompts.length > 0 ? prompts : [] })
                        }}
                        disabled={!canEdit}
                        className="w-full text-sm p-2 rounded-lg bg-white text-[#333333] border border-[#E5E5E5] focus:border-[#C4001A] focus:outline-none focus:ring-2 focus:ring-[#C4001A] transition-all duration-200"
                        rows={4}
                      />
                      <p className="text-xs text-[#666666] mt-1">
                        AI Survey Bot will ask each question and collect responses
                      </p>
                    </div>
                    
                    {/* Email for Results */}
                    <div>
                      <label className="block text-xs font-medium text-[#333333] mb-1">Email for Results (optional)</label>
                      <input
                        type="email"
                        placeholder="results@yourcompany.com"
                        value={config?.survey_webhook_email || ''}
                        onChange={(e) => updateConfig({ survey_webhook_email: e.target.value || undefined })}
                        disabled={!canEdit}
                        className="w-full text-sm p-2 rounded-lg bg-white text-[#333333] border border-[#E5E5E5] focus:border-[#C4001A] focus:outline-none focus:ring-2 focus:ring-[#C4001A] transition-all duration-200"
                      />
                    </div>
                    
                    {/* Voice Selection */}
                    <Select
                      label="Bot Voice"
                      value={config?.survey_voice || 'rime.spore'}
                      onChange={(e) => updateConfig({ survey_voice: e.target.value })}
                      disabled={!canEdit}
                      className="text-sm"
                    >
                      <option value="rime.spore">English - Spore (Default)</option>
                      <option value="rime.alberto">Spanish - Alberto</option>
                      <option value="rime.viola">French - Viola</option>
                      <option value="rime.stella">German - Stella</option>
                      <option value="rime.paola">Italian - Paola</option>
                      <option value="rime.luana">Portuguese - Luana</option>
                      <option value="rime.akari">Japanese - Akari</option>
                      <option value="rime.ling">Chinese - Ling</option>
                      <option value="rime.yeonjun">Korean - Yeonjun</option>
                    </Select>
                    
                    {/* Inbound Number Info */}
                    {config?.survey_inbound_number && (
                      <div className="p-2 rounded-lg bg-[#E8F5E9] border border-[#C8E6C9]">
                        <span className="text-xs text-[#59A14F] font-medium">
                          ✓ Inbound number configured for AI Survey Bot
                        </span>
                      </div>
                    )}
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
                <div className="text-xs text-[#666666] w-12 text-right tabular-nums">
                  {pending[t.key] ? (
                    <span aria-live="polite" className="text-[#4E79A7]">Updating…</span>
                  ) : (
                    <span className={checked ? 'text-[#59A14F] font-medium' : 'text-[#999999]'}>
                      {checked ? 'On' : 'Off'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div role="status" aria-live="assertive" className="mt-3 text-sm text-[#E15759] bg-[#FFEBEE] border border-[#FFCDD2] rounded-lg p-2">
          {error}
        </div>
      )}
    </section>
  )
}
