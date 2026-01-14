'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Booking {
  id: string
  title: string
  start_time: string
  end_time: string
  attendee_name?: string
  attendee_phone: string
  status: string
  calls?: {
    id: string
    status: string
    started_at?: string
    ended_at?: string
  }
}

interface BookingsListProps {
  onBookingClick?: (booking: Booking) => void
  onNewBooking?: () => void
  limit?: number
}

export function BookingsList({ onBookingClick, onNewBooking, limit = 5 }: BookingsListProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/bookings?limit=${limit}&status=pending`)
      const data = await response.json()
      
      if (data.success) {
        setBookings(data.bookings || [])
      } else {
        setError(data.error || 'Failed to load bookings')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookings()
  }, [limit])

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500'
      case 'confirmed': return 'bg-green-500/20 text-green-400 border-green-500'
      case 'calling': return 'bg-blue-500/20 text-blue-400 border-blue-500'
      case 'completed': return 'bg-slate-500/20 text-slate-400 border-slate-500'
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500'
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'confirmed': return '✅'
      case 'calling': return '📞'
      case 'completed': return '✓'
      case 'cancelled': return '✕'
      case 'failed': return '⚠️'
      default: return '•'
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-slate-400">
        Loading scheduled calls...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-400 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-medium text-slate-300">📅 Scheduled Calls</h3>
        {onNewBooking && (
          <Button
            size="sm"
            variant="outline"
            onClick={onNewBooking}
            className="text-xs h-7"
          >
            + New
          </Button>
        )}
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="p-4 text-center text-slate-500 text-sm">
          No upcoming scheduled calls
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              onClick={() => onBookingClick?.(booking)}
              className="p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">
                      {booking.title}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(booking.status)}`}>
                      {getStatusIcon(booking.status)} {booking.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    {booking.attendee_name || booking.attendee_phone}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    🕐 {formatDateTime(booking.start_time)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View All Link */}
      {bookings.length > 0 && (
        <div className="text-center pt-2">
          <button 
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            onClick={() => window.location.href = '/bookings'}
          >
            View all scheduled calls →
          </button>
        </div>
      )}
    </div>
  )
}

export default BookingsList
