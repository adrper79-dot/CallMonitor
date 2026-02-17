'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from '@/components/AuthProvider'
import VoiceOperationsClient from '@/components/voice/VoiceOperationsClient'
import { DialerPanel } from '@/components/voice/DialerPanel'
import ExecutionControls from '@/components/voice/ExecutionControls'
import { logger } from '@/lib/logger'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import { TroubleshootChatToggle } from '@/components/admin/TroubleshootChatToggle'
import { FeatureFlagRedirect } from '@/components/layout/FeatureFlagRedirect'
import { AlertTriangle, Phone, Plus, Users, Zap } from 'lucide-react'
import { apiGet } from '@/lib/apiClient'
import { NativeSelect as Select } from '@/components/ui/native-select'
import { Button } from '@/components/ui/button'

// Interfaces (derived from ARCH_DOCS/Schema.txt)
export interface Call {
  id: string
  organization_id: string | null
  system_id: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  created_by: string | null
  call_sid: string | null
}

export interface Campaign {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

export default function VoiceOperationsPage() {
  const { data: session, status } = useSession()
  const [calls, setCalls] = useState<Call[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Fetch calls, campaigns, and organization data from API
      Promise.all([
        apiGet<{ calls?: Call[] }>('/api/calls'),
        apiGet<{ campaigns?: Campaign[] }>('/api/campaigns'),
        apiGet<{ organization?: { id: string; name: string } }>('/api/organizations/current'),
      ])
        .then(([callsData, campaignsData, orgData]) => {
          setCalls(callsData.calls || [])
          setCampaigns(campaignsData.campaigns || [])
          setOrganizationId(orgData.organization?.id || null)
          setOrganizationName(orgData.organization?.name || null)
          
          // Auto-select first active campaign if available
          const activeCampaign = campaignsData.campaigns?.find((c) => c.is_active)
          if (activeCampaign) {
            setSelectedCampaignId(activeCampaign.id)
          } else if (campaignsData.campaigns && campaignsData.campaigns.length > 0) {
            setSelectedCampaignId(campaignsData.campaigns[0].id)
          }
          
          setLoading(false)
        })
        .catch((err) => {
          logger.error('Failed to fetch voice operations data', err)
          setError(err.message || 'Failed to load data')
          setLoading(false)
        })
    } else if (status === 'unauthenticated') {
      setLoading(false)
    }
  }, [session, status])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || !session?.user) {
    return (
      <ProtectedGate
        title="Calls"
        description="Please sign in to access your call dashboard and manage calls."
        redirectUrl="/voice-operations"
      />
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-900">
        <div className="text-center max-w-sm px-4">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Unable to load calls</h2>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <FeatureFlagRedirect to="/work/call" />
      <div className="min-h-screen bg-background p-4 space-y-4">
        {/* Mode Switcher */}
        <div className="max-w-7xl mx-auto flex justify-end">
          <a href="/work/dialer" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline flex items-center gap-1">
            <Zap className="w-4 h-4" />
            Switch to Power Dialer Mode
          </a>
        </div>

        {/* Quick Dial Section */}
        {organizationId && (
          <div className="max-w-7xl mx-auto">
            <div className="p-4 rounded-xl border bg-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick Dial</h3>
                <span className="text-xs text-gray-500">Make a single call</span>
              </div>
              <ExecutionControls 
                organizationId={organizationId} 
                onCallPlaced={(callId) => {
                  // Scroll to VoiceOperationsClient to show active call panel
                  const element = document.getElementById('voice-operations-client')
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' })
                  }
                }} 
              />
            </div>
          </div>
        )}

        {/* Dialer Panel Section */}
        {organizationId && (
          <div className="max-w-7xl mx-auto space-y-4">
            {campaigns.length > 0 ? (
              <>
                {/* Campaign Selector */}
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card">
                  <label htmlFor="campaign-select" className="text-sm font-medium whitespace-nowrap">
                    Campaign:
                  </label>
                  <Select
                    id="campaign-select"
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="flex-1 max-w-md"
                  >
                    <option value="">Select a campaign...</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name} {campaign.is_active ? '(Active)' : '(Inactive)'}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Dialer Panel - Render when campaign is selected */}
                {selectedCampaignId && (
                  <div className="max-w-2xl mx-auto">
                    <DialerPanel
                      campaignId={selectedCampaignId}
                      campaignName={
                        campaigns.find((c) => c.id === selectedCampaignId)?.name || 'Unknown'
                      }
                      organizationId={organizationId}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="p-6 rounded-xl border bg-card text-center">
                <Phone className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Set Up Your Dialer</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Create a campaign first, then the predictive dialer will appear here.
                  Campaigns let you organize your call lists and track results.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <a href="/campaigns">
                    <Button size="sm" className="gap-1.5">
                      <Plus className="w-4 h-4" />
                      Create Campaign
                    </Button>
                  </a>
                  <a href="/accounts">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Users className="w-4 h-4" />
                      View Accounts
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Voice Operations Client */}
        <div id="voice-operations-client">
          <VoiceOperationsClient
            initialCalls={calls}
            organizationId={organizationId}
            organizationName={organizationName || undefined}
          />
        </div>
      </div>
      <TroubleshootChatToggle />
    </>
  )
}
