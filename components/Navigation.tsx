"use client"

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './Logo'

/**
 * JETSONS-STYLE NAVIGATION
 * 
 * "Navigate your empire with the grace of a space-age captain."
 * 
 * Design: Floating capsule nav with orbital hover effects
 */
export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '🎛️' },
    { href: '/voice', label: 'Calls', icon: '📞' },
    { href: '/analytics', label: 'Analytics', icon: '📊' },
    { href: '/bookings', label: 'Schedule', icon: '📅' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <nav 
      className="fixed top-0 left-0 right-0 z-40 feng-fire"
      style={{
        background: 'linear-gradient(180deg, rgba(10, 10, 26, 0.95) 0%, rgba(10, 10, 26, 0.8) 100%)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <Logo size="sm" animated={false} />
            <div className="hidden sm:block">
              <span 
                className="font-display text-lg tracking-wider block leading-tight transition-all group-hover:tracking-widest"
                style={{
                  background: 'linear-gradient(135deg, #C5A045 0%, #00CED1 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                VOXSOUTH
              </span>
              <span className="text-[10px] tracking-[0.3em] text-[#C0C0C0]/60 uppercase">
                Voice Intelligence
              </span>
            </div>
          </Link>

          {/* Navigation Links - Capsule Style */}
          <div 
            className="flex items-center gap-1 p-1 rounded-full"
            style={{
              background: 'rgba(30, 30, 63, 0.5)',
              border: '1px solid rgba(0, 206, 209, 0.2)',
            }}
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative px-4 py-2 rounded-full text-sm font-medium
                    transition-all duration-300 ease-out
                    flex items-center gap-2
                    ${isActive 
                      ? 'text-[#0A0A1A]' 
                      : 'text-[#FFF8E7]/70 hover:text-[#FFF8E7]'
                    }
                  `}
                  style={isActive ? {
                    background: 'linear-gradient(135deg, #00CED1 0%, #40E0D0 100%)',
                    boxShadow: '0 0 20px rgba(0, 206, 209, 0.4)',
                  } : {}}
                >
                  {/* Hover glow effect for inactive items */}
                  {!isActive && (
                    <span 
                      className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity"
                      style={{
                        background: 'rgba(0, 206, 209, 0.1)',
                      }}
                    />
                  )}
                  <span className="relative z-10">{item.icon}</span>
                  <span className="relative z-10 hidden md:inline">{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Status indicator */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00CED1] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00CED1]"></span>
              </span>
              <span className="text-xs text-[#C0C0C0]/60 tracking-wider">ONLINE</span>
            </div>

            {/* Auth Link */}
            <Link
              href="/admin/auth"
              className="btn-jetsons btn-ghost px-4 py-2 text-sm"
            >
              <span className="mr-2">👤</span>
              <span className="hidden sm:inline">Account</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom accent line - Jetsons style */}
      <div 
        className="h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 206, 209, 0.5) 20%, rgba(197, 160, 69, 0.5) 50%, rgba(0, 206, 209, 0.5) 80%, transparent 100%)',
        }}
      />
    </nav>
  )
}
