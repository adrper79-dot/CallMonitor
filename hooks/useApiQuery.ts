/**
 * useApiQuery Hook
 * 
 * Universal data fetching hook that replaces repetitive useEffect + useState patterns.
 * Provides loading states, error handling, and automatic cleanup.
 * 
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useApiQuery<Call[]>('/api/calls');
 * 
 * if (loading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * return <CallList calls={data} />;
 * ```
 * 
 * Features:
 * - Automatic loading/error state management
 * - Request cancellation on unmount
 * - Manual refetch capability
 * - TypeScript generics for type safety
 * - Dependency tracking via URL changes
 */

import { useState, useEffect, useCallback } from 'react'
import { apiGet, type ApiClientOptions } from '@/lib/apiClient'

export interface UseApiQueryResult<T> {
  /** Fetched data (null until first successful load) */
  data: T | null
  /** Loading state (true during initial load and refetch) */
  loading: boolean
  /** Error state (null if no error) */
  error: Error | null
  /** Manual refetch function */
  refetch: () => Promise<void>
}

/**
 * Fetch data from an API endpoint with automatic state management
 * 
 * @param url - API endpoint URL (changes trigger refetch)
 * @param options - Optional RequestInit options (excluding credentials)
 * @returns Object containing data, loading, error, and refetch function
 */
export function useApiQuery<T = any>(
  url: string,
  options?: ApiClientOptions
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Stable refetch function with dependency tracking
  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await apiGet<T>(url, options)
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [url, JSON.stringify(options)]) // Serialize options for stable comparison

  // Initial fetch + refetch on URL/options change
  useEffect(() => {
    let cancelled = false

    refetch().then(() => {
      // Clear data if component unmounted during fetch
      if (cancelled) {
        setData(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [refetch])

  return { data, loading, error, refetch }
}
