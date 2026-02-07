'use client'

import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Badge Component - Professional Design System v3.0 (CVA)
 *
 * Light backgrounds with darker text for status indicators.
 * No borders - the subtle background provides enough contrast.
 */
export const badgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-700',
        secondary: 'bg-gray-100 text-gray-700',
        success: 'bg-success-light text-green-700',
        warning: 'bg-warning-light text-amber-700',
        error: 'bg-error-light text-red-700',
        info: 'bg-info-light text-blue-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

export function Badge({ children, className, variant, ...rest }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...rest}>
      {children}
    </span>
  )
}

export default Badge
