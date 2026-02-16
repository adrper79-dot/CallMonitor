'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowRight,
  Wand2,
  Save,
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiPost } from '@/lib/apiClient'
import {
  useCrmIntegration,
  getCrmFields,
  updateFieldMappings,
  type FieldMapping,
} from '@/hooks/useCrmIntegration'

// ─── Constants ───────────────────────────────────────────────────────────────

const WIB_FIELDS: { name: string; label: string; description: string }[] = [
  { name: 'phone_number', label: 'Phone Number', description: 'Caller phone number' },
  { name: 'caller_name', label: 'Caller Name', description: 'Identified caller name' },
  { name: 'call_duration', label: 'Call Duration', description: 'Duration in seconds' },
  { name: 'disposition', label: 'Disposition', description: 'Call outcome category' },
  { name: 'sentiment_score', label: 'Sentiment Score', description: 'AI sentiment analysis (-1 to 1)' },
  { name: 'recording_url', label: 'Recording URL', description: 'Link to call recording' },
  { name: 'transcript_summary', label: 'Transcript Summary', description: 'AI-generated call summary' },
]

const DIRECTION_OPTIONS: { value: FieldMapping['direction']; label: string }[] = [
  { value: 'to_crm', label: '→ To CRM' },
  { value: 'from_crm', label: '← From CRM' },
  { value: 'bidirectional', label: '↔ Both' },
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface CrmField {
  name: string
  label: string
  type: string
}

interface CrmFieldMapperProps {
  integrationId: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CrmFieldMapper({ integrationId }: CrmFieldMapperProps) {
  const { integration, isLoading: integrationLoading, mutate } = useCrmIntegration(integrationId)
  const [crmFields, setCrmFields] = useState<CrmField[]>([])
  const [loadingFields, setLoadingFields] = useState(false)
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [autoMapping, setAutoMapping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load CRM fields when integration changes
  const fetchCrmFields = useCallback(async () => {
    if (!integration?.provider) return
    setLoadingFields(true)
    setError(null)
    try {
      const fields = await getCrmFields(integration.provider, 'contact')
      setCrmFields(fields)
    } catch {
      setError('Failed to load CRM fields. Check your integration credentials.')
    } finally {
      setLoadingFields(false)
    }
  }, [integration?.provider])

  useEffect(() => {
    fetchCrmFields()
  }, [fetchCrmFields])

  // Initialize mappings from integration data
  useEffect(() => {
    if (integration?.field_mappings?.length) {
      setMappings(integration.field_mappings)
    }
  }, [integration?.field_mappings])

  // ─── Handlers ────────────────────────────────────────────────────────────

  const updateMapping = (index: number, field: keyof FieldMapping, value: string) => {
    setMappings((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    setSaved(false)
  }

  const addMapping = () => {
    setMappings((prev) => [
      ...prev,
      { wib_field: '', crm_field: '', direction: 'to_crm' as const },
    ])
    setSaved(false)
  }

  const removeMapping = (index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  const handleSave = async () => {
    const validMappings = mappings.filter((m) => m.wib_field && m.crm_field)
    if (validMappings.length === 0) {
      setError('At least one complete mapping is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateFieldMappings(integrationId, validMappings)
      mutate()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save mappings')
    } finally {
      setSaving(false)
    }
  }

  const handleAutoMap = async () => {
    if (!integration?.provider || crmFields.length === 0) return
    setAutoMapping(true)
    setError(null)
    try {
      const prompt = `Given these WIB (Word Is Bond) call center fields: ${WIB_FIELDS.map((f) => f.name).join(', ')}
And these ${integration.provider} CRM fields: ${crmFields.map((f) => `${f.name} (${f.label}, type: ${f.type})`).join(', ')}
Suggest the best field mappings as a JSON array of objects with {wib_field, crm_field, direction} where direction is "to_crm", "from_crm", or "bidirectional". Only map fields that have a logical correspondence.`

      const res = await apiPost('/api/bond-ai/chat', {
        message: prompt,
        context: 'crm_field_mapping',
      })

      const aiResponse = res.data as { reply: string }
      // Extract JSON from AI response
      const jsonMatch = aiResponse.reply.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const suggested: FieldMapping[] = JSON.parse(jsonMatch[0])
        // Validate that suggested fields exist
        const validSuggestions = suggested.filter(
          (s) =>
            WIB_FIELDS.some((w) => w.name === s.wib_field) &&
            crmFields.some((c) => c.name === s.crm_field)
        )
        if (validSuggestions.length > 0) {
          setMappings(validSuggestions)
          setSaved(false)
        } else {
          setError('AI could not find matching fields. Map them manually.')
        }
      } else {
        setError('AI response did not contain valid mappings. Map them manually.')
      }
    } catch {
      setError('Auto-mapping failed. Please map fields manually.')
    } finally {
      setAutoMapping(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (integrationLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!integration) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Integration not found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Field Mapping — {integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)}</CardTitle>
            <CardDescription className="mt-1">
              Map Word Is Bond fields to your CRM fields for automatic data sync
            </CardDescription>
          </div>
          <Badge variant={integration.status === 'connected' ? 'default' : 'secondary'}>
            {integration.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAutoMap}
            disabled={autoMapping || loadingFields || crmFields.length === 0}
            className="gap-1"
          >
            {autoMapping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            Auto-Map with AI
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchCrmFields}
            disabled={loadingFields}
            className="gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${loadingFields ? 'animate-spin' : ''}`} />
            Refresh CRM Fields
          </Button>
          <div className="flex-1" />
          <Button size="sm" onClick={addMapping} variant="outline" className="gap-1">
            <Plus className="h-3 w-3" /> Add Row
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Column Headers */}
        <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-3 items-center px-1">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            WIB Field
          </Label>
          <span />
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            CRM Field
          </Label>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Direction
          </Label>
          <span />
        </div>

        {/* Mapping Rows */}
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No field mappings configured</p>
            <p className="text-xs mt-1">Click &quot;Auto-Map with AI&quot; or &quot;Add Row&quot; to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mappings.map((mapping, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-3 items-center p-2 rounded-md border border-border bg-muted/30 dark:bg-muted/10"
              >
                {/* WIB Field Selector */}
                <Select
                  value={mapping.wib_field}
                  onValueChange={(value) => updateMapping(index, 'wib_field', value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select WIB field" />
                  </SelectTrigger>
                  <SelectContent>
                    {WIB_FIELDS.map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        <div className="flex flex-col">
                          <span>{field.label}</span>
                          <span className="text-xs text-muted-foreground">{field.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Arrow */}
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                {/* CRM Field Selector */}
                <Select
                  value={mapping.crm_field}
                  onValueChange={(value) => updateMapping(index, 'crm_field', value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={loadingFields ? 'Loading...' : 'Select CRM field'} />
                  </SelectTrigger>
                  <SelectContent>
                    {crmFields.map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        <div className="flex flex-col">
                          <span>{field.label}</span>
                          <span className="text-xs text-muted-foreground">{field.type}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Direction Selector */}
                <Select
                  value={mapping.direction}
                  onValueChange={(value) => updateMapping(index, 'direction', value)}
                >
                  <SelectTrigger className="h-9 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Remove Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive h-9 w-9 p-0"
                  onClick={() => removeMapping(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {mappings.filter((m) => m.wib_field && m.crm_field).length} of {mappings.length} mappings complete
          </p>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </span>
            )}
            <Button onClick={handleSave} disabled={saving || mappings.length === 0} className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Mappings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
