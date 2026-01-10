"use client"

import React from 'react'

type TooltipProps = {
  content: React.ReactNode
  children: React.ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative inline-block group">
      <div className="inline-block">{children}</div>
      <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute z-10 mt-2 left-1/2 -translate-x-1/2 w-max bg-slate-800 text-white text-xs rounded px-2 py-1">
        {content}
      </div>
    </div>
  )
}

export default Tooltip
