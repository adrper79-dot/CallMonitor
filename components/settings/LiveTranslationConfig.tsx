/**
 * Live Translation Configuration Component
 *
 * Allows admins to configure Telnyx AI Agent for live translation
 * Manages custom AI agent IDs and translation settings
 *
 * Features:
 * - Configure AI Agent ID
 * - Test translation endpoint
 * - View translation settings
 * - Enable/disable live translation
 *
 * @module components/settings/LiveTranslationConfig
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Languages, Save, TestTube2, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { logger } from '@/lib/logger'
import { apiGet, apiPut, apiPost } from '@/lib/apiClient'

interface VoiceConfig {
  id: string
  organization_id: string
  ai_agent_id: string | null
  translate: boolean
  live_translate: boolean
  translate_from: string | null
  translate_to: string | null
  created_at: string
  updated_at: string
}

const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese (Mandarin)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
]

interface LiveTranslationConfigProps {
  organizationId: string
}

export function LiveTranslationConfig({ organizationId }: LiveTranslationConfigProps) {
  const [config, setConfig] = useState<VoiceConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [formData, setFormData] = useState({
    aiAgentId: '',
    translationEnabled: false,
    defaultLanguage: 'es',
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const data = await apiGet<{ config: VoiceConfig }>(
        `/api/voice/config?orgId=${organizationId}`
      )
      setConfig(data.config)
      if (data.config) {
        setFormData({
          aiAgentId: data.config.ai_agent_id || '',
          translationEnabled: data.config.translate || data.config.live_translate || false,
          defaultLanguage: data.config.translate_to || 'es',
        })
      }
    } catch (error) {
      logger.error('Failed to fetch live translation config', error, { organizationId })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setTestResult(null)

      // Use PUT method with correct field names matching voice_configs schema
      await apiPut('/api/voice/config', {
        orgId: organizationId,
        modulations: {
          translate: formData.translationEnabled,
          live_translate: formData.translationEnabled,
          translate_from: 'en', // Source language (English)
          translate_to: formData.defaultLanguage,
        },
      })

      await fetchConfig()
      setTestResult({ success: true, message: 'Configuration saved successfully' })
    } catch (error: any) {
      logger.error('Failed to save live translation config', error, {
        organizationId,
        aiAgentId: formData.aiAgentId,
      })
      setTestResult({ success: false, message: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!formData.aiAgentId) {
      setTestResult({ success: false, message: 'Please enter an AI Agent ID first' })
      return
    }

    try {
      setTesting(true)
      setTestResult(null)

      const data = await apiPost<{ success?: boolean; error?: string }>('/api/voice/config/test', {
        organizationId,
        aiAgentId: formData.aiAgentId,
      })

      setTestResult({
        success: true,
        message: 'AI Agent connection successful! Translation is configured correctly.',
      })
    } catch (error: any) {
      logger.error('Failed to test AI agent connection', error, {
        organizationId,
        aiAgentId: formData.aiAgentId,
      })
      setTestResult({
        success: false,
        message: error.message || 'Failed to connect to AI Agent',
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          <div>
            <CardTitle>Live Translation Configuration</CardTitle>
            <CardDescription>
              Configure Telnyx AI Agent for real-time call translation
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Translation */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label className="text-base font-medium">Enable Live Translation</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Turn on real-time translation for incoming calls
            </p>
          </div>
          <Switch
            checked={formData.translationEnabled}
            onCheckedChange={(checked) => setFormData({ ...formData, translationEnabled: checked })}
          />
        </div>

        {/* AI Agent ID */}
        <div className="space-y-2">
          <Label htmlFor="aiAgentId">Telnyx AI Agent ID</Label>
          <div className="flex gap-2">
            <Input
              id="aiAgentId"
              placeholder="e.g., 12345678-1234-1234-1234-123456789012"
              value={formData.aiAgentId}
              onChange={(e) => setFormData({ ...formData, aiAgentId: e.target.value })}
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!formData.aiAgentId || testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Custom AI Agent ID from your Telnyx account. Leave empty to use default.
          </p>
        </div>

        {/* Default Target Language */}
        <div className="space-y-2">
          <Label htmlFor="defaultLanguage">Default Target Language</Label>
          <Select
            value={formData.defaultLanguage}
            onValueChange={(value) => setFormData({ ...formData, defaultLanguage: value })}
          >
            <SelectTrigger id="defaultLanguage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Default language for translating incoming calls
          </p>
        </div>

        {/* Test Result */}
        {testResult && (
          <Alert variant={testResult.success ? 'default' : 'destructive'}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5" />
              )}
              <AlertDescription>{testResult.message}</AlertDescription>
            </div>
          </Alert>
        )}

        {/* Current Configuration Status */}
        {config && (
          <div className="border-t pt-4 space-y-2">
            <h4 className="text-sm font-medium">Current Status</h4>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Translation:</span>
              {config.translate ? (
                <Badge variant="default" className="bg-green-500">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
            {config.ai_agent_id && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">AI Agent:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{config.ai_agent_id}</code>
              </div>
            )}
            {config.translate_to && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Default Language:</span>
                <Badge variant="secondary">
                  {supportedLanguages.find((l) => l.code === config.translate_to)?.name ||
                    config.translate_to}
                </Badge>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(config.updated_at).toLocaleString()}
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
