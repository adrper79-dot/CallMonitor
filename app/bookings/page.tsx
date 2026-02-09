'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
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
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500'
      case 'confirmed':
        return 'bg-green-500/20 text-green-400 border-green-500'
      case 'calling':
        return 'bg-blue-500/20 text-blue-400 border-blue-500'
      case 'completed':
        return 'bg-slate-500/20 text-slate-400 border-slate-500'
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500'
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500'
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              📅 Scheduled Calls
            </h1>
            <p className="text-sm text-slate-400 mt-1">View and manage all your scheduled calls</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => (window.location.href = '/voice-operations')}>
              ← Back to Voice
            </Button>
            <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700">
              + Schedule New Call
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'pending', 'completed', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-slate-400">Loading scheduled calls...</div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 mb-6">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && bookings.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-medium text-slate-300 mb-2">No scheduled calls</h3>
            <p className="text-slate-400 mb-6">
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
                className="p-5 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-white">{booking.title}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(booking.status)}`}
                      >
                        {getStatusIcon(booking.status)} {booking.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Contact:</span>
                        <span className="text-slate-200 ml-2">
                          {booking.attendee_name || booking.attendee_phone}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Phone:</span>
                        <span className="text-slate-200 ml-2 font-mono">
                          {booking.attendee_phone}
                        </span>
                      </div>
                      {booking.from_number && (
                        <div>
                          <span className="text-slate-400">Your Number:</span>
                          <span className="text-slate-200 ml-2 font-mono">
                            {booking.from_number}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400">Scheduled:</span>
                        <span className="text-slate-200 ml-2">
                          <ClientDate date={booking.start_time} format="short" />
                        </span>
                      </div>
                    </div>

                    {booking.description && (
                      <p className="text-sm text-slate-400 mt-3">{booking.description}</p>
                    )}

                    {booking.calls && (
                      <div className="mt-3 p-3 bg-slate-700/50 rounded-lg text-sm">
                        <span className="text-slate-400">Call Status:</span>
                        <span className="text-slate-200 ml-2">{booking.calls.status}</span>
                        {booking.calls.started_at && (
                          <span className="text-slate-400 ml-4">
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
      </main>

      {/* Booking Modal */}
      <BookingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          setShowModal(false)
          fetchBookings()
        }}
      />
    </div>
  )
}
