"use client"

import React from 'react'

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  header?: React.ReactNode
  footer?: React.ReactNode
}

export function Card({ children, className = '', header, footer, ...rest }: CardProps) {
  return (
    <div className={`bg-white border border-[#E5E5E5] rounded-lg shadow-sm hover:shadow-md hover:border-[#D0D0D0] transition-all duration-200 ${className}`} {...rest}>
      {header && (
        <div className="px-4 py-3 border-b border-[#E5E5E5]">
          {header}
        </div>
      )}
      <div className="px-4 py-3">
        {children}
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-[#E5E5E5]">
          {footer}
        </div>
      )}
    </div>
  )
}

export default Card
