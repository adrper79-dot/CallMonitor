'use client'

import React from 'react'
import { Logo } from './Logo'

interface LoadingProps {
  message?: string
  fullScreen?: boolean
  showLogo?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Loading Component with animated Latimer + Woods logo
 * 
 * For video loading animation, place your video at:
 * /public/loading.mp4 or /public/loading.webm
 */
export function Loading({ 
  message = 'Loading...', 
  fullScreen = true,
  showLogo = true,
  size = 'md'
}: LoadingProps) {
  const spinnerSizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  }

  const content = (
    <div className="flex flex-col items-center justify-center gap-6">
      {showLogo && (
        <div className="animate-pulse">
          <Logo size="xl" showText />
        </div>
      )}
      
      {/* Animated spinner */}
      <div className="relative">
        {/* Outer ring */}
        <div className={`${spinnerSizes[size]} border-slate-700 border-t-[#C5A045] rounded-full animate-spin`} />
        
        {/* Inner glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-radial from-[#C5A045]/20 to-transparent animate-pulse" />
      </div>

      {/* Loading message */}
      {message && (
        <p className="text-slate-400 text-sm animate-pulse">
          {message}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        {content}
      </div>
    )
  }

  return content
}

/**
 * Video-based loading animation
 * Place your video at /public/loading.mp4
 */
export function VideoLoading({ message }: { message?: string }) {
  const [videoError, setVideoError] = React.useState(false)

  if (videoError) {
    return <Loading message={message} />
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-64 h-64 object-contain"
        onError={() => setVideoError(true)}
      >
        <source src="/loading.webm" type="video/webm" />
        <source src="/loading.mp4" type="video/mp4" />
      </video>
      {message && (
        <p className="text-slate-400 text-sm mt-4 animate-pulse">
          {message}
        </p>
      )}
    </div>
  )
}

/**
 * Skeleton loading placeholder
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div 
      className={`animate-pulse bg-slate-800 rounded ${className}`}
    />
  )
}

/**
 * Loading state for call lists
 */
export function CallListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Loading spinner for buttons
 */
export function ButtonSpinner({ className = '' }: { className?: string }) {
  return (
    <svg 
      className={`animate-spin h-4 w-4 ${className}`} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export default Loading
