'use client'

import React, { useState } from 'react'
import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  showText?: boolean
  className?: string
  animated?: boolean
}

const sizes = {
  sm: { icon: 32, text: 'text-xs' },
  md: { icon: 48, text: 'text-sm' },
  lg: { icon: 64, text: 'text-base' },
  xl: { icon: 96, text: 'text-lg' },
  hero: { icon: 160, text: 'text-2xl' },
}

/**
 * LATIMER + WOODS TECH LLC
 * Logo Component
 * 
 * "A mark of distinction for the discerning technologist."
 * 
 * Uses /public/logo.jpg as the primary logo image
 */
export function Logo({ 
  size = 'md', 
  showText = false, 
  className = '',
  animated = false 
}: LogoProps) {
  const { icon, text } = sizes[size]
  const [imgError, setImgError] = useState(false)

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo - Using new image with SVG fallback */}
      <div 
        className={`relative flex-shrink-0 ${animated ? 'animate-float' : ''}`}
        style={{ width: icon, height: icon }}
      >
        {!imgError ? (
          <Image
            src="/logo.jpg"
            alt="Word Is Bond Logo"
            width={icon}
            height={icon}
            className="object-contain rounded-lg"
            onError={() => setImgError(true)}
            priority={size === 'hero'}
          />
        ) : (
          <LogoSVG size={icon} />
        )}
      </div>
      
      {showText && (
        <div className="flex flex-col">
          <span className={`font-display font-bold tracking-wide ${text} text-gray-900`}>
            Wordis Bond
          </span>
          <span className="text-xs tracking-wider text-gray-500">
            System of Record
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * SVG Fallback Logo
 * Gold crescent moon with neural network silhouette
 */
function LogoSVG({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Crescent Moon - Gold */}
      <path
        d="M50 5C25.147 5 5 25.147 5 50C5 74.853 25.147 95 50 95C60.5 95 70.2 91.5 78 85.5C68.5 90 57 88 48 78C36 65 36 45 48 32C57 22 68.5 20 78 24.5C70.2 8.5 60.5 5 50 5Z"
        fill="url(#goldGradient)"
      />
      
      {/* Head silhouette */}
      <path
        d="M55 25C55 25 70 30 75 50C80 70 70 80 60 85C55 82 52 75 52 70C52 60 60 55 65 50C70 45 68 35 60 30C55 27 55 25 55 25Z"
        fill="#0A0A1A"
      />
      
      {/* Neural network nodes */}
      <circle cx="62" cy="40" r="3" fill="#00CED1"/>
      <circle cx="70" cy="50" r="3" fill="#00CED1"/>
      <circle cx="65" cy="60" r="3" fill="#00CED1"/>
      <circle cx="55" cy="55" r="3" fill="#00CED1"/>
      <circle cx="58" cy="48" r="2" fill="#00CED1"/>
      <circle cx="68" cy="42" r="2" fill="#00CED1"/>
      
      {/* Neural connections with glow effect */}
      <g opacity="0.8" filter="url(#glow)">
        <line x1="62" y1="40" x2="70" y2="50" stroke="#00CED1" strokeWidth="1.5"/>
        <line x1="70" y1="50" x2="65" y2="60" stroke="#00CED1" strokeWidth="1.5"/>
        <line x1="62" y1="40" x2="58" y2="48" stroke="#00CED1" strokeWidth="1.5"/>
        <line x1="58" y1="48" x2="55" y2="55" stroke="#00CED1" strokeWidth="1.5"/>
        <line x1="55" y1="55" x2="65" y2="60" stroke="#00CED1" strokeWidth="1.5"/>
        <line x1="68" y1="42" x2="70" y2="50" stroke="#00CED1" strokeWidth="1.5"/>
        <line x1="62" y1="40" x2="68" y2="42" stroke="#00CED1" strokeWidth="1.5"/>
      </g>
      
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C5A045"/>
          <stop offset="50%" stopColor="#D4B860"/>
          <stop offset="100%" stopColor="#A88A30"/>
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}

export default Logo
