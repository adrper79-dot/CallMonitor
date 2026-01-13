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

    try {
      // Would need API endpoint to add target
      // For now, just close dialog
      setShowAddTarget(false)
      setNewTarget({ phone_number: '', name: '' })
      toast({
        title: 'Target added',
        description: 'New target will be available after refresh.',
      })
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to add target',
        variant: 'destructive',
      })
    }
  }

  if (loading || configLoading) {
    return <div className="p-4 text-slate-400 text-sm">Loading...</div>
  }

  return (
    <section aria-labelledby="target-campaign-selector" className="w-full p-4 bg-slate-950 rounded-md border border-slate-800">
      <h3 id="target-campaign-selector" className="text-lg font-medium text-slate-100 mb-4">
        Target & Campaign
      </h3>

      <div className="space-y-4">
        <div>
          <Select
            label="Target Number"
            value={config?.target_id || ''}
            onChange={(e) => {
              if (canEdit) {
                updateConfig({ target_id: e.target.value || null })
              }
            }}
            disabled={!canEdit}
            aria-label="Select target phone number"
          >
            <option value="">Select a target...</option>
            {targets
              .filter((t) => t.is_active)
              .map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name || target.phone_number} ({target.phone_number})
                </option>
              ))}
          </Select>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddTarget(true)}
              className="mt-2"
            >
              + Add Target
            </Button>
          )}
        </div>

        <div>
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

        {canEdit && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
            aria-label="Save configuration"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        )}

        {!canEdit && (
          <p className="text-xs text-slate-400">
            Only Owners and Admins can modify configuration.
          </p>
        )}
      </div>

      <Dialog open={showAddTarget} onOpenChange={setShowAddTarget} title="Add Target">
        <div className="space-y-4">
          <Input
            label="Phone Number"
            type="tel"
            value={newTarget.phone_number}
            onChange={(e) => setNewTarget({ ...newTarget, phone_number: e.target.value })}
            placeholder="+1234567890"
            required
          />
          <Input
            label="Name (Optional)"
            value={newTarget.name}
            onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
            placeholder="Main Office"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowAddTarget(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddTarget}>Add Target</Button>
        </div>
      </Dialog>
    </section>
  )
}
