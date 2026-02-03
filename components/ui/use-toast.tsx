/**
 * Toast Hook (Re-export)
 * 
 * This file re-exports from the main toast module for backwards compatibility.
 * All toast functionality is now in toast.tsx with ToastProvider.
 */

export { useToast, ToastProvider, type Toast, type ToastVariant } from './toast'

/**
 * Standalone toast function for backwards compatibility.
 * Note: This only works when ToastProvider is in the component tree.
 * For components outside the provider, this logs to console as fallback.
 */
export function toast({ title, description, variant }: { title?: string; description?: string; variant?: string }) {
  // This is a fallback for code that imports toast directly.
  // When ToastProvider is active, toasts will show. Otherwise, console log.
  console.debug('[Toast]', variant || 'default', title, description)
  
  // Dispatch a custom event that ToastProvider can listen to
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('toast', { 
      detail: { title, description, variant } 
    }))
  }
}

// Legacy default export
export { useToast as default } from './toast'
