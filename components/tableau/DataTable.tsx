'use client'

import React from 'react'

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (row: T) => string | number
  onRowClick?: (row: T) => void
  selectedKey?: string | number
  className?: string
}

/**
 * DataTable - Tableau-style clean data table
 * Subtle borders, clean rows, professional appearance
 */
export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  selectedKey,
  className = ''
}: DataTableProps<T>) {
  return (
    <div className={`bg-white border border-[#E5E5E5] rounded overflow-hidden ${className}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#FAFAFA] border-b-2 border-[#D0D0D0]">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`px-4 py-3 text-xs font-semibold text-[#333333] uppercase tracking-wide ${
                  col.align === 'right' ? 'text-right' :
                  col.align === 'center' ? 'text-center' :
                  'text-left'
                } ${col.className || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0F0F0]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[#999999] text-sm">
                No data available
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const key = keyExtractor(row)
              const isSelected = selectedKey === key
              
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      onRowClick(row)
                    }
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  aria-selected={isSelected}
                  className={`
                    border-b border-[#F0F0F0] transition-colors
                    ${onRowClick ? 'cursor-pointer hover:bg-[#F8F8F8] focus:outline-none focus:ring-2 focus:ring-[#C4001A] focus:ring-inset' : ''}
                    ${isSelected ? 'bg-[#E3F2FD]' : ''}
                  `}
                >
                  {columns.map((col, idx) => {
                    const content = col.render 
                      ? col.render(row)
                      : (col.key as string).split('.').reduce((obj: any, k) => obj?.[k], row)
                    
                    return (
                      <td
                        key={idx}
                        className={`px-4 py-3 text-sm text-[#333333] ${
                          col.align === 'right' ? 'text-right' :
                          col.align === 'center' ? 'text-center' :
                          'text-left'
                        } ${col.className || ''}`}
                      >
                        {content ?? '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
