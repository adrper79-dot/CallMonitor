"use client"

/**
 * Call Disposition Component
 * 
 * Post-call outcome tagging for pipeline reconciliation
 * Per MASTER_ARCHITECTURE: Disposition is a call modulation
 * 
 * Dispositions:
 * - Sale
 * - No Answer
 * - Voicemail
 * - Not Interested
 * - Follow-up
 * - Wrong Number
 * - Callback Scheduled
 * - Other
 */

import React, { useState, useEffect } from 'react'
import { CallDisposition as DispositionType } from '@/types/tier1-features'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiPut } from '@/lib/api-client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

interface CallDispositionProps {
  callId: string
  initialDisposition?: DispositionType | null
  initialNotes?: string | null
  onUpdate?: (disposition: DispositionType, notes?: string) => void
  readOnly?: boolean
}

const DISPOSITIONS: { value: DispositionType; label: string; icon: string; color: string }[] = [
  { value: 'sale', label: 'Sale', icon: '●', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'no_answer', label: 'No Answer', icon: '○', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  { value: 'voicemail', label: 'Voicemail', icon: '▶', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'not_interested', label: 'Not Interested', icon: '–', color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'follow_up', label: 'Follow-up', icon: '↻', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'wrong_number', label: 'Wrong Number', icon: '✕', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  // Note: callback_scheduled removed - not in DB CHECK constraint, use follow_up instead
  { value: 'other', label: 'Other', icon: '◇', color: 'bg-slate-100 text-slate-800 border-slate-200' }
]

export default function CallDisposition({
  callId,
  initialDisposition,
  initialNotes,
  onUpdate,
  readOnly = false
}: CallDispositionProps) {
  const [disposition, setDisposition] = useState<DispositionType | null>(initialDisposition || null)
  const [notes, setNotes] = useState(initialNotes || '')
  const [saving, setSaving] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const { toast } = useToast()

  // Update state when props change
  useEffect(() => {
    setDisposition(initialDisposition || null)
    setNotes(initialNotes || '')
  }, [initialDisposition, initialNotes])

  const handleDispositionSelect = async (newDisposition: DispositionType) => {
    if (readOnly) return
    
    // Toggle notes field for 'other' disposition
    if (newDisposition === 'other' || newDisposition === 'follow_up') {
      setShowNotes(true)
    }
    
    // If same disposition, just toggle
    if (disposition === newDisposition) {
      setShowNotes(!showNotes)
      return
    }
    
    setDisposition(newDisposition)
    
    // Auto-save unless it's 'other' (needs notes)
    if (newDisposition !== 'other') {
      await saveDisposition(newDisposition, notes)
    }
  }

  const saveDisposition = async (disp: DispositionType, noteText?: string) => {
    setSaving(true)
    
    try {
      await apiPut(`/api/calls/${callId}/disposition`, {
        disposition: disp,
        disposition_notes: noteText || null
      })
      
      toast({
        title: 'Disposition saved',
        description: `Call marked as "${DISPOSITIONS.find(d => d.value === disp)?.label}"`,
      })
      
      onUpdate?.(disp, noteText)
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleNotesSubmit = async () => {
    if (!disposition) return
    await saveDisposition(disposition, notes)
    setShowNotes(false)
  }

  const selectedDisp = DISPOSITIONS.find(d => d.value === disposition)

  return (
    <div className="bg-white rounded-lg border border-[#E5E5E5] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#333333]">🏷️ Call Disposition</h3>
        {disposition && selectedDisp && (
          <Badge className={`${selectedDisp.color} border`}>
            {selectedDisp.icon} {selectedDisp.label}
          </Badge>
        )}
      </div>

      {/* Disposition Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {DISPOSITIONS.map(disp => (
          <button
            key={disp.value}
            onClick={() => handleDispositionSelect(disp.value)}
            disabled={readOnly || saving}
            className={`
              flex items-center justify-center space-x-1 p-2 rounded-md text-xs font-medium
              transition-all duration-150 border
              ${disposition === disp.value 
                ? `${disp.color} ring-2 ring-offset-1 ring-[#C4001A]` 
                : 'bg-[#FAFAFA] text-[#666666] border-[#E5E5E5] hover:bg-[#F5F5F5] hover:border-[#D0D0D0]'
              }
              ${readOnly || saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span>{disp.icon}</span>
            <span>{disp.label}</span>
          </button>
        ))}
      </div>

      {/* Notes Section */}
      {showNotes && !readOnly && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value.slice(0, 500))}
            placeholder="Add notes (optional, max 500 chars)..."
            className="text-sm resize-none"
            rows={2}
            disabled={saving}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#999999]">{notes.length}/500</span>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNotes(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleNotesSubmit}
                disabled={saving || !disposition}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Read-only notes display */}
      {readOnly && initialNotes && (
        <div className="mt-2 p-2 bg-[#FAFAFA] rounded text-xs text-[#666666]">
          {initialNotes}
        </div>
      )}
    </div>
  )
}
