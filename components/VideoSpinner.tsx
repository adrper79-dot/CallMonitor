'use client'

import React, { useState } from 'react'

interface VideoSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  transparent?: boolean
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-48 h-48'
}

/**
 * VideoSpinner - Video-based loading animation
 * 
 * Uses /loading.mp4 with transparency support via mix-blend-mode
 * The video plays as a smooth futuristic loading indicator
 */
export function VideoSpinner({ size = 'md', className = '', transparent = true }: VideoSpinnerProps) {
  const [videoError, setVideoError] = useState(false)

  if (videoError) {
    // Fallback to CSS spinner if video fails
    return (
      <div 
        className={`${sizeMap[size]} border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin ${className}`}
        aria-label="Loading"
        role="status"
      />
    )
  }

  return (
    <div className={`${sizeMap[size]} ${className}`}>
      <video
        autoPlay
        loop
        muted
        playsInline
        className={`w-full h-full object-contain ${transparent ? 'mix-blend-screen' : ''}`}
        style={transparent ? { 
          backgroundColor: 'transparent',
          filter: 'drop-shadow(0 0 10px rgba(0, 206, 209, 0.5))'
        } : {}}
        onError={() => setVideoError(true)}
        aria-label="Loading"
        role="status"
      >
        <source src="/loading.mp4" type="video/mp4" />
      </video>
    </div>
  )
}

export default VideoSpinner
