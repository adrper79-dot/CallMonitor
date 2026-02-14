/**
 * QuickDisposition Integration Example
 * 
 * This example shows how to integrate the enhanced QuickDisposition component
 * with auto-advance functionality into a call cockpit or collections CRM interface.
 */

import React from 'react'
import { QuickDisposition, DispositionCode } from '@/components/voice/QuickDisposition'
import { useSession } from '@/components/AuthProvider'
import { apiPost } from '@/lib/apiClient'
import { useToast } from '@/components/ui/use-toast'

interface CallCockpitProps {
  callId: string
  campaignId?: string
}

export function CallCockpitExample({ callId, campaignId }: CallCockpitProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [callEnded, setCallEnded] = React.useState(false)
  const [currentAccount, setCurrentAccount] = React.useState<any>(null)

  /**
   * Handle disposition submission
   * Saves the disposition to the database
   */
  const handleDisposition = async (code: DispositionCode, notes?: string) => {
    try {
      await apiPost(`/api/calls/${callId}/disposition`, {
        disposition_code: code,
        notes,
      })

      toast({
        title: 'Disposition saved',
        description: `Call marked as: ${code}`,
        variant: 'default',
      })

      setCallEnded(true)
    } catch (error: any) {
      toast({
        title: 'Failed to save disposition',
        description: error?.message || 'Please try again',
        variant: 'destructive',
      })
    }
  }

  /**
   * Handle auto-advance completion
   * Called when auto-dial successfully triggers
   * Update UI to show next account being called
   */
  const handleAutoAdvanceComplete = (nextAccount: any) => {
    setCurrentAccount(nextAccount)
    setCallEnded(false)

    // Update your call UI here
    console.log('Now calling:', nextAccount)

    // Example: Update URL to reflect new account
    if (nextAccount.account_id) {
      window.history.pushState({}, '', `/work/call?account=${nextAccount.account_id}`)
    }
  }

  /**
   * Legacy manual dial next handler (if not using auto-advance)
   * This is optional - QuickDisposition will use auto-advance by default
   */
  const handleManualDialNext = () => {
    // Your manual dial logic here
    console.log('Manual dial triggered')
  }

  return (
    <div className="space-y-4">
      {/* Your call UI components here */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold">Call In Progress</h2>
        {currentAccount && (
          <p className="text-sm text-gray-600 mt-1">
            {currentAccount.name} - ${currentAccount.balance}
          </p>
        )}
      </div>

      {/* QuickDisposition Component */}
      {callEnded && (
        <QuickDisposition
          callId={callId}
          onDisposition={handleDisposition}
          onDialNext={handleManualDialNext} // Optional: for backwards compatibility
          showDialNext={true}
          disabled={false}
          campaignId={campaignId} // ✅ REQUIRED for auto-advance
          onAutoAdvanceComplete={handleAutoAdvanceComplete} // ✅ REQUIRED for auto-advance
          // Legacy props removed (no longer needed):
          // nextAccountId, nextAccountPhone, onCheckCompliance
        />
      )}
    </div>
  )
}

/**
 * Example 2: Collections CRM Integration
 * Shows how to use QuickDisposition in a collections workflow
 */
export function CollectionsCRMExample() {
  const [activeCall, setActiveCall] = React.useState<any>(null)
  const [activeCampaign, setActiveCampaign] = React.useState<string | null>(null)

  const handleDisposition = async (code: DispositionCode, notes?: string) => {
    if (!activeCall) return

    // Save disposition to collections system
    await apiPost('/api/collections/disposition', {
      call_id: activeCall.id,
      account_id: activeCall.account_id,
      disposition_code: code,
      notes,
    })

    // Update account status
    await apiPost(`/api/collections/accounts/${activeCall.account_id}/status`, {
      status: code === 'promise_to_pay' ? 'promise_made' : 'contact_attempted',
    })
  }

  const handleAutoAdvanceComplete = (nextAccount: any) => {
    // Update active call state
    setActiveCall({
      id: null, // Will be set when call connects
      account_id: nextAccount.account_id,
      phone: nextAccount.phone,
      name: nextAccount.name,
      balance: nextAccount.balance,
    })

    // Update UI to show "Dialing..." state
    console.log('Auto-dialing:', nextAccount)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Account Card */}
      {activeCall && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-bold">{activeCall.name}</h2>
          <p className="text-gray-600">Balance: ${activeCall.balance}</p>
          <p className="text-gray-600">Phone: {activeCall.phone}</p>
        </div>
      )}

      {/* Call Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <QuickDisposition
          callId={activeCall?.id || ''}
          onDisposition={handleDisposition}
          campaignId={activeCampaign || undefined}
          onAutoAdvanceComplete={handleAutoAdvanceComplete}
          showDialNext={!!activeCampaign} // Only show if in campaign mode
        />
      </div>
    </div>
  )
}

/**
 * Example 3: Dialer Queue Status Display
 * Shows real-time queue status with auto-advance indicator
 */
export function DialerQueueStatus({ campaignId }: { campaignId: string }) {
  const [queueStats, setQueueStats] = React.useState<any>(null)
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = React.useState(false)

  React.useEffect(() => {
    // Check localStorage for auto-advance setting
    if (typeof window !== 'undefined') {
      const enabled = localStorage.getItem('wb-auto-advance-enabled') === 'true'
      setAutoAdvanceEnabled(enabled)
    }

    // Fetch queue stats
    const fetchStats = async () => {
      const response = await apiGet(`/api/dialer/stats/${campaignId}`)
      setQueueStats(response.stats)
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000) // Refresh every 10s

    return () => clearInterval(interval)
  }, [campaignId])

  if (!queueStats) return <div>Loading...</div>

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Queue Status</h3>
        {autoAdvanceEnabled && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Auto-Advance ON
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold">{queueStats.pending || 0}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="text-2xl font-bold text-blue-600">{queueStats.in_progress || 0}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">{queueStats.completed || 0}</p>
        </div>
      </div>

      {autoAdvanceEnabled && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-xs text-blue-800">
            🚀 Auto-advance is active. After each disposition, the next account will automatically dial in 2 seconds.
            Press ESC to cancel.
          </p>
        </div>
      )}
    </div>
  )
}

export default CallCockpitExample
