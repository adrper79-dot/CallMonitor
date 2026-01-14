'use client'

import React from 'react'

interface ProgressBarProps {
  value: number // 0-100
  label?: string
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple'
  showValue?: boolean
  className?: string
}

const colorMap = {
  blue: 'bg-[#4E79A7]',
  green: 'bg-[#59A14F]',
  orange: 'bg-[#F28E2B]',
  red: 'bg-[#E15759]',
  purple: 'bg-[#AF7AA1]'
}

/**
 * ProgressBar - Tableau-style clean progress indicator
 */
export function ProgressBar({ 
  value, 
  label, 
  color = 'blue', 
  showValue = false,
  className = '' 
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value))
  const bgColor = colorMap[color]

  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#666666]" id={`progress-label-${label.replace(/\s+/g, '-').toLowerCase()}`}>
            {label}
          </span>
          {showValue && (
            <span className="text-[#333333] font-medium tabular-nums">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <div 
        className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden"
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
