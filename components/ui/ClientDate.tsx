"use client"

import { useState, useEffect } from 'react'

interface ClientDateProps {
  date: string | Date | null | undefined
  fallback?: string
  format?: 'short' | 'long' | 'time' | 'relative'
  className?: string
}

/**
 * Client-safe date component that avoids hydration mismatches.
 * Uses suppressHydrationWarning and renders ISO string initially,
 * then updates to locale string on client mount.
 */
export function ClientDate({ date, fallback = '—', format = 'short', className }: ClientDateProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!date) {
    return <span className={className}>{fallback}</span>
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date

  // Before mount, show a safe ISO-based format that's consistent
  if (!mounted) {
    // Return a deterministic format for SSR
    const isoDate = dateObj.toISOString().slice(0, 16).replace('T', ' ')
    return (
      <span className={className} suppressHydrationWarning>
        {isoDate}
      </span>
    )
  }

  // After mount, show locale-formatted date
  let formatted: string
  try {
    switch (format) {
      case 'short':
        formatted = dateObj.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
        break
      case 'long':
        formatted = dateObj.toLocaleString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
        break
      case 'time':
        formatted = dateObj.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit'
        })
        break
      case 'relative':
        formatted = getRelativeTime(dateObj)
        break
      default:
        formatted = dateObj.toLocaleString()
    }
  } catch {
    formatted = dateObj.toISOString().slice(0, 16).replace('T', ' ')
  }

  return (
    <span className={className} suppressHydrationWarning>
      {formatted}
    </span>
  )
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default ClientDate
