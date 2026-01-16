'use client'

import React from 'react'

interface ProgressBarProps {
  value: number // 0-100
  label?: string
  color?: 'primary' | 'blue' | 'green' | 'orange' | 'red'
  showValue?: boolean
  className?: string
}

const colorMap: Record<string, string> = {
  primary: 'bg-primary-600',
  blue: 'bg-primary-600', // Alias for backward compatibility
  green: 'bg-success',
  orange: 'bg-warning',
  red: 'bg-error'
}

/**
 * ProgressBar - Professional Design System v3.0
 * Clean progress indicator with semantic colors
 */
export function ProgressBar({ 
  value, 
  label, 
  color = 'primary', 
  showValue = false,
  className = '' 
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value))
  const bgColor = colorMap[color]

  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500" id={`progress-label-${label.replace(/\s+/g, '-').toLowerCase()}`}>
            {label}
          </span>
          {showValue && (
            <span className="text-gray-900 font-medium tabular-nums">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <div 
        className="h-2 bg-gray-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(clampedValue)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `Progress: ${Math.round(clampedValue)}%`}
      >
        <div
          className={`h-full ${bgColor} transition-all duration-300 ease-out`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
