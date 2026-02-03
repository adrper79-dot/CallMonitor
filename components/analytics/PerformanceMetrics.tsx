'use client'

import { MetricCard } from '@/components/tableau/MetricCard'
import { ProgressBar } from '@/components/tableau/ProgressBar'

/**
 * PerformanceMetrics - Professional Design System v3.0
 * 
 * Displays system performance metrics and feature usage
 * Clean, data-first design with metric cards and progress bars
 * Follows Professional Design System v3.0 patterns
 */

interface PerformanceMetricsProps {
  metrics: {
    transcription_rate: number
    translation_rate: number
    avg_transcription_time_seconds: number
    avg_recording_quality: number
    feature_usage: {
      voice_cloning: number
      surveys: number
      scorecards: number
      webhooks_sent: number
    }
  }
}

export function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  const maxUsage = Math.max(
    metrics.feature_usage.voice_cloning,
    metrics.feature_usage.surveys,
    metrics.feature_usage.scorecards,
    100 // Minimum scale
  )

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          label="Transcription Rate"
          value={`${metrics.transcription_rate}%`}
          trend={metrics.transcription_rate >= 90 ? 'up' : metrics.transcription_rate >= 70 ? 'neutral' : 'down'}
        />
        <MetricCard 
          label="Translation Rate"
          value={`${metrics.translation_rate}%`}
          trend={metrics.translation_rate >= 50 ? 'up' : 'neutral'}
        />
        <MetricCard 
          label="Avg Transcription Time"
          value={`${Math.round(metrics.avg_transcription_time_seconds)}s`}
          trend={metrics.avg_transcription_time_seconds <= 30 ? 'up' : 'neutral'}
        />
        <MetricCard 
          label="Webhooks Sent"
          value={metrics.feature_usage.webhooks_sent}
        />
      </div>

      {/* Feature Usage */}
      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Usage</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-700 font-medium">Voice Cloning</span>
              <span className="text-gray-900 font-semibold">{metrics.feature_usage.voice_cloning} uses</span>
            </div>
            <ProgressBar 
              label="" 
              value={(metrics.feature_usage.voice_cloning / maxUsage) * 100} 
              color="blue"
              showValue={false}
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-700 font-medium">Surveys</span>
              <span className="text-gray-900 font-semibold">{metrics.feature_usage.surveys} surveys</span>
            </div>
            <ProgressBar 
              label="" 
              value={(metrics.feature_usage.surveys / maxUsage) * 100} 
              color="green"
              showValue={false}
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-700 font-medium">Scorecards</span>
              <span className="text-gray-900 font-semibold">{metrics.feature_usage.scorecards} scored</span>
            </div>
            <ProgressBar 
              label="" 
              value={(metrics.feature_usage.scorecards / maxUsage) * 100} 
              color="orange"
              showValue={false}
            />
          </div>
        </div>
      </div>

      {/* System Health Indicator */}
      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            metrics.transcription_rate >= 90 ? 'bg-success' : 
            metrics.transcription_rate >= 70 ? 'bg-warning' : 'bg-error'
          }`} />
          <span className="text-sm text-gray-700">
            {metrics.transcription_rate >= 90 ? 'All systems operational' :
             metrics.transcription_rate >= 70 ? 'Minor performance issues' : 'Attention required'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Based on transcription success rate and processing times
        </p>
      </div>
    </div>
  )
}

export default PerformanceMetrics
