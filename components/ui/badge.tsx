"use client"

import React from 'react'

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
}

/**
 * Badge Component - Professional Design System v3.0
 * 
 * Light backgrounds with darker text for status indicators.
 * No borders - the subtle background provides enough contrast.
 */
export function Badge({ 
  children, 
  className = '', 
  variant = 'default', 
  ...rest 
}: BadgeProps) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium'
  
  const variants: Record<string, string> = {
    default: 'bg-gray-100 text-gray-700',
    secondary: 'bg-gray-100 text-gray-700',
    success: 'bg-success-light text-green-700',
    warning: 'bg-warning-light text-amber-700',
    error: 'bg-error-light text-red-700',
    info: 'bg-info-light text-blue-700',
  }
  
  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </span>
  )
}

export default Badge
