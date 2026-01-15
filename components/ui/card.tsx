"use client"

import React from 'react'

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  header?: React.ReactNode
  footer?: React.ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

/**
 * Card Component - Professional Design System v3.0
 * 
 * Clean white card with subtle border.
 * No shadow by default - shadow is for emphasis only.
 */
export function Card({ 
  children, 
  className = '', 
  header, 
  footer, 
  padding = 'md',
  ...rest 
}: CardProps) {
  const paddingSizes: Record<string, string> = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }
  
  return (
    <div 
      className={`bg-white border border-gray-200 rounded-md ${className}`} 
      {...rest}
    >
      {header && (
        <div className="px-4 py-3 border-b border-gray-200">
          {header}
        </div>
      )}
      <div className={paddingSizes[padding]}>
        {children}
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          {footer}
        </div>
      )}
    </div>
  )
}

export default Card
