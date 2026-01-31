"use client"

import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRBAC } from '@/hooks/useRBAC'
import { planSupportsFeature } from '@/lib/rbac'
import { NativeSelect as Select } from '@/components/ui/native-select'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import type { SurveyQuestionConfig, SurveyQuestionType } from '@/types/tier1-features'

export type ModKey = 'record' | 'transcribe' | 'translate' | 'survey' | 'synthetic_caller'

export interface CallModulationsProps {
  callId: string
  organizationId: string | null
  initialModulations: Record<ModKey, boolean>
  onChange: (mods: Record<ModKey, boolean>) => Promise<void>
}

/**
 * Feature toggles with authority classification
 * Reference: ARCH_DOCS/01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md
 */
const TOGGLES: { 
  key: ModKey
  label: string
  desc: string
  feature: string
  plan: string
  badge: 'Authoritative' | 'Preview'
}[] = [
  { 
    key: 'record', 
    label: 'Source Recording', 
    desc: 'Immutable call audio (never modified)', 
    feature: 'recording', 
    plan: 'Pro+',
    badge: 'Authoritative'
  },
  { 
    key: 'transcribe', 
    label: 'Canonical Transcript', 
    desc: 'AssemblyAI authoritative transcript (evidence-grade)', 
    feature: 'transcription', 
    plan: 'Pro+',
    badge: 'Authoritative'
  },
  { 
    key: 'translate', 
    label: 'Post-Call Translation', 
    desc: 'Authoritative translation from canonical transcript', 
    feature: 'translation', 
    plan: 'Global+',
    badge: 'Authoritative'
  },
  { 
    key: 'survey', 
    label: 'After-Call Survey', 
    desc: 'Automated survey with AI Survey Bot', 
    feature: 'survey', 
    plan: 'Insights+',
    badge: 'Authoritative'
  },
  { 
    key: 'synthetic_caller', 
    label: 'Secret Shopper', 
    desc: 'AI caller with scoring', 
    feature: 'secret_shopper', 
    plan: 'Insights+',
    badge: 'Authoritative'
  }
]

const SURVEY_QUESTION_TYPE_OPTIONS: Array<{ value: SurveyQuestionType; label: string }> = [
  { value: 'scale_1_5', label: 'Scale 1-5' },
  { value: 'scale_1_10', label: 'Scale 1-10' },
  { value: 'yes_no', label: 'Yes/No' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'open_ended', label: 'Open-ended' }
]

const SURVEY_PROMPT_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' }
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
  const surveyPrompts = config?.survey_prompts || []
  const surveyPromptLocales = typeof config?.survey_prompts_locales === 'object' && config?.survey_prompts_locales
    ? config.survey_prompts_locales
    : {}
  const defaultLocale = 'en'
  const defaultSurveyPrompts = surveyPromptLocales[defaultLocale] || surveyPrompts
  const surveyQuestionTypes: SurveyQuestionConfig[] = Array.isArray(config?.survey_question_types)
    ? config?.survey_question_types
    : []
  
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

  function getSurveyQuestionType(index: number): SurveyQuestionType {
    return surveyQuestionTypes.find((q) => q.index === index)?.type || 'scale_1_5'
  }

  function updateSurveyQuestionType(index: number, type: SurveyQuestionType) {
    const nextTypes = surveyQuestionTypes.filter((q) => q.index !== index)
    nextTypes.push({ index, type })
    nextTypes.sort((a, b) => a.index - b.index)
    updateConfig({ survey_question_types: nextTypes })
  }

  function handleSurveyPromptsChange(locale: string, value: string) {
    const prompts = value.split('\n').filter((q) => q.trim())
    const nextLocales = { ...surveyPromptLocales }
    if (prompts.length > 0) {
      nextLocales[locale] = prompts
    } else {
      delete nextLocales[locale]
    }

    const updates: Record<string, any> = {
      survey_prompts_locales: nextLocales
    }

    if (locale === defaultLocale) {
      const trimmedTypes = surveyQuestionTypes.filter((q) => q.index < prompts.length)
      updates.survey_prompts = prompts.length > 0 ? prompts : []
      updates.survey_question_types = trimmedTypes
    }

    updateConfig(updates)
  }

  function getPromptsForLocale(locale: string) {
    if (locale === defaultLocale) return defaultSurveyPrompts
    return surveyPromptLocales[locale] || []
  }

  return (
    <div className="space-y-3">
      {TOGGLES.map(t => {
        const { disabled, reason } = getToggleDisabled(t.key, t.feature)
        const checked = mods[t.key]
        const hasLiveTranslation = t.key === 'translate' && capabilities.real_time_translation_preview === true
        const displayLabel = hasLiveTranslation ? 'Live Translation' : t.label
        const displayDesc = hasLiveTranslation 
          ? 'Real-time assist (preview only, not recorded)'
          : t.desc
        const displayBadge = hasLiveTranslation ? 'Preview' : t.badge
        
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
                  <Badge variant={displayBadge === 'Authoritative' ? 'success' : 'warning'}>
                    {displayBadge}
                  </Badge>
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
            
            {/* Translation config - ALWAYS show language selectors when translate toggle is visible */}
            {/* This fixes the UX bug where users couldn't enable translation without first setting languages */}
            {t.key === 'translate' && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="From Language"
                    value={config?.translate_from || ''}
                    onChange={(e) => updateConfig({ translate_from: e.target.value || undefined })}
                    disabled={!canEdit}
                    hint={!checked ? 'Select before enabling' : undefined}
                  >
                    <option value="">Select...</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="zh">Chinese</option>
                    <option value="ja">Japanese</option>
                    <option value="pt">Portuguese</option>
                    <option value="it">Italian</option>
                    <option value="ko">Korean</option>
                    <option value="ar">Arabic</option>
                  </Select>
                  <Select
                    label="To Language"
                    value={config?.translate_to || ''}
                    onChange={(e) => updateConfig({ translate_to: e.target.value || undefined })}
                    disabled={!canEdit}
                    hint={!checked ? 'Select before enabling' : undefined}
                  >
                    <option value="">Select...</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="zh">Chinese</option>
                    <option value="ja">Japanese</option>
                    <option value="pt">Portuguese</option>
                    <option value="it">Italian</option>
                    <option value="ko">Korean</option>
                    <option value="ar">Arabic</option>
                  </Select>
                </div>
                {/* Show validation message if trying to enable without languages */}
                {!checked && (!config?.translate_from || !config?.translate_to) && (
                  <p className="text-xs text-warning">
                    Select both languages before enabling translation
                  </p>
                )}
                {/* Voice cloning - only show when translation is enabled */}
                {checked && (
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
                )}
              </div>
            )}
            
            {/* Expanded config for survey */}
            {checked && t.key === 'survey' && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Survey Questions (by locale)
                  </label>
                  <Tabs defaultValue={defaultLocale}>
                    <TabsList className="mb-2">
                      {SURVEY_PROMPT_LOCALES.map((locale) => (
                        <TabsTrigger key={locale.code} value={locale.code}>
                          {locale.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {SURVEY_PROMPT_LOCALES.map((locale) => (
                      <TabsContent key={locale.code} value={locale.code}>
                        <textarea
                          placeholder="On a scale of 1-5, how satisfied were you?&#10;What could we improve?"
                          value={getPromptsForLocale(locale.code).join('\n')}
                          onChange={(e) => handleSurveyPromptsChange(locale.code, e.target.value)}
                          disabled={!canEdit}
                          rows={3}
                          className="w-full text-sm p-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                        />
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
                {defaultSurveyPrompts.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-700">Question Types</div>
                    {defaultSurveyPrompts.map((prompt, idx) => (
                      <div key={`${idx}-${prompt.slice(0, 16)}`} className="flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-600 truncate">
                          Q{idx + 1}: {prompt}
                        </div>
                        <select
                          value={getSurveyQuestionType(idx)}
                          onChange={(e) => updateSurveyQuestionType(idx, e.target.value as SurveyQuestionType)}
                          disabled={!canEdit}
                          className="text-xs bg-white border border-gray-300 rounded px-2 py-1"
                        >
                          {SURVEY_QUESTION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
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
