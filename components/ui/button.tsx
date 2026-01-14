"use client"

import React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'ghost' | 'outline' | 'default'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ children, className = '', variant = 'default', size = 'md', ...rest }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200'
  const variants: Record<string,string> = {
    default: 'bg-[#C4001A] text-white hover:bg-[#A30016] hover:shadow-[0_4px_12px_rgba(196,0,26,0.25)] focus:ring-[#C4001A]',
    outline: 'border border-[#E5E5E5] text-[#333333] hover:bg-[#FAFAFA] hover:border-[#C4001A] hover:text-[#C4001A] focus:ring-[#C4001A]',
    ghost: 'bg-transparent text-[#333333] hover:bg-[#FAFAFA] hover:text-[#C4001A] focus:ring-[#C4001A]'
  }
  const sizes: Record<string,string> = { sm: 'px-2 py-1 text-sm', md: 'px-3 py-2', lg: 'px-4 py-2' }
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export default Button
 
