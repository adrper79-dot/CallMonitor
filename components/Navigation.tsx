"use client"

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/voice', label: 'Voice Operations', icon: '📞' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
    { href: '/test', label: 'Tests', icon: '🧪' },
  ]

  return (
    <nav className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-slate-100">
              CallMonitor
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium
                    transition-colors duration-200
                    ${
                      isActive
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }
                  `}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* User Menu (Optional) */}
          <div className="flex items-center">
            <div className="text-sm text-slate-400">
              {/* Add user info here if needed */}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
