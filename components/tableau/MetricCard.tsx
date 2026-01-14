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
 * MetricCard - Tableau-style metric widget
 * Clean, data-first design with large numbers and subtle styling
 */
export function MetricCard({ label, value, change, trend, className = '' }: MetricCardProps) {
  const trendColor = 
    trend === 'up' ? 'text-[#59A14F]' :
    trend === 'down' ? 'text-[#E15759]' : 
    'text-[#666666]'
  
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : null

  return (
    <div className={`bg-white border border-[#E5E5E5] rounded-lg p-5 shadow-sm hover:shadow-md hover:border-[#D0D0D0] transition-all duration-200 ${className}`}>
      {/* Small muted label */}
      <p className="text-xs font-medium text-[#666666] uppercase tracking-wide mb-1">
        {label}
      </p>
      
      {/* Large prominent value */}
      <p className="text-3xl font-semibold text-[#333333] tabular-nums mb-1">
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
