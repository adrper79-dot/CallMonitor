'use client'

import React from 'react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const sizes = {
  sm: { icon: 32, text: 'text-sm' },
  md: { icon: 48, text: 'text-base' },
  lg: { icon: 64, text: 'text-lg' },
  xl: { icon: 96, text: 'text-2xl' },
}

/**
 * Latimer + Woods Tech LLC Logo
 * 
 * Gold crescent moon with neural network head silhouette
 * If you have a logo file, place it in /public/logo.png or /public/logo.svg
 */
export function Logo({ size = 'md', showText = false, className = '' }: LogoProps) {
  const { icon, text } = sizes[size]

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* SVG Logo - Gold crescent moon with neural network */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Crescent Moon */}
        <path
          d="M50 5C25.147 5 5 25.147 5 50C5 74.853 25.147 95 50 95C60.5 95 70.2 91.5 78 85.5C68.5 90 57 88 48 78C36 65 36 45 48 32C57 22 68.5 20 78 24.5C70.2 8.5 60.5 5 50 5Z"
          fill="#C5A045"
        />
        
        {/* Head silhouette */}
        <path
          d="M55 25C55 25 70 30 75 50C80 70 70 80 60 85C55 82 52 75 52 70C52 60 60 55 65 50C70 45 68 35 60 30C55 27 55 25 55 25Z"
          fill="#1E293B"
        />
        
        {/* Neural network nodes */}
        <circle cx="62" cy="40" r="3" fill="#C5A045"/>
        <circle cx="70" cy="50" r="3" fill="#C5A045"/>
        <circle cx="65" cy="60" r="3" fill="#C5A045"/>
        <circle cx="55" cy="55" r="3" fill="#C5A045"/>
        <circle cx="58" cy="48" r="2" fill="#C5A045"/>
        <circle cx="68" cy="42" r="2" fill="#C5A045"/>
        
        {/* Neural network connections */}
        <line x1="62" y1="40" x2="70" y2="50" stroke="#C5A045" strokeWidth="1" strokeOpacity="0.6"/>
        <line x1="70" y1="50" x2="65" y2="60" stroke="#C5A045" strokeWidth="1" strokeOpacity="0.6"/>
        <line x1="62" y1="40" x2="58" y2="48" stroke="#C5A045" strokeWidth="1" strokeOpacity="0.6"/>
        <line x1="58" y1="48" x2="55" y2="55" stroke="#C5A045" strokeWidth="1" strokeOpacity="0.6"/>
        <line x1="55" y1="55" x2="65" y2="60" stroke="#C5A045" strokeWidth="1" strokeOpacity="0.6"/>
        <line x1="68" y1="42" x2="70" y2="50" stroke="#C5A045" strokeWidth="1" strokeOpacity="0.6"/>
        <line x1="62" y1="40" x2="68" y2="42" stroke="#C5A045" strokeWidth="1" strokeOpacity="0.6"/>
      </svg>
      
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold text-brand-gold ${text}`}>
            LATIMER + WOODS
          </span>
          <span className="text-xs text-slate-400 tracking-wider">
            TECH LLC
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Use this component if you have an image file
 * Place your logo at /public/logo.png
 */
export function LogoImage({ size = 'md', className = '' }: Omit<LogoProps, 'showText'>) {
  const { icon } = sizes[size]
  
  return (
    <img
      src="/logo.png"
      alt="Latimer + Woods Tech LLC"
      width={icon}
      height={icon}
      className={`object-contain ${className}`}
      onError={(e) => {
        // Fallback to SVG if image fails to load
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

export default Logo
