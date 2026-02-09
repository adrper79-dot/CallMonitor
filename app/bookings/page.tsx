'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/AppShell'
import { BookingModal } from '@/components/voice/BookingModal'
import { ClientDate } from '@/components/ui/ClientDate'
import { logger } from '@/lib/logger'
import { apiPatch, apiGet } from '@/lib/apiClient'

// Workers API URL

interface Booking {
  id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  attendee_name?: string
  attendee_email?: string
  attendee_phone: string
  from_number?: string
  status: string
  notes?: string
  calls?: {
    id: string
    status: string
    started_at?: string
    ended_at?: string
  }
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all')

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      const url =
        filter === 'all' ? '/api/bookings?limit=50' : `/api/bookings?limit=50&status=${filter}`
      const data = await apiGet(url)

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
  }, [filter])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString(undefined, {
      weekday: 'short',
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
        return 'bg-gray-100 text-gray-700 border-gray-300'
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳'
      case 'confirmed':
        return '✅'
      case 'calling':
        return '📞'
      case 'completed':
        return '✓'
      case 'cancelled':
        return '✕'
      case 'failed':
        return '⚠️'
      default:
        return '•'
    }
  }

  const handleCancelBooking = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled call?')) return

    try {
      await apiPatch(`/api/bookings/${id}`, { status: 'cancelled' })
      fetchBookings()
    } catch (err) {
      logger.error('Failed to cancel booking', err, { bookingId: id })
    }
  }

  return (
    <AppShell>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              📅 Scheduled Calls
            </h1>
            <p className="text-sm text-gray-500 mt-1">View and manage all your scheduled calls</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => (window.location.href = '/voice-operations')}>
              ← Back to Voice
            </Button>
            <Button onClick={() => setShowModal(true)}>
              + Schedule New Call
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'pending', 'completed', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-gray-500">Loading scheduled calls...</div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 mb-6">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && bookings.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-medium text-gray-700 mb-2">No scheduled calls</h3>
            <p className="text-gray-500 mb-6">
              {filter === 'all'
                ? "You haven't scheduled any calls yet."
                : `No ${filter} calls found.`}
            </p>
            <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700">
              Schedule Your First Call
            </Button>
          </div>
        )}

        {/* Bookings List */}
        {!loading && !error && bookings.length > 0 && (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="p-5 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{booking.title}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(booking.status)}`}
                      >
                        {getStatusIcon(booking.status)} {booking.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Contact:</span>
                        <span className="text-gray-900 ml-2">
                          {booking.attendee_name || booking.attendee_phone}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Phone:</span>
                        <span className="text-gray-900 ml-2 font-mono">
                          {booking.attendee_phone}
                        </span>
                      </div>
                      {booking.from_number && (
                        <div>
                          <span className="text-gray-500">Your Number:</span>
                          <span className="text-gray-900 ml-2 font-mono">
                            {booking.from_number}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Scheduled:</span>
                        <span className="text-gray-900 ml-2">
                          <ClientDate date={booking.start_time} format="short" />
                        </span>
                      </div>
                    </div>

                    {booking.description && (
                      <p className="text-sm text-gray-500 mt-3">{booking.description}</p>
                    )}

                    {booking.calls && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                        <span className="text-gray-500">Call Status:</span>
                        <span className="text-gray-900 ml-2">{booking.calls.status}</span>
                        {booking.calls.started_at && (
                          <span className="text-gray-500 ml-4">
                            Started: <ClientDate date={booking.calls.started_at} format="time" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    {booking.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelBooking(booking.id)}
                        className="text-red-400 hover:text-red-300 hover:border-red-500"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          setShowModal(false)
          fetchBookings()
        }}
      />
    </AppShell>
  )
}
