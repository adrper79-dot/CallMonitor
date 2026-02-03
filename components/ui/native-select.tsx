"use client"

import React from 'react'

type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
  hint?: string
}

/**
 * Native Select Component - Professional Design System v3.0
 * 
 * Clean dropdown with proper focus states.
 * White background, subtle border, navy focus ring.
 * Uses native <select> element for simple use cases.
 */
export function NativeSelect({ children, className = '', label, error, hint, id, ...rest }: NativeSelectProps) {
  const selectId = id || `select-${Math.random().toString(36).substring(2, 11)}`
  const errorId = error ? `${selectId}-error` : undefined
  const hintId = hint && !error ? `${selectId}-hint` : undefined
  
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor={selectId}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full h-10 px-3 bg-white border rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors duration-150 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed ${
          error 
            ? 'border-error focus:ring-error focus:border-error' 
            : 'border-gray-300 focus:ring-primary-600 focus:border-primary-600'
        } ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...rest}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default NativeSelect
