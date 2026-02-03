"use client"

import React, { useEffect, useRef } from 'react'
import { Button } from './button'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Dialog({ open, onOpenChange, title, children, footer }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!open) return
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onOpenChange(false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onOpenChange])
  
  if (!open) return null
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'dialog-title' : undefined}
    >
      <div
        ref={dialogRef}
        className="bg-slate-900 border border-slate-800 rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-auto"
      >
        {title && (
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 id="dialog-title" className="text-lg font-semibold text-slate-100">
              {title}
            </h2>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

type DialogTriggerProps = {
  children: React.ReactNode
  asChild?: boolean
}

export function DialogTrigger({ children, asChild }: DialogTriggerProps) {
  return <>{children}</>
}

// Shadcn/ui compatible sub-components
type DialogContentProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={`${className || ''}`} {...props}>
        {children}
      </div>
    )
  }
)
DialogContent.displayName = 'DialogContent'

type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement>

export const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col space-y-1.5 text-center sm:text-left ${className || ''}`}
      {...props}
    />
  )
)
DialogHeader.displayName = 'DialogHeader'

type DialogFooterProps = React.HTMLAttributes<HTMLDivElement>

export const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ''}`}
      {...props}
    />
  )
)
DialogFooter.displayName = 'DialogFooter'

type DialogTitleProps = React.HTMLAttributes<HTMLHeadingElement>

export const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={`text-lg font-semibold leading-none tracking-tight ${className || ''}`}
      {...props}
    />
  )
)
DialogTitle.displayName = 'DialogTitle'

type DialogDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>

export const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={`text-sm text-muted-foreground ${className || ''}`}
      {...props}
    />
  )
)
DialogDescription.displayName = 'DialogDescription'
