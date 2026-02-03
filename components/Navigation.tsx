"use client"

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/components/AuthProvider'
import { Logo } from './Logo'

/**
 * Navigation - Professional Design System v3.0
 * 
 * Floating capsule nav with clean styling.
 * Hides protected links for unauthenticated users.
 */
export default function Navigation() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated'

  // Protected nav items - only shown when authenticated
  // Per ARCH_DOCS UX_DESIGN_PRINCIPLES: No emojis in professional UI
  const protectedNavItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/voice-operations', label: 'Calls' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/bookings', label: 'Schedule' },
    { href: '/settings', label: 'Settings' },
  ]

  // Public pages where we show minimal nav
  const isPublicPage = ['/', '/signin', '/signup', '/forgot-password', '/reset-password', '/pricing', '/trust'].includes(pathname || '')

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
                WORDIS BOND
              </span>
              <span className="text-[10px] tracking-[0.3em] text-[#C0C0C0]/60 uppercase">
                System of Record
              </span>
            </div>
          </Link>

          {/* Navigation Links - Only show for authenticated users */}
          {isAuthenticated && !isPublicPage && (
            <div
              className="flex items-center gap-1 p-1 rounded-full"
              style={{
                background: 'rgba(30, 30, 63, 0.5)',
                border: '1px solid rgba(0, 206, 209, 0.2)',
              }}
            >
              {protectedNavItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      relative px-4 py-3 min-h-[44px] rounded-full text-sm font-medium
                      transition-all duration-300 ease-out
                      flex items-center justify-center gap-2
                      ${isActive
                        ? 'text-[#0A0A1A]'
                        : 'text-[#FFF8E7]/70 hover:text-[#FFF8E7]'
                      }
                    `}
                    style={isActive ? {
                      background: '#1E3A5F',
                      boxShadow: '0 0 20px rgba(30, 58, 95, 0.4)',
                    } : {}}
                  >
                    {/* Hover glow effect for inactive items */}
                    {!isActive && (
                      <span
                        className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity"
                        style={{
                          background: 'rgba(30, 58, 95, 0.1)',
                        }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Status indicator - only show when authenticated */}
            {isAuthenticated && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1E3A5F] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1E3A5F]"></span>
                </span>
                <span className="text-xs text-[#6B7280] tracking-wider">ONLINE</span>
              </div>
            )}

            {/* Auth Link - contextual based on auth state */}
            {isAuthenticated ? (
              <Link
                href="/settings"
                className="btn-jetsons btn-ghost px-4 py-2 text-sm"
              >
                <span className="hidden sm:inline">Account</span>
              </Link>
            ) : (
              <Link
                href="/signin"
                className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-300"
                style={{
                  background: '#1E3A5F',
                  color: '#FFFFFF',
                  boxShadow: '0 0 20px rgba(30, 58, 95, 0.3)',
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        className="h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 206, 209, 0.5) 20%, rgba(197, 160, 69, 0.5) 50%, rgba(0, 206, 209, 0.5) 80%, transparent 100%)',
        }}
      />
    </nav>
  )
}
