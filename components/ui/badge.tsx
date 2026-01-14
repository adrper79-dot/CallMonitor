"use client"

import React from 'react'

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
}

export function Badge({ children, className = '', variant = 'default', ...rest }: BadgeProps) {
  const variants: Record<string, string> = {
    default: 'bg-gray-100 text-gray-600 border border-gray-200',
    secondary: 'bg-gray-100 text-gray-600 border border-gray-200',
    success: 'bg-[#E8F5E9] text-[#59A14F] border border-[#C8E6C9]',
    warning: 'bg-[#FFF8E1] text-[#F57C00] border border-[#FFE082]',
    error: 'bg-[#FFEBEE] text-[#E15759] border border-[#FFCDD2]',
    info: 'bg-[#E3F2FD] text-[#4E79A7] border border-[#BBDEFB]',
  }
  
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}

export default Badge
