"use client"

import React from 'react'

type SwitchProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  checked?: boolean
  onChange?: (checked: boolean) => void
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
}

/**
 * Switch Component - Professional Design System v3.0
 * 
 * Toggle switch with Navy primary color.
 * Accessible with proper ARIA attributes.
 */
export function Switch({ 
  checked = false, 
  onChange, 
  onCheckedChange, 
  disabled = false,
  className = '', 
  ...rest 
}: SwitchProps) {
  const handleClick = () => {
    if (disabled) return
    const next = !checked
    onChange?.(next)
    onCheckedChange?.(next)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={handleClick}
      disabled={disabled}
      className={`inline-flex items-center h-6 w-11 rounded-full p-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 ${
        disabled 
          ? 'bg-gray-200 cursor-not-allowed opacity-60' 
          : checked 
            ? 'bg-primary-600 cursor-pointer' 
            : 'bg-gray-300 cursor-pointer hover:bg-gray-400'
      } ${className}`}
      {...rest}
    >
      <span 
        className={`inline-block h-5 w-5 rounded-full bg-white transform transition-transform shadow-sm ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default Switch
