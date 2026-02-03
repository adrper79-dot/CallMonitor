"use client"

import React from 'react'

type TooltipProps = {
  children: React.ReactNode
  content?: React.ReactNode
}

export function Tooltip({ children, content }: TooltipProps) {
  if (content) {
    return (
      <div className="relative inline-block group">
        <div className="inline-block">{children}</div>
        <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute z-10 mt-2 left-1/2 -translate-x-1/2 w-max bg-slate-800 text-white text-xs rounded px-2 py-1">
          {content}
        </div>
      </div>
    )
  }
  return <div className="inline-block">{children}</div>
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function TooltipTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  // if asChild, render children directly so callers can control the element
  if (asChild && React.isValidElement(children)) return children as React.ReactElement
  return <span>{children}</span>
}

export function TooltipContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none opacity-100 transition-opacity absolute z-10 mt-2 left-1/2 -translate-x-1/2 w-max bg-slate-800 text-white text-xs rounded px-2 py-1">
      {children}
    </div>
  )
}

export default Tooltip
