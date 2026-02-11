'use client'

import { useEffect, useCallback, useRef, useState } from 'react'

export interface KeyboardShortcut {
  /** Key to listen for (e.g. 'd', 'Escape', 'Enter', '/') */
  key: string
  /** Optional modifier keys */
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  /** Action to perform */
  action: () => void
  /** Human-readable description for help overlay */
  description: string
  /** Category for grouping in help overlay */
  category?: 'call' | 'navigation' | 'disposition' | 'general'
  /** Whether shortcut is currently active */
  enabled?: boolean
}

interface UseKeyboardShortcutsOptions {
  /** Master enable/disable — e.g. disable during modal dialogs */
  enabled?: boolean
  /** Show help overlay on '?' key */
  helpEnabled?: boolean
}

/**
 * useKeyboardShortcuts — Global keyboard shortcut manager.
 * 
 * Design: Power users (collectors, supervisors) need rapid keyboard access.
 * Inspired by Gmail, Slack, VS Code — single-key shortcuts for frequent actions.
 * 
 * Safety rules:
 * - Never fires when user is typing in an input/textarea/contenteditable
 * - Respects enabled flag for context-dependent shortcuts
 * - '?' always shows the help overlay
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, helpEnabled = true } = options
  const [showHelp, setShowHelp] = useState(false)
  const shortcutsRef = useRef(shortcuts)

  // Keep ref updated to avoid re-registering listener on every shortcut change
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      // Don't capture when user is typing
      const target = e.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        target.closest('[role="dialog"]') ||
        target.closest('[data-radix-popper-content-wrapper]')
      ) {
        return
      }

      // Help overlay toggle
      if (helpEnabled && e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        setShowHelp(prev => !prev)
        return
      }

      // Escape closes help
      if (e.key === 'Escape' && showHelp) {
        e.preventDefault()
        setShowHelp(false)
        return
      }

      // Match against registered shortcuts
      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey)
        const shiftMatch = !!shortcut.shift === e.shiftKey
        const altMatch = !!shortcut.alt === e.altKey

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    },
    [enabled, helpEnabled, showHelp]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    showHelp,
    setShowHelp,
    shortcuts: shortcutsRef.current,
  }
}

/**
 * Pre-built shortcut sets for common pages
 */
export const VOICE_OPS_SHORTCUTS = {
  dial: (action: () => void): KeyboardShortcut => ({
    key: 'd',
    action,
    description: 'Dial / Start call',
    category: 'call',
  }),
  hangup: (action: () => void): KeyboardShortcut => ({
    key: 'Escape',
    action,
    description: 'Hang up / Cancel',
    category: 'call',
  }),
  dialNext: (action: () => void): KeyboardShortcut => ({
    key: 'n',
    action,
    description: 'Dial next in queue',
    category: 'call',
  }),
  search: (action: () => void): KeyboardShortcut => ({
    key: '/',
    action,
    description: 'Focus search',
    category: 'navigation',
  }),
  toggleMute: (action: () => void): KeyboardShortcut => ({
    key: 'm',
    action,
    description: 'Toggle mute',
    category: 'call',
  }),
  toggleHold: (action: () => void): KeyboardShortcut => ({
    key: 'h',
    action,
    description: 'Toggle hold',
    category: 'call',
  }),
}

export default useKeyboardShortcuts
