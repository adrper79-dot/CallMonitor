/**
 * Live Translation Configuration Component
 * 
 * Allows admins to configure SignalWire AI Agent for live translation
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

interface VoiceConfig {
  id: string
  organization_id: string
  signalwire_ai_agent_id: string | null
  translation_enabled: boolean
  default_target_language: string | null
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
      const res = await fetch(`/api/voice/config?orgId=${organizationId}`)
      if (res.ok) {
        const data = await res.json()
        setConfig(data.config)
        if (data.config) {
          setFormData({
            aiAgentId: data.config.signalwire_ai_agent_id || '',
            translationEnabled: data.config.translation_enabled || false,
            defaultLanguage: data.config.default_target_language || 'es',
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setTestResult(null)

      const res = await fetch('/api/voice/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          signalwireAiAgentId: formData.aiAgentId || null,
          translationEnabled: formData.translationEnabled,
          defaultTargetLanguage: formData.defaultLanguage,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to save configuration')
      }

      await fetchConfig()
      setTestResult({ success: true, message: 'Configuration saved successfully' })
    } catch (error: any) {
      console.error('Failed to save config:', error)
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

      const res = await fetch('/api/voice/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          aiAgentId: formData.aiAgentId,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setTestResult({
          success: true,
          message: 'AI Agent connection successful! Translation is configured correctly.',
        })
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to connect to AI Agent',
        })
      }
    } catch (error: any) {
      console.error('Failed to test config:', error)
      setTestResult({
        success: false,
        message: 'Network error: Could not test AI Agent connection',
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
              Configure SignalWire AI Agent for real-time call translation
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
            onCheckedChange={(checked) =>
              setFormData({ ...formData, translationEnabled: checked })
            }
          />
        </div>

        {/* AI Agent ID */}
        <div className="space-y-2">
          <Label htmlFor="aiAgentId">SignalWire AI Agent ID</Label>
          <div className="flex gap-2">
            <Input
              id="aiAgentId"
              placeholder="e.g., 12345678-1234-1234-1234-123456789012"
              value={formData.aiAgentId}
              onChange={(e) =>
                setFormData({ ...formData, aiAgentId: e.target.value })
              }
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
            Custom AI Agent ID from your SignalWire account. Leave empty to use default.
          </p>
        </div>

        {/* Default Target Language */}
        <div className="space-y-2">
          <Label htmlFor="defaultLanguage">Default Target Language</Label>
          <Select
            value={formData.defaultLanguage}
            onValueChange={(value) =>
              setFormData({ ...formData, defaultLanguage: value })
            }
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
              {config.translation_enabled ? (
                <Badge variant="default" className="bg-green-500">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
            {config.signalwire_ai_agent_id && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">AI Agent:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {config.signalwire_ai_agent_id}
                </code>
              </div>
            )}
            {config.default_target_language && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Default Language:</span>
                <Badge variant="secondary">
                  {supportedLanguages.find((l) => l.code === config.default_target_language)?.name || config.default_target_language}
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
