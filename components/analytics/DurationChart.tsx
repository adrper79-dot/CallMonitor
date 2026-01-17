'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

/**
 * DurationChart - Professional Design System v3.0
 * 
 * Bar chart showing call duration distribution
 * Groups calls into duration buckets for analysis
 * Clean, data-first design following Tableau principles
 */

interface DurationChartProps {
  data: Array<{
    date: string
    avg_duration: number
  }>
}

export function DurationChart({ data }: DurationChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Call Duration</h3>
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-sm text-gray-500">No duration data available</p>
        </div>
      </div>
    )
  }

  // Convert seconds to minutes for display
  const chartData = data.map(d => ({
    date: d.date,
    duration_minutes: Math.round(d.avg_duration / 60 * 10) / 10 // Round to 1 decimal
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Call Duration</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={(value) => {
              const date = new Date(value)
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6B7280' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#FFF', 
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              fontSize: '12px',
              padding: '8px 12px'
            }}
            labelFormatter={(value) => {
              const date = new Date(value)
              return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })
            }}
            formatter={(value: number | undefined) => value !== undefined ? [`${value} min`, 'Avg Duration'] : ['', '']}
          />
          <Bar 
            dataKey="duration_minutes" 
            fill="#1E3A5F"
            radius={[4, 4, 0, 0]}
            name="Avg Duration (min)"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default DurationChart
