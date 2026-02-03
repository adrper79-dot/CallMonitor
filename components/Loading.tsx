'use client'

import React, { useState, useEffect } from 'react'
import { Logo } from './Logo'

interface LoadingProps {
  message?: string
  fullScreen?: boolean
  showLogo?: boolean
  size?: 'sm' | 'md' | 'lg'
  transparent?: boolean
}

/**
 * VOXSOUTH LOADING COMPONENT
 * 
 * "Patience is the companion of wisdom." — Saint Augustine
 * 
 * Features:
 * - Video loading animation with transparency support
 * - Fallback to animated logo
 * - 1960s-style loading messages
 * 
 * ─────────────────────────────────────────────────────────────────────────
 */

// Sophisticated loading messages in the style of 1960s Playboy ads
const LOADING_MESSAGES = [
  "Preparing your command center...",
  "Engaging the communications array...",
  "The future is materializing...",
  "Calibrating your executive dashboard...",
  "Establishing secure channels...",
  "Tomorrow's technology, loading today...",
  "Your voice intelligence platform awaits...",
  "Configuring for peak performance...",
]

export function Loading({ 
  message, 
  fullScreen = true,
  showLogo = true,
  size = 'md',
  transparent = true
}: LoadingProps) {
  const [videoError, setVideoError] = useState(false)
  const [displayMessage, setDisplayMessage] = useState(message || LOADING_MESSAGES[0])
  
  // Rotate through messages if none provided
  useEffect(() => {
    if (message) return
    
    let index = 0
    const interval = setInterval(() => {
      index = (index + 1) % LOADING_MESSAGES.length
      setDisplayMessage(LOADING_MESSAGES[index])
    }, 3000)
    
    return () => clearInterval(interval)
  }, [message])

  const content = (
    <div className="flex flex-col items-center justify-center gap-8">
      {/* Video Loading Animation with Transparency */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        {!videoError ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            className={`w-48 h-48 object-contain rounded-lg ${transparent ? 'mix-blend-screen' : ''}`}
            style={transparent ? { 
              backgroundColor: 'transparent',
              filter: 'drop-shadow(0 0 15px rgba(0, 206, 209, 0.6))'
            } : {}}
            onError={() => setVideoError(true)}
          >
            <source src="/loading.mp4" type="video/mp4" />
          </video>
        ) : showLogo ? (
          <Logo size="hero" animated />
        ) : (
          <LoadingOrbit />
        )}
      </div>

      {/* Loading message */}
      <p className="text-gray-500 text-sm max-w-xs text-center">
        {displayMessage}
      </p>
    </div>
  )

  if (fullScreen) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${transparent ? 'bg-gray-900/95' : 'bg-gray-50'}`}>
        {content}
      </div>
    )
  }

  return content
}

/**
 * Orbital Loading Spinner
 * Fallback spinner with hybrid design (clean + futuristic accents)
 */
function LoadingOrbit() {
  return (
    <div className="relative w-32 h-32">
      <div 
        className="absolute inset-0 rounded-full border-2 border-gray-200 border-t-primary-600 animate-spin"
        style={{ animationDuration: '0.8s' }}
      />
    </div>
  )
}

/**
 * Skeleton loader for content placeholders
 */
export function Skeleton({ className = '', variant = 'default' }: { 
  className?: string
  variant?: 'default' | 'text' | 'circle' | 'card' 
}) {
  const variants = {
    default: 'rounded-lg',
    text: 'rounded h-4',
    circle: 'rounded-full',
    card: 'rounded-2xl',
  }
  
  return (
    <div 
      className={`bg-gray-200 animate-pulse ${variants[variant]} ${className}`}
    />
  )
}

/**
 * Button loading spinner
 */
export function ButtonSpinner({ className = '' }: { className?: string }) {
  return (
    <svg 
      className={`animate-spin h-5 w-5 ${className}`}
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
