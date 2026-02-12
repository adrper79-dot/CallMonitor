'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface Rebuttal {
  id: string
  category: string
  objection_text: string
  rebuttal_text: string
  compliance_note: string | null
  usage_count: number
  effectiveness: number | null
  created_at: string
}

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'financial', label: 'Financial' },
  { value: 'legal', label: 'Legal' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'stalling', label: 'Stalling' },
  { value: 'general', label: 'General' },
]

const CATEGORY_COLORS: Record<string, string> = {
  financial: 'bg-green-500/10 text-green-400',
  legal: 'bg-red-500/10 text-red-400',
  emotional: 'bg-purple-500/10 text-purple-400',
  stalling: 'bg-yellow-500/10 text-yellow-400',
  general: 'bg-blue-500/10 text-blue-400',
}

interface ObjectionLibraryProps {
  /** When true, show compact inline mode for use during active calls */
  compact?: boolean
  /** Callback when agent copies a rebuttal to clipboard/notes */
  onUseRebuttal?: (rebuttalText: string) => void
}

/**
 * ObjectionLibrary — Searchable objection rebuttal library with FDCPA compliance notes.
 *
 * Features:
 * - Category filtering
 * - Free-text search
 * - Usage tracking
 * - Compliance warnings
 * - CRUD management (non-compact mode)
 * - System defaults when org has no custom rebuttals
 */
export default function ObjectionLibrary({
  compact = false,
  onUseRebuttal,
}: ObjectionLibraryProps) {
  const [rebuttals, setRebuttals] = useState<Rebuttal[]>([])
  const [isDefaults, setIsDefaults] = useState(false)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [formCategory, setFormCategory] = useState('general')
  const [formObjection, setFormObjection] = useState('')
  const [formRebuttal, setFormRebuttal] = useState('')
  const [formCompliance, setFormCompliance] = useState('')

  const fetchRebuttals = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await apiGet(`/api/productivity/objection-rebuttals?${params.toString()}`)
      setRebuttals(res.rebuttals || [])
      setIsDefaults(res.isDefaults || false)
    } catch (err) {
      logger.error('ObjectionLibrary: fetch failed', err)
    } finally {
      setLoading(false)
    }
  }, [category, debouncedSearch])

  // Debounce search input — 300ms delay before firing API call
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetchRebuttals()
  }, [fetchRebuttals])

  const handleUse = async (rebuttal: Rebuttal) => {
    onUseRebuttal?.(rebuttal.rebuttal_text)
    // Track usage asynchronously
    if (!isDefaults) {
      apiPost(`/api/productivity/objection-rebuttals/${rebuttal.id}/use`).catch(() => {})
    }
  }

  const resetForm = () => {
    setFormCategory('general')
    setFormObjection('')
    setFormRebuttal('')
    setFormCompliance('')
    setEditingId(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!formObjection || !formRebuttal) return
    setSaving(true)

    try {
      const payload = {
        category: formCategory,
        objection_text: formObjection,
        rebuttal_text: formRebuttal,
        compliance_note: formCompliance || undefined,
      }

      if (editingId) {
        await apiPut(`/api/productivity/objection-rebuttals/${editingId}`, payload)
      } else {
        await apiPost('/api/productivity/objection-rebuttals', payload)
      }

      resetForm()
      await fetchRebuttals()
    } catch (err) {
      logger.error('ObjectionLibrary: save failed', err)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (rebuttal: Rebuttal) => {
    setEditingId(rebuttal.id)
    setFormCategory(rebuttal.category)
    setFormObjection(rebuttal.objection_text)
    setFormRebuttal(rebuttal.rebuttal_text)
    setFormCompliance(rebuttal.compliance_note || '')
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/api/productivity/objection-rebuttals/${id}`)
      await fetchRebuttals()
    } catch (err) {
      logger.error('ObjectionLibrary: delete failed', err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-700/50" />
        ))}
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-gray-700 bg-gray-800/50 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">
          Objection Rebuttals
          {isDefaults && (
            <span className="ml-2 text-xs font-normal text-gray-500">(system defaults)</span>
          )}
        </h3>
        {!compact && !isDefaults && (
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 hover:bg-blue-500/20"
          >
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search objections..."
          className="flex-1 rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Add/Edit Form */}
      {showForm && !compact && (
        <div className="mb-4 rounded-md border border-gray-600 bg-gray-700/50 p-3 space-y-2">
          <select
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white"
          >
            {CATEGORIES.filter((c) => c.value !== 'all').map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={formObjection}
            onChange={(e) => setFormObjection(e.target.value)}
            placeholder="Customer's objection..."
            className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-500"
          />
          <textarea
            value={formRebuttal}
            onChange={(e) => setFormRebuttal(e.target.value)}
            placeholder="Recommended response..."
            rows={3}
            className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-500 resize-none"
          />
          <input
            type="text"
            value={formCompliance}
            onChange={(e) => setFormCompliance(e.target.value)}
            placeholder="Compliance note (optional)..."
            className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="rounded-md px-3 py-1.5 text-xs text-gray-400 hover:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formObjection || !formRebuttal}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Rebuttals List */}
      <div className={`space-y-2 ${compact ? 'max-h-64' : 'max-h-96'} overflow-y-auto`}>
        {rebuttals.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">No rebuttals found</p>
        ) : (
          rebuttals.map((rebuttal) => (
            <div
              key={rebuttal.id}
              className="rounded-md border border-gray-600/50 bg-gray-700/30 p-3"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    CATEGORY_COLORS[rebuttal.category] || CATEGORY_COLORS.general
                  }`}
                >
                  {rebuttal.category}
                </span>
                {rebuttal.usage_count > 0 && (
                  <span className="text-xs text-gray-500">
                    Used {rebuttal.usage_count}×
                  </span>
                )}
              </div>

              <p className="mb-1 text-sm font-medium text-red-300">
                &ldquo;{rebuttal.objection_text}&rdquo;
              </p>
              <p className="mb-2 text-sm text-gray-300">{rebuttal.rebuttal_text}</p>

              {rebuttal.compliance_note && (
                <div className="mb-2 rounded-md bg-yellow-500/5 border border-yellow-500/20 px-2.5 py-1.5">
                  <p className="text-xs text-yellow-400">
                    ⚠️ {rebuttal.compliance_note}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUse(rebuttal)}
                  className="rounded-md bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400 hover:bg-green-500/20"
                >
                  Use This
                </button>
                {!compact && !isDefaults && (
                  <>
                    <button
                      onClick={() => handleEdit(rebuttal)}
                      className="rounded-md px-2 py-1 text-xs text-gray-400 hover:text-gray-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rebuttal.id)}
                      className="rounded-md px-2 py-1 text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
