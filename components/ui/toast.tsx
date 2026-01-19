"use client"

import * as React from "react"
import { createContext, useContext, useState, useCallback } from "react"
import { createPortal } from "react-dom"

/**
 * Toast Notification System
 * 
 * A production-ready toast system following Professional Design System v3.0.
 * Provides visual feedback for user actions with auto-dismiss and variants.
 * 
 * Usage:
 *   const { toast } = useToast()
 *   toast({ title: "Success!", description: "Action completed", variant: "success" })
 */

export type ToastVariant = "default" | "success" | "destructive" | "warning"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  toast: (props: Omit<Toast, "id">) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

// Generate unique ID for each toast
let toastCount = 0
function genId() {
  return `toast-${++toastCount}-${Date.now()}`
}

/**
 * ToastProvider - Wrap your app with this to enable toasts
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((props: Omit<Toast, "id">) => {
    const id = genId()
    const duration = props.duration ?? 5000

    setToasts((prev) => [...prev, { ...props, id }])

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  // Listen for toast events from standalone toast() calls
  React.useEffect(() => {
    function handleToastEvent(event: CustomEvent) {
      const { title, description, variant } = event.detail || {}
      toast({ title, description, variant: variant as ToastVariant })
    }
    
    window.addEventListener('toast', handleToastEvent as EventListener)
    return () => window.removeEventListener('toast', handleToastEvent as EventListener)
  }, [toast])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  )
}

/**
 * useToast hook - Access toast functionality
 */
export function useToast() {
  const context = useContext(ToastContext)
  
  // Fallback for when used outside provider (backwards compatibility)
  if (!context) {
    return {
      toast: ({ title, description, variant }: Omit<Toast, "id">) => {
        // Console fallback when provider not available
        console.debug('[Toast]', variant, title, description)
      },
      dismiss: () => {},
      toasts: [],
    }
  }
  
  return context
}

/**
 * Toaster - Renders the toast stack
 */
function Toaster() {
  const context = useContext(ToastContext)
  const [mounted, setMounted] = useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !context) return null

  const { toasts, dismiss } = context

  if (toasts.length === 0) return null

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>,
    document.body
  )
}

/**
 * ToastItem - Individual toast notification
 */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const variantStyles: Record<ToastVariant, string> = {
    default: "bg-white border-gray-200 text-gray-900",
    success: "bg-green-50 border-green-200 text-green-900",
    destructive: "bg-red-50 border-red-200 text-red-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
  }

  const iconMap: Record<ToastVariant, React.ReactNode> = {
    default: (
      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    success: (
      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    destructive: (
      <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  }

  return (
    <div
      role="alert"
      className={`
        pointer-events-auto
        w-80 max-w-[calc(100vw-2rem)]
        p-4 rounded-lg border shadow-lg
        animate-in slide-in-from-right-full fade-in duration-300
        ${variantStyles[toast.variant || "default"]}
      `}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {iconMap[toast.variant || "default"]}
        </div>
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className="text-sm font-semibold">{toast.title}</p>
          )}
          {toast.description && (
            <p className="text-sm opacity-90 mt-0.5">{toast.description}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Legacy export for backwards compatibility
export { useToast as default }
