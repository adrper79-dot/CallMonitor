"use client"

import React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

/**
 * Button Component - Professional Design System v3.0
 * 
 * Variants:
 * - primary: Navy blue, for the ONE primary action per screen
 * - secondary: Gray, for secondary actions
 * - outline: White with border, for tertiary actions
 * - ghost: Transparent, for inline/subtle actions
 * - destructive: Red, for delete/danger actions ONLY
 */
export function Button({ 
  children, 
  className = '', 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  disabled,
  ...rest 
}: ButtonProps) {
  const base = `
    inline-flex items-center justify-center 
    font-medium rounded-md
    transition-colors duration-150
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `.replace(/\s+/g, ' ').trim()
  
  const variants: Record<string, string> = {
    default: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-600',
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-600',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus-visible:ring-gray-500',
    outline: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:ring-primary-600',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-500',
    destructive: 'bg-error text-white hover:bg-error-dark focus-visible:ring-error',
  }
  
  const sizes: Record<string, string> = { 
    sm: 'h-9 px-3 text-sm', 
    md: 'h-10 px-4 text-sm', 
    lg: 'h-12 px-6 text-base' 
  }
  
  return (
    <button 
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} 
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <>
          <span className="loading-spinner mr-2" aria-hidden="true" />
          <span>Loading...</span>
        </>
      ) : children}
    </button>
  )
}

export default Button
