"use client"

import React from 'react'

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
}

export function Select({ children, className = '', label, error, ...rest }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-100 mb-1" htmlFor={rest.id}>
          {label}
        </label>
      )}
      <select
        className={`w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
}

export default Select
