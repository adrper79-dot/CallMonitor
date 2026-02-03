import { Logo } from '@/components/Logo'

/**
 * Dashboard Loading State
 * 
 * Shows loading skeleton while dashboard data loads.
 * Professional Design System v3.0
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-12 w-full bg-gray-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Center column */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 w-full bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="h-5 w-28 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 w-full bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
