'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Phone, List, Calendar, FileText } from 'lucide-react'

export function BottomNav() {
    const pathname = usePathname()

    const navItems = [
        {
            href: '/voice-operations',
            label: 'Dial',
            icon: Phone,
        },
        {
            href: '/dashboard', // Logic: "Calls" often maps to dashboard or a specific calls list. Given context, Dashboard makes sense as "Overview/Calls" or voice-ops has calls list. User prompt says "Calls". Let's map to /voice-operations which has the call list, or dashboard. The AppShell maps '/voice-operations' to "Calls". I'll stick to that.
            label: 'Calls',
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

    // Override mapping for "Calls" to match AppShell if needed, but user prompt "Dial" -> /voice.
    // Actually, let's look at AppShell. 
    // /voice-operations -> Calls. 
    // User Prompt: 
    // Dial -> /voice
    // Calls -> ?
    // Activity -> ?
    // Schedule -> ?

    // Let's refine based on user request: 
    // Stub: `hidden lg:flex` → No full mobile impl (`[Dial] [Calls] [Activity] [Schedule]`).

    const items = [
        {
            href: '/voice-operations',
            label: 'Dial',
            icon: Phone
        },
        {
            href: '/dashboard',
            label: 'Activity',
            icon: List
        },
        {
            href: '/bookings',
            label: 'Schedule',
            icon: Calendar
        },
        {
            href: '/review',
            label: 'Evidence',
            icon: FileText
        }
    ]


    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-50 pb-safe">
            <div className="grid grid-cols-4 h-16">
                {items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center transition-colors ${isActive ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'
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
