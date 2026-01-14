"use client"

import React, { useState, useEffect } from 'react'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { useRBAC } from '@/hooks/useRBAC'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

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

export default function TargetCampaignSelector({ organizationId }: TargetCampaignSelectorProps) {
  const { config, loading: configLoading, updateConfig } = useVoiceConfig(organizationId)
  const { role } = useRBAC(organizationId)
  const { toast } = useToast()
  
  const [targets, setTargets] = useState<Target[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddTarget, setShowAddTarget] = useState(false)
  const [newTarget, setNewTarget] = useState({ phone_number: '', name: '' })
  
  // Quick dial - enter a number directly without saving as target
  const [quickDialNumber, setQuickDialNumber] = useState('')
  const [useQuickDial, setUseQuickDial] = useState(false)

  const canEdit = role === 'owner' || role === 'admin'

  useEffect(() => {
    if (!organizationId) return

    async function fetchData() {
      if (!organizationId) return // Guard for TypeScript
      try {
        setLoading(true)
        const [targetsRes, campaignsRes] = await Promise.all([
          fetch(`/api/voice/targets?orgId=${encodeURIComponent(organizationId)}`),
          fetch(`/api/campaigns?orgId=${encodeURIComponent(organizationId)}`),
        ])

        if (targetsRes.ok) {
          const targetsData = await targetsRes.json()
          setTargets(targetsData.targets || [])
        }

        if (campaignsRes.ok) {
          const campaignsData = await campaignsRes.json()
          setCampaigns(campaignsData.campaigns || [])
        }
      } catch (err) {
        console.error('Failed to fetch targets/campaigns', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId])

  async function handleSave() {
    if (!organizationId || !canEdit) return

    try {
      setSaving(true)
      await updateConfig({
        target_id: config?.target_id,
        campaign_id: config?.campaign_id,
      })
      toast({
        title: 'Configuration saved',
        description: 'Target and campaign selection saved successfully.',
      })
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to save configuration',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleAddTarget() {
    if (!organizationId || !canEdit) return
    
    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/
    if (!e164Regex.test(newTarget.phone_number)) {
      toast({
        title: 'Invalid phone number',
        description: 'Phone number must be in E.164 format (e.g., +12025551234)',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/voice/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organization_id: organizationId,
          phone_number: newTarget.phone_number,
          name: newTarget.name || undefined
        })
      })
      
      const data = await res.json()
      
      if (data.success && data.target) {
        // Add to local state
        setTargets([...targets, data.target])
        
        // Auto-select if it's the only target
        if (targets.length === 0) {
          await updateConfig({ target_id: data.target.id })
        }
        
        setShowAddTarget(false)
        setNewTarget({ phone_number: '', name: '' })
        toast({
          title: 'Target added',
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
    return <div className="p-4 text-slate-400 text-sm">Loading...</div>
  }

  // Handle quick dial number change and sync to config
  const handleQuickDialChange = async (number: string) => {
    setQuickDialNumber(number)
    if (number && canEdit) {
      // Store the quick dial number in config for the call
      await updateConfig({ quick_dial_number: number, target_id: null })
    }
  }
  
  // Toggle between saved targets and quick dial
  const handleModeChange = async (useQuick: boolean) => {
    setUseQuickDial(useQuick)
    if (!useQuick) {
      setQuickDialNumber('')
      await updateConfig({ quick_dial_number: null })
    } else {
      await updateConfig({ target_id: null })
    }
  }

  return (
    <section aria-labelledby="target-campaign-selector" className="w-full p-4 bg-white rounded-lg border border-[#E5E5E5] shadow-sm">
      <h3 id="target-campaign-selector" className="text-base font-semibold text-[#333333] mb-2">
        📞 Target Number
      </h3>
      <p className="text-xs text-[#666666] mb-4">
        Enter a phone number to call or select from saved targets.
      </p>

      <div className="space-y-4">
        {/* Mode Selector Tabs */}
        <div className="flex border-b border-[#E5E5E5]">
          <button
            type="button"
            onClick={() => handleModeChange(true)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              useQuickDial
                ? 'border-[#C4001A] text-[#C4001A]'
                : 'border-transparent text-[#666666] hover:text-[#333333]'
            }`}
          >
            Quick Dial
          </button>
          <button
            type="button"
            onClick={() => handleModeChange(false)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              !useQuickDial
                ? 'border-[#C4001A] text-[#C4001A]'
                : 'border-transparent text-[#666666] hover:text-[#333333]'
            }`}
          >
            Saved Targets ({targets.filter(t => t.is_active).length})
          </button>
        </div>

        {/* Quick Dial Mode */}
        {useQuickDial && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-1">
                Phone Number to Call
              </label>
              <Input
                type="tel"
                value={quickDialNumber}
                onChange={(e) => handleQuickDialChange(e.target.value)}
                placeholder="+12025551234"
                className="text-lg font-mono"
                aria-describedby="quick-dial-help"
              />
              <p id="quick-dial-help" className="text-xs text-[#666666] mt-1">
                Enter number in E.164 format (e.g., +12025551234)
              </p>
            </div>
            
            {quickDialNumber && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-800">
                  ✓ Ready to call: <span className="font-mono font-bold">{quickDialNumber}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Saved Targets Mode */}
        {!useQuickDial && (
          <div className="space-y-3">
            <div>
              <Select
                label="Select Target Number"
                value={config?.target_id || ''}
                onChange={(e) => {
                  if (canEdit) {
                    updateConfig({ target_id: e.target.value || null, quick_dial_number: null })
                  }
                }}
                disabled={!canEdit}
                aria-label="Select target phone number"
              >
                <option value="">-- Select a target --</option>
                {targets
                  .filter((t) => t.is_active)
                  .map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name ? `${target.name} (${target.phone_number})` : target.phone_number}
                    </option>
                  ))}
              </Select>
            </div>
            
            {/* Currently selected target display */}
            {config?.target_id && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-800">
                  ✓ Selected: <span className="font-mono font-bold">
                    {targets.find(t => t.id === config.target_id)?.phone_number || config.target_id}
                  </span>
                </div>
              </div>
            )}
            
            {targets.filter(t => t.is_active).length === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                No saved targets yet. Add a target or use Quick Dial mode.
              </div>
            )}
            
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddTarget(true)}
                className="w-full"
              >
                + Add New Target Number
              </Button>
            )}
          </div>
        )}

        {/* Campaign Selector */}
        <div className="pt-3 border-t border-[#E5E5E5]">
          <Select
            label="Campaign (Optional)"
            value={config?.campaign_id || ''}
            onChange={(e) => {
              if (canEdit) {
                updateConfig({ campaign_id: e.target.value || null })
              }
            }}
            disabled={!canEdit}
            aria-label="Select campaign"
          >
            <option value="">None</option>
            {campaigns
              .filter((c) => c.is_active)
              .map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
          </Select>
        </div>

        {!canEdit && (
          <p className="text-xs text-[#666666] italic">
            Only Owners and Admins can modify target settings.
          </p>
        )}
      </div>

      {/* Add Target Dialog */}
      <Dialog open={showAddTarget} onOpenChange={setShowAddTarget} title="Add Target Number">
        <div className="space-y-4">
          <Input
            label="Phone Number *"
            type="tel"
            value={newTarget.phone_number}
            onChange={(e) => setNewTarget({ ...newTarget, phone_number: e.target.value })}
            placeholder="+12025551234"
            required
          />
          <p className="text-xs text-[#666666] -mt-2">
            E.164 format required (e.g., +12025551234)
          </p>
          <Input
            label="Name (Optional)"
            value={newTarget.name}
            onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
            placeholder="Customer Support Line"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowAddTarget(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddTarget} disabled={saving || !newTarget.phone_number}>
            {saving ? 'Adding...' : 'Add Target'}
          </Button>
        </div>
      </Dialog>
    </section>
  )
}
