'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

/**
 * SentimentChart - Professional Design System v3.0
 * 
 * Stacked area chart showing sentiment distribution over time
 * Green for positive, blue for neutral, red for negative
 * Clean, data-first design following Tableau principles
 */

interface SentimentChartProps {
  data: Array<{
    date: string
    positive_rate: number
    neutral_rate: number
    negative_rate: number
  }>
}

export function SentimentChart({ data }: SentimentChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Trends</h3>
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-sm text-gray-500">No sentiment data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
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
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
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
            formatter={(value: number | undefined) => value !== undefined ? `${value.toFixed(1)}%` : ''}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
          />
          <Area 
            type="monotone" 
            dataKey="positive_rate" 
            stackId="1"
            stroke="#059669" 
            fill="#D1FAE5"
            name="Positive"
          />
          <Area 
            type="monotone" 
            dataKey="neutral_rate" 
            stackId="1"
            stroke="#2563EB" 
            fill="#DBEAFE"
            name="Neutral"
          />
          <Area 
            type="monotone" 
            dataKey="negative_rate" 
            stackId="1"
            stroke="#DC2626" 
            fill="#FEE2E2"
            name="Negative"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SentimentChart
