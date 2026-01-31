'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

/**
 * CallVolumeChart - Professional Design System v3.0
 * 
 * Line chart showing call volume over time with completed/failed breakdown
 * Uses navy primary for total, green for completed, red for failed
 * Clean, data-first design following Tableau principles
 */

interface CallVolumeChartProps {
  data: Array<{
    date: string
    total: number
    completed: number
    failed: number
  }>
}

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Volume</h3>
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-sm text-gray-500">No data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Volume</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
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
            allowDecimals={false}
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
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
            iconType="line"
          />
          <Line 
            type="monotone" 
            dataKey="total" 
            stroke="#1E3A5F" 
            strokeWidth={2}
            name="Total Calls"
            dot={{ fill: '#1E3A5F', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line 
            type="monotone" 
            dataKey="completed" 
            stroke="#059669" 
            strokeWidth={2}
            name="Completed"
            dot={{ fill: '#059669', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line 
            type="monotone" 
            dataKey="failed" 
            stroke="#DC2626" 
            strokeWidth={2}
            name="Failed"
            dot={{ fill: '#DC2626', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CallVolumeChart
