"use client"

import React from 'react'

type SwitchProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  checked?: boolean
  onChange?: (checked: boolean) => void
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
}

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
      className={`inline-flex items-center h-6 w-11 rounded-full p-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C4001A] focus:ring-offset-2 ${
        disabled 
          ? 'bg-gray-200 cursor-not-allowed opacity-60' 
          : checked 
            ? 'bg-[#C4001A] cursor-pointer shadow-[0_0_8px_rgba(196,0,26,0.3)]' 
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
