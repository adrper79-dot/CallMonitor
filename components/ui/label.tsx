"use client"

import React from 'react'

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & { children?: React.ReactNode }

export function Label({ children, className = '', ...rest }: LabelProps) {
  return (
    <label className={`text-sm font-medium ${className}`} {...rest}>
      {children}
    </label>
  )
}

export default Label
