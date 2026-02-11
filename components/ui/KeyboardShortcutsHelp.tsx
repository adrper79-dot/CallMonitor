'use client'

import React from 'react'
import type { KeyboardShortcut } from '@/hooks/useKeyboardShortcuts'

interface KeyboardShortcutsHelpProps {
  shortcuts: KeyboardShortcut[]
  isOpen: boolean
  onClose: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  call: 'Call Controls',
  navigation: 'Navigation',
  disposition: 'Disposition',
  general: 'General',
}

const CATEGORY_ORDER = ['call', 'disposition', 'navigation', 'general']

/**
 * KeyboardShortcutsHelp — Floating overlay showing available shortcuts.
 * Triggered by pressing '?' anywhere in the app.
 * 
 * Design: Minimal, non-intrusive, closes on Escape or click outside.
 */
export function KeyboardShortcutsHelp({ shortcuts, isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null

  // Group shortcuts by category
  const grouped = shortcuts.reduce<Record<string, KeyboardShortcut[]>>((acc, s) => {
    const cat = s.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-5">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped[cat]
              if (!items?.length) return null
              return (
                <div key={cat}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {CATEGORY_LABELS[cat] || cat}
                  </h3>
                  <div className="space-y-1">
                    {items.map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-gray-700">{s.description}</span>
                        <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs font-mono text-gray-600">
                          {formatKey(s)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-500">Show this help</span>
                <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs font-mono text-gray-600">?</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function formatKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.meta) parts.push('Cmd')

  // Format the key display
  const keyDisplay =
    shortcut.key === 'Escape' ? 'Esc' :
    shortcut.key === ' ' ? 'Space' :
    shortcut.key === 'Enter' ? 'Enter' :
    shortcut.key === '/' ? '/' :
    shortcut.key.toUpperCase()

  parts.push(keyDisplay)
  return parts.join(' + ')
}

export default KeyboardShortcutsHelp
