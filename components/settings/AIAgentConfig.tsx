"use client"

import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

interface AIConfig {
  ai_agent_id?: string | null
  ai_agent_prompt?: string | null
  ai_agent_temperature?: number
  ai_agent_model?: string
  ai_post_prompt_url?: string | null
  ai_features_enabled?: boolean
  translate_from?: string | null
  translate_to?: string | null
  live_translate?: boolean
  use_voice_cloning?: boolean
  cloned_voice_id?: string | null
}

interface AIConfigSettings {
  config: AIConfig
  plan: string
  features_available: {
    live_translation: boolean
    custom_agent_id: boolean
    custom_prompts: boolean
    voice_cloning: boolean
  }
}

interface AIAgentConfigProps {
  organizationId: string
  plan: string
  canEdit: boolean
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
]

const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)', description: 'Fast, cost-effective' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Balanced performance' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Maximum capability' },
]

export function AIAgentConfig({ organizationId, plan, canEdit }: AIAgentConfigProps) {
  const [data, setData] = useState<AIConfigSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [config, setConfig] = useState<AIConfig>({
    ai_features_enabled: true,
    ai_agent_temperature: 0.3,
    ai_agent_model: 'gpt-4o-mini',
  })

  useEffect(() => {
    loadConfig()
  }, [organizationId])

  async function loadConfig() {
    try {
      setLoading(true)
      const res = await fetch('/api/ai-config', { credentials: 'include' })

      if (!res.ok) {
        throw new Error('Failed to load AI configuration')
      }

      const result: AIConfigSettings = await res.json()
      setData(result)
      setConfig(result.config)
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        credentials: 'include',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save configuration')
      }

      setSuccess('Configuration saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  function updateConfig(updates: Partial<AIConfig>) {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <div className="loading-spinner" />
          <span className="ml-3 text-gray-500">Loading configuration...</span>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">{error}</span>
        </div>
      </div>
    )
  }

  const featuresAvailable = data?.features_available || {
    live_translation: false,
    custom_agent_id: false,
    custom_prompts: false,
    voice_cloning: false,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">AI Agent Configuration</h3>
        </div>
        <Badge variant={config.ai_features_enabled ? 'default' : 'secondary'}>
          {config.ai_features_enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
          {success}
        </div>
      )}

      {/* Master Toggle */}
      <div className="bg-white rounded-md border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">AI Features</p>
            <p className="text-sm text-gray-500">Enable AI-powered call enhancements</p>
          </div>
          <Switch
            checked={config.ai_features_enabled ?? true}
            onCheckedChange={(checked) => updateConfig({ ai_features_enabled: checked })}
            disabled={!canEdit}
          />
        </div>
      </div>

      {config.ai_features_enabled && (
        <>
          {/* Live Translation */}
          <div className="bg-white rounded-md border border-gray-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">Live Translation</p>
                {!featuresAvailable.live_translation && (
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </div>
              <Switch
                checked={config.live_translate ?? false}
                onCheckedChange={(checked) => updateConfig({ live_translate: checked })}
                disabled={!canEdit || !featuresAvailable.live_translation}
              />
            </div>

            {!featuresAvailable.live_translation && (
              <p className="text-xs text-amber-600">
                Upgrade to Business or Enterprise for live translation
              </p>
            )}

            {config.live_translate && (
              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Translate From
                  </label>
                  <select
                    value={config.translate_from || ''}
                    onChange={(e) => updateConfig({ translate_from: e.target.value })}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                  >
                    <option value="">Select language</option>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Translate To
                  </label>
                  <select
                    value={config.translate_to || ''}
                    onChange={(e) => updateConfig({ translate_to: e.target.value })}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                  >
                    <option value="">Select language</option>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Voice Cloning */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div>
                  <p className="font-medium text-gray-900">Voice Cloning</p>
                  <p className="text-sm text-gray-500">Clone voices for personalized translations</p>
                </div>
                {!featuresAvailable.voice_cloning && (
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </div>
              <Switch
                checked={config.use_voice_cloning ?? false}
                onCheckedChange={(checked) => updateConfig({ use_voice_cloning: checked })}
                disabled={!canEdit || !featuresAvailable.voice_cloning}
              />
            </div>

            {!featuresAvailable.voice_cloning && (
              <p className="text-xs text-amber-600 mt-2">
                Upgrade to Business or Enterprise for voice cloning
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              AI Model
            </label>
            <select
              value={config.ai_agent_model || 'gpt-4o-mini'}
              onChange={(e) => updateConfig({ ai_agent_model: e.target.value })}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label} - {model.description}
                </option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Temperature: {config.ai_agent_temperature ?? 0.3}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.ai_agent_temperature ?? 0.3}
              onChange={(e) => updateConfig({ ai_agent_temperature: parseFloat(e.target.value) })}
              disabled={!canEdit}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lower values (0-0.5) are more focused and deterministic. Higher values (1-2) are more creative.
            </p>
          </div>

          {/* Custom Agent ID (Business/Enterprise) */}
          {featuresAvailable.custom_agent_id && (
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Custom AI Agent ID (Optional)
              </label>
              <input
                type="text"
                value={config.ai_agent_id || ''}
                onChange={(e) => updateConfig({ ai_agent_id: e.target.value })}
                disabled={!canEdit}
                placeholder="SignalWire AI Agent ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to use default agent. Enter your SignalWire AI Agent ID for custom configuration.
              </p>
            </div>
          )}

          {/* Custom Prompt (Enterprise) */}
          {featuresAvailable.custom_prompts && (
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Custom System Prompt (Optional)
              </label>
              <textarea
                value={config.ai_agent_prompt || ''}
                onChange={(e) => updateConfig({ ai_agent_prompt: e.target.value })}
                disabled={!canEdit}
                rows={4}
                placeholder="Custom instructions for the AI agent..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Override default translation prompt with custom instructions.
              </p>
            </div>
          )}

          {/* Save Button */}
          {canEdit && (
            <button
              onClick={saveConfig}
              disabled={saving}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          )}

          {!canEdit && (
            <p className="text-sm text-gray-500 text-center">
              Contact your organization owner or admin to modify AI settings
            </p>
          )}
        </>
      )}
    </div>
  )
}
