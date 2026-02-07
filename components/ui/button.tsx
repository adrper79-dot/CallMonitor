'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Button Component - Professional Design System v3.0 (CVA)
 *
 * Variants:
 * - primary: Navy blue, for the ONE primary action per screen
 * - secondary: Gray, for secondary actions
 * - outline: White with border, for tertiary actions
 * - ghost: Transparent, for inline/subtle actions
 * - destructive: Red, for delete/danger actions ONLY
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-[#1E3A5F] text-white hover:bg-[#15294A] focus-visible:ring-[#1E3A5F]',
        primary: 'bg-[#1E3A5F] text-white hover:bg-[#15294A] focus-visible:ring-[#1E3A5F]',
        secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus-visible:ring-gray-500',
        outline:
          'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:ring-[#1E3A5F]',
        ghost:
          'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-500',
        destructive: 'bg-[#DC2626] text-white hover:bg-[#B91C1C] focus-visible:ring-[#DC2626]',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
    asChild?: boolean
  }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { children, className, variant, size, loading = false, disabled, asChild = false, ...rest },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? (
          <>
            <span className="loading-spinner mr-2" aria-hidden="true" />
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export default Button
