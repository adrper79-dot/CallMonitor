"use client"

import React from 'react'

type SwitchProps = React.HTMLAttributes<HTMLButtonElement> & {
  checked?: boolean
  onChange?: (checked: boolean) => void
}

export function Switch({ checked = false, onChange, className = '', ...rest }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      className={`inline-flex items-center h-7 w-12 rounded-full p-1 ${checked ? 'bg-indigo-600' : 'bg-slate-700'} ${className}`}
      {...rest}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

export default Switch
