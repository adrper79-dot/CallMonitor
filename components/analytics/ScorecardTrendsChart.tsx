'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

/**
 * ScorecardTrendsChart - Professional Design System v3.0
 *
 * Line chart showing scorecard average scores over time
 * Uses primary navy for average score line
 * Clean, data-first design following Tableau principles
 */

interface ScorecardTrendsChartProps {
  data: Array<{
    date: string
    count: number
    avg_score: number
  }>
}

export function ScorecardTrendsChart({ data }: ScorecardTrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Scorecard Trends</h3>
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-sm text-gray-500">No scorecard data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Scorecard Trends</h3>
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
            domain={[0, 100]}
            label={{ value: 'Score', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6B7280' } }}
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
            formatter={(value: any, name?: string) => {
              if (name === 'avg_score') {
                return [Math.round(value * 10) / 10, 'Avg Score']
              }
              return [value, name ?? '']
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="avg_score"
            stroke="#1E3A5F"
            strokeWidth={2}
            name="Average Score"
            dot={{ fill: '#1E3A5F', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#6366F1"
            strokeWidth={2}
            name="Scorecards"
            dot={{ fill: '#6366F1', r: 3 }}
            activeDot={{ r: 5 }}
            yAxisId="right"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: 'Count', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: '#6B7280' } }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ScorecardTrendsChart
