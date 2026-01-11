"use client"

import React from 'react'

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  header?: React.ReactNode
  footer?: React.ReactNode
}

export function Card({ children, className = '', header, footer, ...rest }: CardProps) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-md ${className}`} {...rest}>
      {header && (
        <div className="px-4 py-3 border-b border-slate-800">
          {header}
        </div>
      )}
      <div className="px-4 py-3">
        {children}
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-slate-800">
          {footer}
        </div>
      )}
    </div>
  )
}

export default Card
