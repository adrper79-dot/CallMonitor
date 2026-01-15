"use client"

import React, { forwardRef } from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  hint?: string
}

/**
 * Input Component - Professional Design System v3.0
 * 
 * Clean, accessible input with proper focus states.
 * White background, subtle border, clear error states.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, hint, id, ...rest }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 11)}`
    
    const inputStyles = `
      w-full h-10 px-3
      bg-white border rounded-md
      text-gray-900 placeholder-gray-400
      transition-colors duration-150
      focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      ${error 
        ? 'border-error focus:ring-error focus:border-error' 
        : 'border-gray-300 focus:ring-primary-600 focus:border-primary-600'
      }
    `.replace(/\s+/g, ' ').trim()
    
    return (
      <div className="w-full">
        {label && (
          <label 
            className="block text-sm font-medium text-gray-700 mb-1.5" 
            htmlFor={inputId}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${inputStyles} ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          {...rest}
        />
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-gray-500">
            {hint}
          </p>
        )}
        {error && (
          <p 
            id={`${inputId}-error`} 
            className="mt-1.5 text-sm text-error" 
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
