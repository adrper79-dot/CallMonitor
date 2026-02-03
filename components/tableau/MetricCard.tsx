'use client'

import React from 'react'

interface MetricCardProps {
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

/**
 * MetricCard - Professional Design System v3.0
 * Clean, data-first design with large numbers and subtle styling
 */
export function MetricCard({ label, value, change, trend, className = '' }: MetricCardProps) {
  const trendColor = 
    trend === 'up' ? 'text-success' :
    trend === 'down' ? 'text-error' : 
    'text-gray-500'
  
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : null

  return (
    <div className={`bg-white border border-gray-200 rounded-md p-5 hover:border-gray-300 transition-colors ${className}`}>
      {/* Small muted label */}
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      
      {/* Large prominent value */}
      <p className="text-3xl font-semibold text-gray-900 tabular-nums mb-1">
        {value}
      </p>
      
      {/* Optional change indicator */}
      {change && (
        <p className={`text-sm ${trendColor}`}>
          {trendIcon && <span className="mr-1">{trendIcon}</span>}
          {change}
        </p>
      )}
    </div>
  )
}

export default MetricCard
