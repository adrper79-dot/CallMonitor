'use client'

import React from 'react'

/**
 * Skeleton primitives — building blocks for loading states.
 * 
 * Design: Dieter Rams — reduce to the essential. 
 * Consistent pulse animation. No spinners, no "Loading..." text.
 * Match the spatial rhythm of the content they replace.
 */

/** Base skeleton block with shimmer */
function SkeletonBase({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-gray-200 rounded-md animate-pulse ${className}`}
      aria-hidden="true"
    />
  )
}

/** Skeleton for MetricCard in dashboard */
export function SkeletonMetricCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
      <SkeletonBase className="h-3 w-20" />
      <SkeletonBase className="h-8 w-16" />
      <SkeletonBase className="h-2.5 w-24" />
    </div>
  )
}

/** Skeleton for a row in a list (call list, queue, etc.) */
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-gray-50">
      <SkeletonBase className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <SkeletonBase className="h-3.5 w-3/5" />
        <SkeletonBase className="h-2.5 w-2/5" />
      </div>
      <SkeletonBase className="h-5 w-16 rounded-full" />
    </div>
  )
}

/** Skeleton for the full dashboard page */
export function SkeletonDashboard() {
  return (
    <div className="space-y-8" aria-label="Loading dashboard" role="status">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <SkeletonMetricCard key={i} />)}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="space-y-4">
          <SkeletonBase className="h-5 w-28" />
          <SkeletonBase className="h-12 w-full" />
          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
            {[1, 2, 3].map(i => <SkeletonBase key={i} className="h-10 w-full" />)}
          </div>
        </div>

        {/* Recent Calls */}
        <div className="space-y-4">
          <SkeletonBase className="h-5 w-24" />
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            {[1, 2, 3, 4, 5].map(i => <SkeletonListItem key={i} />)}
          </div>
        </div>

        {/* Intelligence */}
        <div className="space-y-4">
          <SkeletonBase className="h-5 w-24" />
          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-4">
            <SkeletonBase className="h-4 w-28" />
            <SkeletonBase className="h-3 w-full" />
            <SkeletonBase className="h-2 w-3/4" />
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between">
                <SkeletonBase className="h-3 w-20" />
                <SkeletonBase className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">Loading dashboard...</span>
    </div>
  )
}

/** Skeleton for the Voice Operations cockpit */
export function SkeletonVoiceOps() {
  return (
    <div className="flex h-screen bg-gray-50" aria-label="Loading voice operations" role="status">
      {/* Left Rail */}
      <div className="hidden lg:block w-72 border-r border-gray-200 bg-white p-4 space-y-4">
        <SkeletonBase className="h-8 w-full" />
        {[1, 2, 3, 4, 5].map(i => <SkeletonListItem key={i} />)}
      </div>

      {/* Center */}
      <div className="flex-1 p-6 space-y-6">
        <SkeletonBase className="h-10 w-full max-w-md" />
        <div className="bg-white border border-gray-200 rounded-md p-6 space-y-4">
          <SkeletonBase className="h-4 w-32" />
          <SkeletonBase className="h-12 w-full" />
          <SkeletonBase className="h-10 w-40" />
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
          <SkeletonBase className="h-4 w-24" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <SkeletonBase key={i} className="h-8 w-full" />)}
          </div>
        </div>
      </div>

      {/* Right Rail */}
      <div className="hidden lg:block w-72 border-l border-gray-200 bg-white p-4 space-y-4">
        <SkeletonBase className="h-4 w-24" />
        {[1, 2, 3].map(i => <SkeletonListItem key={i} />)}
        <SkeletonBase className="h-4 w-20 mt-4" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-2 py-2">
            <SkeletonBase className="w-2 h-2 rounded-full" />
            <SkeletonBase className="h-3 flex-1" />
            <SkeletonBase className="h-2.5 w-10" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading voice operations...</span>
    </div>
  )
}

/** Skeleton for Settings page */
export function SkeletonSettings() {
  return (
    <div className="space-y-8" aria-label="Loading settings" role="status">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6 space-y-2">
        <SkeletonBase className="h-7 w-24" />
        <SkeletonBase className="h-4 w-40" />
      </div>

      {/* Tab bar */}
      <div className="px-6">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <SkeletonBase key={i} className="h-9 w-28 rounded-md" />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 space-y-6">
        <div className="bg-white border border-gray-200 rounded-md p-6 space-y-4">
          <SkeletonBase className="h-5 w-32" />
          <SkeletonBase className="h-3 w-64" />
          <div className="space-y-3 mt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4">
                <SkeletonBase className="h-10 flex-1" />
                <SkeletonBase className="h-10 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">Loading settings...</span>
    </div>
  )
}

/** Generic inline skeleton for single-section loading */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3" role="status">
      <SkeletonBase className="h-4 w-28" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  )
}

export default {
  SkeletonMetricCard,
  SkeletonListItem,
  SkeletonDashboard,
  SkeletonVoiceOps,
  SkeletonSettings,
  SkeletonCard,
}
