'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiPost } from '@/lib/apiClient'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (booking: any) => void
  defaultPhone?: string
}

/**
 * BookingModal - Professional Design System v3.0
 * 
 * Clean, accessible modal dialog.
 * Focus trap, escape to close, ARIA compliant.
 */
export function BookingModal({ isOpen, onClose, onSuccess, defaultPhone }: BookingModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const firstFocusableRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attendeeName, setAttendeeName] = useState('')
  const [attendeeEmail, setAttendeeEmail] = useState('')
  const [attendeePhone, setAttendeePhone] = useState(defaultPhone || '')
  const [fromNumber, setFromNumber] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState(30)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      setTimeout(() => firstFocusableRef.current?.focus(), 50)
    }

    return () => {
      if (previousFocusRef.current && !isOpen) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
    
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }
  }, [onClose])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setAttendeeName('')
    setAttendeeEmail('')
    setAttendeePhone(defaultPhone || '')
    setFromNumber('')
    setStartDate('')
    setStartTime('')
    setDuration(30)
    setNotes('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const startDateTime = new Date(`${startDate}T${startTime}`)
      if (isNaN(startDateTime.getTime())) {
        throw new Error('Invalid date/time')
      }

      const endDateTime = new Date(startDateTime.getTime() + duration * 60000)

      const data = await apiPost('/api/bookings', {
        title: title || `Call with ${attendeeName || attendeePhone}`,
        description,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        duration_minutes: duration,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail,
        attendee_phone: attendeePhone,
        from_number: fromNumber || undefined,
        notes
      })

      if (!data.success) {
        throw new Error(data.error?.message || data.error || 'Failed to create booking')
      }

      resetForm()
      onSuccess?.(data.booking)
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 id="booking-modal-title" className="text-lg font-semibold text-gray-900">
              Schedule Call
            </h2>
            <button 
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="mb-4 p-3 bg-error-light text-error text-sm rounded-md">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              ref={firstFocusableRef}
              label="Title"
              placeholder="e.g., Follow-up Call"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <Input
              label="Contact Name"
              placeholder="John Doe"
              value={attendeeName}
              onChange={(e) => setAttendeeName(e.target.value)}
            />

            <Input
              label="Your Phone (optional)"
              type="tel"
              placeholder="+1234567890"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              hint="For bridge calls - connects you first"
            />

            <Input
              label="Contact Phone"
              type="tel"
              placeholder="+1234567890"
              value={attendeePhone}
              onChange={(e) => setAttendeePhone(e.target.value)}
              required
            />

            <Input
              label="Email"
              type="email"
              placeholder="john@example.com"
              value={attendeeEmail}
              onChange={(e) => setAttendeeEmail(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={today}
                  required
                  className="w-full h-10 px-3 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full h-10 px-3 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                className="w-full h-10 px-3 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea
                placeholder="Internal notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full p-3 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || !attendeePhone || !startDate || !startTime}
                className="flex-1"
                loading={loading}
              >
                Schedule
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default BookingModal
