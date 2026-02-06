"use client"

import React, { useState, useEffect, useRef } from 'react'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { useTargetNumber } from '@/hooks/TargetNumberProvider'
import { useRBAC } from '@/hooks/useRBAC'
import { NativeSelect as Select } from '@/components/ui/native-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { apiGet, apiPost } from '@/lib/apiClient'

export interface Target {
  id: string
  phone_number: string
  name: string | null
  is_active: boolean
}

export interface Campaign {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

export interface TargetCampaignSelectorProps {
  organizationId: string | null
}

/**
 * TargetCampaignSelector - Simplified Single-Input Design
 * 
 * Steve Jobs principle: Focus on what matters
 * - One primary input field for the target number
 * - Smart autocomplete from saved targets
 * - Optional "Your number" for bridge calls
 * - Campaigns in collapsible Advanced section
 * 
 * Professional Design System v3.0
 */
export default function TargetCampaignSelector({ organizationId }: TargetCampaignSelectorProps) {
  const { config, loading: configLoading, updateConfig } = useVoiceConfig(organizationId)
  const { role } = useRBAC(organizationId)
  const { toast } = useToast()
  const { targetNumber, setTargetNumber } = useTargetNumber() // Use shared context

  const [targets, setTargets] = useState<Target[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddTarget, setShowAddTarget] = useState(false)
  const [newTarget, setNewTarget] = useState({ phone_number: '', name: '' })
  const [fromNumber, setFromNumber] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const canEdit = role === 'owner' || role === 'admin'

  useEffect(() => {
    if (!organizationId) return

    async function fetchData() {
      if (!organizationId) return
      try {
        setLoading(true)
        const [targetsData, campaignsData] = await Promise.all([
          apiGet(`/api/voice/targets?orgId=${encodeURIComponent(organizationId)}`),
          apiGet(`/api/campaigns?orgId=${encodeURIComponent(organizationId)}`),
        ])

        setTargets(targetsData.targets || [])
        setCampaigns(campaignsData.campaigns || [])
      } catch (err) {
        setCampaigns([])
        setTargets([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId])

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter targets for autocomplete
  const filteredTargets = targets.filter(t =>
    t.is_active && (
      t.phone_number.includes(targetNumber) ||
      t.name?.toLowerCase().includes(targetNumber.toLowerCase())
    )
  ).slice(0, 5)

  // Validate E.164 format
  const isValidE164 = (number: string) => /^\+[1-9]\d{1,14}$/.test(number)
  const isTargetValid = isValidE164(targetNumber)

  // Auto-format phone number to E.164
  const autoFormatPhone = (value: string): string => {
    // Remove all non-digit characters except +
    let cleaned = value.replace(/[^\d+]/g, '')

    // If starts with digits (no +), assume US number and add +1
    if (cleaned.length > 0 && !cleaned.startsWith('+')) {
      // Remove any leading 1 if present (to avoid +11...)
      if (cleaned.startsWith('1') && cleaned.length > 10) {
        cleaned = cleaned.slice(1)
      }
      cleaned = '+1' + cleaned
    }

    return cleaned
  }

  // Handle target number change with auto-formatting
  const handleTargetChange = (value: string) => {
    // Only auto-format when user pastes or types enough digits
    let formattedValue = value

    // Auto-format if it looks like a raw phone number (10+ digits, no +)
    if (/^\d{10,}$/.test(value.replace(/\D/g, '')) && !value.startsWith('+')) {
      formattedValue = autoFormatPhone(value)
    }

    setTargetNumber(formattedValue)
    setShowSuggestions(formattedValue.length > 0 && filteredTargets.length > 0)

    // Sync to config
    if (isValidE164(formattedValue)) {
      updateConfig({ quick_dial_number: formattedValue, target_id: null })
    }
  }

  // Handle blur to auto-format incomplete numbers
  const handleTargetBlur = () => {
    if (targetNumber && !targetNumber.startsWith('+')) {
      const formatted = autoFormatPhone(targetNumber)
      setTargetNumber(formatted)
      if (isValidE164(formatted)) {
        updateConfig({ quick_dial_number: formatted, target_id: null })
      }
    }
  }

  // Handle selecting from suggestions
  const handleSelectTarget = (target: Target) => {
    setTargetNumber(target.phone_number)
    setShowSuggestions(false)
    updateConfig({ target_id: target.id, quick_dial_number: null })
    toast({
      title: 'Target selected',
      description: target.name ? `${target.name} (${target.phone_number})` : target.phone_number,
    })
  }

  // Handle from number change
  const handleFromNumberChange = (value: string) => {
    setFromNumber(value)
    if (!value || isValidE164(value)) {
      updateConfig({ from_number: value || null })
    }
  }

  async function handleAddTarget() {
    if (!organizationId || !canEdit) return

    if (!isValidE164(newTarget.phone_number)) {
      toast({
        title: 'Invalid phone number',
        description: 'Phone number must be in E.164 format (e.g., +12025551234)',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      const data = await apiPost('/api/voice/targets', {
        organization_id: organizationId,
        phone_number: newTarget.phone_number,
        name: newTarget.name || undefined
      })

      if (data.success && data.target) {
        setTargets([...targets, data.target])

        if (targets.length === 0) {
          await updateConfig({ target_id: data.target.id })
        }

        setShowAddTarget(false)
        setNewTarget({ phone_number: '', name: '' })
        toast({
          title: 'Target saved',
          description: `Added ${data.target.phone_number} to your targets.`,
        })
      } else {
        throw new Error(data.error?.message || data.error || 'Failed to add target')
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to add target',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading || configLoading) {
    return (
      <div className="p-4 bg-white rounded-lg border border-[#E5E5E5]">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <section
      aria-labelledby="target-campaign-selector"
      className="w-full p-4 bg-white rounded-lg border border-[#E5E5E5] shadow-sm"
      data-tour="target-selector"
    >
      <h3 id="target-campaign-selector" className="text-base font-semibold text-[#333333] mb-1">
        Who are you calling?
      </h3>
      <p className="text-xs text-[#666666] mb-4">
        Enter a phone number or select from recent targets
      </p>

      <div className="space-y-4">
        {/* Primary: Target Phone Number Input with Autocomplete */}
        <div className="relative">
          <label className="block text-sm font-medium text-[#333333] mb-1.5">
            Phone Number to Call <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-gray-400">+</span>
            <input
              ref={inputRef}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={targetNumber}
              onChange={(e) => handleTargetChange(e.target.value)}
              onBlur={handleTargetBlur}
              onFocus={() => setShowSuggestions(targetNumber.length > 0 && filteredTargets.length > 0)}
              onKeyDown={(e) => {
                // Prevent form submission on Enter - just blur the input instead
                if (e.key === 'Enter') {
                  e.preventDefault()
                  inputRef.current?.blur()
                }
              }}
              placeholder="(202) 555-1234 or +12025551234"
              className={`
                w-full pl-10 pr-4 py-3 text-lg font-mono rounded-lg border-2 transition-all
                focus:outline-none focus:ring-2 focus:ring-offset-1
                ${isTargetValid
                  ? 'border-green-400 focus:ring-green-300 bg-green-50'
                  : targetNumber.length > 0
                    ? 'border-amber-300 focus:ring-amber-200'
                    : 'border-gray-200 focus:ring-primary-300 focus:border-primary-400'
                }
              `}
              aria-describedby="target-hint"
              aria-expanded={showSuggestions}
              aria-autocomplete="list"
            />
            {/* Valid indicator */}
            {isTargetValid && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                ✓
              </span>
            )}
          </div>

          {/* Autocomplete suggestions */}
          {showSuggestions && filteredTargets.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
            >
              <div className="text-xs text-gray-500 px-3 py-1.5 bg-gray-50 border-b">
                Recent Targets
              </div>
              {filteredTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => handleSelectTarget(target)}
                  className="w-full px-3 py-2 text-left hover:bg-primary-50 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-mono text-gray-900">{target.phone_number}</span>
                    {target.name && (
                      <span className="ml-2 text-sm text-gray-500">{target.name}</span>
                    )}
                  </div>
                  <span className="text-xs text-primary-600 opacity-0 group-hover:opacity-100">
                    Select
                  </span>
                </button>
              ))}
            </div>
          )}

          <p id="target-hint" className="text-xs text-[#666666] mt-1">
            {targetNumber && !isTargetValid
              ? 'Include + and country code (e.g., +1 for US)'
              : 'E.164 format with country code'
            }
          </p>
        </div>

        {/* Ready indicator */}
        {isTargetValid && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm text-green-800 flex items-center gap-2">
              <span className="text-lg">✓</span>
              <span>Ready to call <span className="font-mono font-bold">{targetNumber}</span></span>
            </div>
            {fromNumber && isValidE164(fromNumber) && (
              <div className="text-xs text-green-700 mt-1 ml-6">
                Bridge call via {fromNumber}
              </div>
            )}
          </div>
        )}

        {/* Advanced Options - Collapsible */}
        <details
          className="group border border-gray-200 rounded-lg"
          open={showAdvanced}
          onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
        >
          <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800 flex items-center justify-between list-none">
            <span className="flex items-center gap-2">
              <span className="text-gray-400 group-open:rotate-90 transition-transform">▶</span>
              Advanced Options
            </span>
            {(fromNumber || config?.campaign_id) && (
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                {[fromNumber ? 'Bridge' : '', config?.campaign_id ? 'Campaign' : ''].filter(Boolean).join(' + ')}
              </span>
            )}
          </summary>

          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
            {/* Your Phone Number (for bridge calls) */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="block text-sm font-medium text-[#333333]">
                  Call me first at
                </label>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  Bridge Call
                </span>
              </div>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={fromNumber}
                onChange={(e) => handleFromNumberChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                      ; (e.target as HTMLInputElement).blur()
                  }
                }}
                placeholder="+12025551234"
                className="font-mono"
              />
              <p className="text-xs text-[#666666] mt-1.5 leading-relaxed">
                <strong>How it works:</strong> We'll call your phone first. When you answer, we connect you to the target number.
                This keeps you in control and ensures the call is recorded from your end.
              </p>
            </div>

            {/* Campaign Selector */}
            <div>
              <Select
                label="Campaign"
                value={config?.campaign_id || ''}
                onChange={(e) => {
                  if (canEdit) {
                    updateConfig({ campaign_id: e.target.value || null })
                  }
                }}
                disabled={!canEdit}
              >
                <option value="">None (single call)</option>
                {campaigns
                  .filter((c) => c.is_active)
                  .map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
              </Select>
              <p className="text-xs text-[#666666] mt-1">
                Group calls under a campaign for reporting
              </p>
            </div>

            {/* Save target button */}
            {canEdit && targetNumber && isTargetValid && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewTarget({ phone_number: targetNumber, name: '' })
                  setShowAddTarget(true)
                }}
                className="w-full"
              >
                💾 Save {targetNumber} to Targets
              </Button>
            )}
          </div>
        </details>

        {!canEdit && (
          <p className="text-xs text-[#666666] italic">
            Only Owners and Admins can modify target settings.
          </p>
        )}
      </div>

      {/* Add Target Dialog */}
      <Dialog open={showAddTarget} onOpenChange={setShowAddTarget} title="Save Target">
        <div className="space-y-4">
          <Input
            label="Phone Number"
            type="tel"
            value={newTarget.phone_number}
            onChange={(e) => setNewTarget({ ...newTarget, phone_number: e.target.value })}
            placeholder="+12025551234"
            required
          />
          <Input
            label="Name (makes it easier to find later)"
            value={newTarget.name}
            onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
            placeholder="e.g., Main Support Line"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowAddTarget(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddTarget} disabled={saving || !newTarget.phone_number}>
            {saving ? 'Saving...' : 'Save Target'}
          </Button>
        </div>
      </Dialog>
    </section>
  )
}
