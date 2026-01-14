'use client'

import React, { useState } from 'react'

interface VideoSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-16 h-16',
  lg: 'w-24 h-24'
}

/**
 * VideoSpinner - Simple inline video-based loading spinner
 * Uses /loading.mp4 for smooth animation with futuristic feel
 */
export function VideoSpinner({ size = 'md', className = '' }: VideoSpinnerProps) {
  const [videoError, setVideoError] = useState(false)

  if (videoError) {
    // Fallback to CSS spinner if video fails
    return (
      <div 
        className={`${sizeMap[size]} border-2 border-[#E5E5E5] border-t-[#C4001A] rounded-full animate-spin ${className}`}
        aria-label="Loading"
        role="status"
      />
    )
  }

  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      className={`${sizeMap[size]} object-contain ${className}`}
      onError={() => setVideoError(true)}
      aria-label="Loading"
      role="status"
    >
      <source src="/loading.mp4" type="video/mp4" />
    </video>
  )
}

export default VideoSpinner
