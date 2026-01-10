import React from 'react'

export function Button(props: any) {
  return (
    <button {...props} className={(props.className || '') + ' px-3 py-1 rounded bg-indigo-600 text-white'}>{props.children}</button>
  )
}

export default Button
