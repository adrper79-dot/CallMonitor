'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ClientDate } from '@/components/ui/ClientDate'
import { apiGet } from '@/lib/apiClient'

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

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiGet(`/api/bookings?limit=${limit}&status=pending`)

      if (data.success) {
        setBookings(data.bookings || [])
      } else {
        // Handle error that may be an object with {id, code, message} or a string
        const errorMsg =
          typeof data.error === 'object' && data.error !== null
            ? data.error.message || data.error.code || JSON.stringify(data.error)
            : data.error || 'Failed to load bookings'
        setError(errorMsg)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'confirmed':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'calling':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'completed':
        return 'bg-gray-100 text-gray-600 border-gray-300'
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-300'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '○'
      case 'confirmed':
        return '✓'
      case 'calling':
        return '●'
      case 'completed':
        return '✓'
      case 'cancelled':
        return '✕'
      case 'failed':
        return '!'
      default:
        return '•'
    }
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Loading scheduled calls...</div>
  }

  if (error) {
    return <div className="p-4 text-center text-red-500 text-sm">{error}</div>
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-medium text-gray-700">Scheduled Calls</h3>
        {onNewBooking && (
          <Button size="sm" variant="outline" onClick={onNewBooking} className="text-xs h-7">
            + New
          </Button>
        )}
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="p-4 text-center text-gray-500 text-sm">No upcoming scheduled calls</div>
      ) : (
        <div className="space-y-2">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              onClick={() => onBookingClick?.(booking)}
              className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{booking.title}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(booking.status)}`}
                    >
                      {getStatusIcon(booking.status)} {booking.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {booking.attendee_name || booking.attendee_phone}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    <ClientDate date={booking.start_time} format="short" />
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
            className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
            onClick={() => (window.location.href = '/bookings')}
          >
            View all scheduled calls →
          </button>
        </div>
      )}
    </div>
  )
}

export default BookingsList
