'use client'

/**
 * CommandPalette — ⌘K quick-nav overlay
 *
 * Searches all navigation items from the current role shell,
 * letting users jump to any page instantly. Highlights matches
 * and supports keyboard navigation.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useRBAC } from '@/hooks/useRBAC'
import { getRoleShell, getAllNavItems, type NavItem } from '@/lib/navigation'
import {
  Home, Phone, Users, Calendar, Wrench, BarChart3, Monitor,
  Shield, DollarSign, Megaphone, FileBarChart, Settings, ShieldCheck,
  CalendarCheck, ListOrdered, PhoneOutgoing, PhoneCall, CreditCard,
  Upload, AlertTriangle, Clock, CalendarDays, FileText, BookOpen,
  ScrollText, Calculator, Trophy, LayoutDashboard, Radio, UserCog,
  ClipboardCheck, GraduationCap, ShieldAlert, PhoneOff, Scale,
  Wallet, CalendarRange, ArrowLeftRight, XCircle, TrendingUp, Target,
  UserCheck, Play, GitBranch, MessageSquare, Building2, Activity,
  Receipt, Mic, Brain, Database, Webhook, Search,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Phone, Users, Calendar, Wrench, BarChart3, Monitor,
  Shield, DollarSign, Megaphone, FileBarChart, Settings, ShieldCheck,
  CalendarCheck, ListOrdered, PhoneOutgoing, PhoneCall, CreditCard,
  Upload, AlertTriangle, Clock, CalendarDays, FileText, BookOpen,
  ScrollText, Calculator, Trophy, LayoutDashboard, Radio, UserCog,
  ClipboardCheck, GraduationCap, ShieldAlert, PhoneOff, Scale,
  Wallet, CalendarRange, ArrowLeftRight, XCircle, TrendingUp, Target,
  UserCheck, Play, GitBranch, MessageSquare, Building2, Activity,
  Receipt, Mic, Brain, Database, Webhook,
}

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Home
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { role } = useRBAC(null)

  const shell = role ? getRoleShell(role) : 'agent'
  const allItems = useMemo(() => getAllNavItems(shell), [shell])

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems
    const q = query.toLowerCase()
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    )
  }, [query, allItems])

  // Reset selection on filter change
  useEffect(() => { setSelectedIndex(0) }, [filtered])

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const navigate = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault()
      navigate(filtered[selectedIndex].href)
    }
  }, [filtered, selectedIndex, navigate])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm bg-transparent border-none focus:ring-0 focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            <kbd className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-72 overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No pages matching &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((item, i) => {
                const Icon = getIcon(item.icon)
                return (
                  <button
                    key={item.href}
                    data-index={i}
                    onClick={() => navigate(item.href)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selectedIndex
                        ? 'bg-gray-100 dark:bg-gray-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{item.label}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{item.href}</span>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-200 dark:border-gray-800 text-[10px] text-gray-400">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        </div>
      </div>
    </>
  )
}
