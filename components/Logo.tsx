import React from 'react'
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

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo - Using new image */}
      <div 
        className={`relative flex-shrink-0 ${animated ? 'animate-float' : ''}`}
        style={{ width: icon, height: icon }}
      >
        <Image
          src="/logo.jpg"
          alt="Word Is Bond Logo"
          width={icon}
          height={icon}
          className="object-contain rounded-lg"
          priority={size === 'hero'}
        />
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

export default Logo
