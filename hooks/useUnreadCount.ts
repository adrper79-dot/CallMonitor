import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface UnreadCount {
  total: number
  by_channel: {
    sms: number
    email: number
    call: number
  }
}

/**
 * Hook to fetch unread message count
 * Polls every 30 seconds for real-time updates
 */
export function useUnreadCount(organizationId: string | null) {
  const [count, setCount] = useState<UnreadCount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }

    const fetchCount = async () => {
      try {
        const data = await apiGet('/api/messages/unread-count')
        setCount(data)
        setLoading(false)
      } catch (error) {
        logger.error('Failed to fetch unread count', error)
        setLoading(false)
      }
    }

    // Initial fetch
    fetchCount()

    // Poll every 30 seconds
    const interval = setInterval(fetchCount, 30000)

    return () => clearInterval(interval)
  }, [organizationId])

  return { count, loading }
}
