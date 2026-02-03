'use client'

import { useState } from 'react'

/**
 * DateRangePicker - Professional Design System v3.0
 * 
 * Date range selector with quick presets
 * Clean, professional design following architectural standards
 */

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [localStart, setLocalStart] = useState(startDate.slice(0, 10))
  const [localEnd, setLocalEnd] = useState(endDate.slice(0, 10))

  const presets = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'Last 365 days', days: 365 }
  ]

  const applyPreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    setLocalStart(start.toISOString().slice(0, 10))
    setLocalEnd(end.toISOString().slice(0, 10))
    onChange(start.toISOString(), end.toISOString())
  }

  const handleApply = () => {
    const start = new Date(localStart)
    const end = new Date(localEnd)
    onChange(start.toISOString(), end.toISOString())
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Date inputs */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input 
            id="start-date"
            type="date"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input 
            id="end-date"
            type="date"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          Apply
        </button>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2 mt-3">
        {presets.map(preset => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset.days)}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default DateRangePicker
