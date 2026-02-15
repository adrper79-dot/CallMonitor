"use client"

import React from 'react'

type SliderProps = React.InputHTMLAttributes<HTMLInputElement> & {
  value?: number
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number) => void
}

/**
 * Slider Component - Professional Design System v3.0
 *
 * Range input slider with Navy primary color.
 * Accessible with proper ARIA attributes.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className = '',
  ...rest
}: SliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    onValueChange?.(newValue)
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handleChange}
      className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider ${className}`}
      style={{
        background: `linear-gradient(to right, #1e40af 0%, #1e40af ${(value! - min) / (max - min) * 100}%, #e5e7eb ${(value! - min) / (max - min) * 100}%, #e5e7eb 100%)`
      }}
      {...rest}
    />
  )
}