"use client"

import React from 'react'

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
}

export function Badge({ children, className = '', variant = 'default', ...rest }: BadgeProps) {
  const variants: Record<string, string> = {
    default: 'bg-slate-700 text-slate-100',
    secondary: 'bg-slate-600 text-slate-200',
    success: 'bg-green-600 text-white',
    warning: 'bg-yellow-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
  }
  
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}

export default Badge
