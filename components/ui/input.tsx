"use client"

import React from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export function Input({ className = '', label, error, id, ...rest }: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
  
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-100 mb-1" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-red-500' : ''} ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
}

export default Input
