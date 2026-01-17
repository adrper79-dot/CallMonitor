"use client"

import React from 'react'

interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'delivered' | 'failed' | 'retrying'
}

/**
 * StatusBadge Component - Professional Design System v3.0
 * 
 * Displays webhook delivery status with semantic colors
 */
export function WebhookStatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    pending: { 
      bg: 'bg-blue-100', 
      text: 'text-blue-700', 
      label: 'Pending',
      icon: '⏱️'
    },
    processing: { 
      bg: 'bg-blue-100', 
      text: 'text-blue-700', 
      label: 'Processing',
      icon: '⚙️'
    },
    delivered: { 
      bg: 'bg-green-100', 
      text: 'text-green-700', 
      label: 'Delivered',
      icon: '✓'
    },
    failed: { 
      bg: 'bg-red-100', 
      text: 'text-red-700', 
      label: 'Failed',
      icon: '✕'
    },
    retrying: { 
      bg: 'bg-amber-100', 
      text: 'text-amber-700', 
      label: 'Retrying',
      icon: '↻'
    },
  }

  const variant = variants[status]

  return (
    <span 
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${variant.bg} ${variant.text}`}
      role="status"
      aria-label={`Status: ${variant.label}`}
    >
      <span aria-hidden="true">{variant.icon}</span>
      {variant.label}
    </span>
  )
}
