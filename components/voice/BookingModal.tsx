'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (booking: any) => void
  defaultPhone?: string
}

/**
 * BookingModal - Schedule Call Dialog
 * 
 * Accessibility compliant:
 * - ARIA role="dialog", aria-modal="true"
 * - Focus trap within modal
 * - Escape key to close
 * - Focus restoration on close
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

  // Store previous focus and set up keyboard handlers
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      // Focus first input after modal opens
      setTimeout(() => firstFocusableRef.current?.focus(), 50)
    }

    return () => {
      // Restore focus when modal closes
      if (previousFocusRef.current && !isOpen) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen])

  // Handle keyboard events (Escape to close, Tab trapping)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
    
    // Focus trap
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

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        aria-describedby="booking-modal-description"
        className="relative bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 
              id="booking-modal-title" 
              className="text-xl font-semibold text-white flex items-center gap-2"
            >
              📅 Schedule Call
            </h2>
            <button 
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="text-slate-400 hover:text-white transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              ✕
            </button>
          </div>

          {/* Description for screen readers */}
          <p id="booking-modal-description" className="sr-only">
            Schedule a new call by filling out the form below
          </p>

          {/* Error */}
          {error && (
            <div 
              role="alert" 
              aria-live="assertive"
              className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm"
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="booking-title" className="block text-sm text-slate-300 mb-1">
                Call Title
              </label>
              <input
                ref={firstFocusableRef}
                id="booking-title"
                placeholder="e.g., Follow-up Consultation"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Attendee Name */}
            <div>
              <label htmlFor="booking-attendee-name" className="block text-sm text-slate-300 mb-1">
                Contact Name
              </label>
              <Input
                id="booking-attendee-name"
                placeholder="John Doe"
                value={attendeeName}
                onChange={(e) => setAttendeeName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {/* Your Number (From) */}
            <div>
              <label htmlFor="booking-from-number" className="block text-sm text-slate-300 mb-1">
                Your Phone Number (optional)
              </label>
              <Input
                id="booking-from-number"
                type="tel"
                placeholder="+1234567890"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                aria-describedby="from-number-hint"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p id="from-number-hint" className="text-xs text-slate-500 mt-1">
                For bridge calls - connects you first, then the contact
              </p>
            </div>

            {/* Contact Phone Number (Required) */}
            <div>
              <label htmlFor="booking-attendee-phone" className="block text-sm text-slate-300 mb-1">
                Contact Phone Number <span className="text-red-400" aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <Input
                id="booking-attendee-phone"
                type="tel"
                placeholder="+1234567890"
                value={attendeePhone}
                onChange={(e) => setAttendeePhone(e.target.value)}
                required
                aria-required="true"
                aria-describedby="phone-hint"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p id="phone-hint" className="text-xs text-slate-500 mt-1">
                E.164 format (e.g., +1234567890)
              </p>
            </div>

            {/* Attendee Email */}
            <div>
              <label htmlFor="booking-attendee-email" className="block text-sm text-slate-300 mb-1">
                Email (for confirmation)
              </label>
              <Input
                id="booking-attendee-email"
                type="email"
                placeholder="john@example.com"
                value={attendeeEmail}
                onChange={(e) => setAttendeeEmail(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="booking-date" className="block text-sm text-slate-300 mb-1">
                  Date <span className="text-red-400" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <Input
                  id="booking-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={today}
                  required
                  aria-required="true"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <label htmlFor="booking-time" className="block text-sm text-slate-300 mb-1">
                  Time <span className="text-red-400" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <Input
                  id="booking-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  aria-required="true"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label htmlFor="booking-duration" className="block text-sm text-slate-300 mb-1">
                Duration
              </label>
              <select
                id="booking-duration"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="booking-description" className="block text-sm text-slate-300 mb-1">
                Description
              </label>
              <textarea
                id="booking-description"
                placeholder="Brief description of the call purpose..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="booking-notes" className="block text-sm text-slate-300 mb-1">
                Internal Notes
              </label>
              <textarea
                id="booking-notes"
                placeholder="Private notes (not shared with attendee)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                disabled={loading || !attendeePhone || !startDate || !startTime}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                aria-busy={loading}
              >
                {loading ? 'Scheduling...' : '📅 Schedule Call'}
              </Button>
            </div>
          </form>

          {/* Info */}
          <p className="text-xs text-slate-500 text-center mt-4">
            The call will be automatically placed at the scheduled time
          </p>
        </div>
      </div>
    </div>
  )
}

export default BookingModal
