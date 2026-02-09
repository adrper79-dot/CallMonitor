'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Phone, List, Calendar, FileText } from 'lucide-react'

export function BottomNav() {
  const pathname = usePathname()

  const items = [
    {
      href: '/voice-operations',
      label: 'Dial',
      icon: Phone,
    },
    {
      href: '/dashboard',
      label: 'Activity',
      icon: List,
    },
    {
      href: '/bookings',
      label: 'Schedule',
      icon: Calendar,
    },
    {
      href: '/review',
      label: 'Evidence',
      icon: FileText,
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 lg:hidden z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4 h-16">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center transition-colors ${
                isActive ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className={`h-5 w-5 mb-1 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
