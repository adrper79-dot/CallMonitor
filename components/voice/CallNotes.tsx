"use client"

/**
 * Call Notes Component
 * 
 * Structured notes (checkboxes + short text) for calls
 * Per MASTER_ARCHITECTURE: Notes are structured, not freeform
 * 
 * Tags:
 * - Objection Raised
 * - Competitor Mentioned
 * - Pricing Discussed
 * - Escalation Required
 * - Decision Maker Reached
 * - Follow-up Needed
 * - Compliance Issue
 * - Quality Concern
 * - Positive Feedback
 * - Technical Issue
 */

import React, { useState, useEffect } from 'react'
import { CallNote, CallNoteTag, CALL_NOTE_TAGS, CALL_NOTE_TAG_LABELS } from '@/types/tier1-features'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ClientDate } from '@/components/ui/ClientDate'
import { logger } from '@/lib/logger'

interface CallNotesProps {
  callId: string
  organizationId: string
  readOnly?: boolean
}

// Tag colors
const TAG_COLORS: Record<CallNoteTag, string> = {
  objection_raised: 'bg-red-100 text-red-800',
  competitor_mentioned: 'bg-orange-100 text-orange-800',
  pricing_discussed: 'bg-yellow-100 text-yellow-800',
  escalation_required: 'bg-purple-100 text-purple-800',
  decision_maker_reached: 'bg-green-100 text-green-800',
  follow_up_needed: 'bg-blue-100 text-blue-800',
  compliance_issue: 'bg-pink-100 text-pink-800',
  quality_concern: 'bg-amber-100 text-amber-800',
  positive_feedback: 'bg-emerald-100 text-emerald-800',
  technical_issue: 'bg-slate-100 text-slate-800'
}

export default function CallNotes({ callId, organizationId, readOnly = false }: CallNotesProps) {
  const [notes, setNotes] = useState<CallNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedTags, setSelectedTags] = useState<CallNoteTag[]>([])
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Fetch notes
  useEffect(() => {
    async function fetchNotes() {
      if (!callId) return
      
      setLoading(true)
      try {
        const res = await fetch(`/api/calls/${callId}/notes`, {
          credentials: 'include'
        })
        
        if (res.ok) {
          const data = await res.json()
          setNotes(data.notes || [])
        }
      } catch (err) {
        logger.error('CallNotes: failed to fetch notes', err, {
          callId,
          organizationId
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchNotes()
  }, [callId])

  const toggleTag = (tag: CallNoteTag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleAddNote = async () => {
    if (selectedTags.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one tag',
        variant: 'destructive'
      })
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch(`/api/calls/${callId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tags: selectedTags,
          note: noteText || null
        })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error?.message || 'Failed to add note')
      }
      
      const data = await res.json()
      setNotes(prev => [data.note, ...prev])
      
      // Reset form
      setSelectedTags([])
      setNoteText('')
      setShowAddForm(false)
      
      toast({
        title: 'Note added',
        description: 'Your note has been saved'
      })
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-[#E5E5E5] p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E5E5]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#333333]">📌 Call Notes</h3>
        {!readOnly && !showAddForm && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(true)}
          >
            + Add Note
          </Button>
        )}
      </div>

      {/* Add Note Form */}
      {showAddForm && !readOnly && (
        <div className="p-4 bg-[#FAFAFA] border-b border-[#E5E5E5]">
          <p className="text-xs text-[#666666] mb-3">Select applicable tags:</p>
          
          {/* Tags Grid */}
          <div className="flex flex-wrap gap-2 mb-3">
            {CALL_NOTE_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                disabled={saving}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${selectedTags.includes(tag)
                    ? `${TAG_COLORS[tag]} ring-2 ring-offset-1 ring-[#C4001A]`
                    : 'bg-white text-[#666666] border border-[#E5E5E5] hover:bg-[#F5F5F5]'
                  }
                `}
              >
                {CALL_NOTE_TAG_LABELS[tag]}
              </button>
            ))}
          </div>

          {/* Note Text */}
          <Textarea
            value={noteText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteText(e.target.value.slice(0, 500))}
            placeholder="Add optional note text..."
            className="text-sm resize-none mb-2"
            rows={2}
            disabled={saving}
          />
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#999999]">{noteText.length}/500</span>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  setSelectedTags([])
                  setNoteText('')
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={saving || selectedTags.length === 0}
              >
                {saving ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div className="divide-y divide-[#E5E5E5]">
        {notes.length === 0 ? (
          <div className="p-4 text-center text-sm text-[#666666]">
            No notes yet
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="p-4">
              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {note.tags.map(tag => (
                  <Badge 
                    key={tag} 
                    className={`${TAG_COLORS[tag as CallNoteTag]} text-xs`}
                  >
                    {CALL_NOTE_TAG_LABELS[tag as CallNoteTag]}
                  </Badge>
                ))}
              </div>
              
              {/* Note text */}
              {note.note && (
                <p className="text-sm text-[#333333] mb-2">{note.note}</p>
              )}
              
              {/* Metadata */}
              <div className="flex items-center text-xs text-[#999999]">
                <ClientDate date={note.created_at} format="short" />
                {(note as any).users?.email && (
                  <span className="ml-2">by {(note as any).users.email}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
