export function toast({ title, description, variant }: { title?: string; description?: string; variant?: string }) {
  // Minimal toast stub for build/runtime. Replace with real implementation later.
  // eslint-disable-next-line no-console
  console.log('TOAST', { title, description, variant })
}

// Named export for compatibility
export function useToast() {
  return { toast }
}

export default toast
