"use client"

import React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'ghost' | 'outline' | 'default'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ children, className = '', variant = 'default', size = 'md', ...rest }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-md focus:outline-none'
  const variants: Record<string,string> = {
    default: 'bg-indigo-600 text-white hover:bg-indigo-500',
    outline: 'border border-slate-700 text-slate-100',
    ghost: 'bg-transparent text-slate-100'
  }
  const sizes: Record<string,string> = { sm: 'px-2 py-1 text-sm', md: 'px-3 py-2', lg: 'px-4 py-2' }
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export default Button
 
