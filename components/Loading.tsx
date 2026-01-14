'use client'

import React, { useState, useEffect } from 'react'
import { Logo } from './Logo'

interface LoadingProps {
  message?: string
  fullScreen?: boolean
  showLogo?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * VOXSOUTH LOADING COMPONENT
 * 
 * "Patience is the companion of wisdom." — Saint Augustine
 * 
 * Features:
 * - Video loading animation (place at /public/loading.mp4)
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
  size = 'md'
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
      {/* Video or Logo */}
      <div className="relative">
        {!videoError ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-48 h-48 object-contain rounded-full"
            onError={() => setVideoError(true)}
          >
            <source src="/loading.webm" type="video/webm" />
            <source src="/loading.mp4" type="video/mp4" />
          </video>
        ) : showLogo ? (
          <div className="animate-float">
            <Logo size="hero" animated />
          </div>
        ) : (
          <LoadingOrbit />
        )}
        
        {/* Orbital ring around logo/video */}
        <div className="absolute inset-0 animate-spin-slow pointer-events-none" 
          style={{ animationDuration: '8s' }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="url(#orbitGradient)"
              strokeWidth="1"
              strokeDasharray="10 5"
              opacity="0.5"
            />
            <defs>
              <linearGradient id="orbitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00CED1" />
                <stop offset="50%" stopColor="#C5A045" />
                <stop offset="100%" stopColor="#00CED1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      
      {/* Brand text */}
      <div className="text-center">
        <h2 className="font-display text-xl tracking-wider mb-2"
          style={{
            background: 'linear-gradient(135deg, #C5A045 0%, #00CED1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          VOXSOUTH
        </h2>
        <p className="text-sm text-[#C0C0C0] tracking-widest uppercase">
          Voice Intelligence Platform
        </p>
      </div>

      {/* Loading message */}
      <p className="text-[#FFF8E7]/60 text-sm italic max-w-xs text-center animate-pulse">
        {displayMessage}
      </p>
      
      {/* Progress bar */}
      <div className="w-64 h-1 bg-[#1E1E3F] rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full shimmer"
          style={{
            background: 'linear-gradient(90deg, transparent, #00CED1, #C5A045, transparent)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s linear infinite',
          }}
        />
      </div>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #0A0A1A 0%, #1E1E3F 50%, #0F172A 100%)',
        }}
      >
        {/* Starfield effect */}
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.4), transparent),
              radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.3), transparent),
              radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.5), transparent),
              radial-gradient(2px 2px at 130px 80px, rgba(255,255,255,0.3), transparent)
            `,
            backgroundSize: '200px 200px',
          }}
        />
        {content}
      </div>
    )
  }

  return content
}

/**
 * Orbital Loading Spinner
 * Jetsons-inspired double-ring animation
 */
function LoadingOrbit() {
  return (
    <div className="relative w-32 h-32">
      {/* Outer ring */}
      <div 
        className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
        style={{
          borderTopColor: '#00CED1',
          borderRightColor: 'rgba(0, 206, 209, 0.3)',
          animationDuration: '1.2s',
        }}
      />
      
      {/* Inner ring - counter-rotating */}
      <div 
        className="absolute inset-4 rounded-full border-4 border-transparent animate-spin"
        style={{
          borderTopColor: '#C5A045',
          borderLeftColor: 'rgba(197, 160, 69, 0.3)',
          animationDuration: '0.8s',
          animationDirection: 'reverse',
        }}
      />
      
      {/* Center glow */}
      <div 
        className="absolute inset-8 rounded-full animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(0, 206, 209, 0.3) 0%, transparent 70%)',
        }}
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
      className={`bg-[#1E1E3F] shimmer ${variants[variant]} ${className}`}
      style={{
        background: 'linear-gradient(90deg, #1E1E3F 0%, #2D2D5A 50%, #1E1E3F 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s linear infinite',
      }}
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
