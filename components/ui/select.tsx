"use client"

import React from 'react'

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
}

export function Select({ children, className = '', label, error, id, ...rest }: SelectProps) {
  const selectId = id || `select-${Math.random().toString(36).substring(2, 11)}`
  const errorId = error ? `${selectId}-error` : undefined
  
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[#333333] mb-1" htmlFor={selectId}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#C4001A] focus:border-[#C4001A] transition-all duration-200 ${error ? 'border-[#E15759]' : ''} ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-[#E15759]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default Select
