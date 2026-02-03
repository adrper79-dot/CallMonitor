"use client"

import React from 'react'
import { Phone, PhoneIncoming, Activity, Calendar } from 'lucide-react'

export type MobileTab = 'dial' | 'calls' | 'activity'

interface MobileBottomNavProps {
    currentTab: MobileTab
    onTabChange: (tab: MobileTab) => void
    callsCount: number
    onScheduleClick: () => void
}

/**
 * MobileBottomNav - Professional Design System v3.0
 * 
 * Persistent bottom navigation for mobile viewport.
 * Uses Lucide icons and standard semantic colors.
 */
export function MobileBottomNav({
    currentTab,
    onTabChange,
    callsCount,
    onScheduleClick
}: MobileBottomNavProps) {

    const navItems = [
        { id: 'dial' as MobileTab, label: 'Dial', icon: Phone },
        { id: 'calls' as MobileTab, label: 'Calls', icon: PhoneIncoming },
        { id: 'activity' as MobileTab, label: 'Activity', icon: Activity },
    ]

    return (
        <nav className="flex border-t border-gray-200 bg-white safe-area-bottom">
            {navItems.map((item) => {
                const isActive = currentTab === item.id
                const Icon = item.icon

                return (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`
              flex-1 flex flex-col items-center py-3 px-2 min-h-[56px] transition-colors relative
              ${isActive ? 'text-primary-600 bg-primary-50' : 'text-gray-500 hover:bg-gray-50'}
            `}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <Icon className="w-5 h-5 mb-1" strokeWidth={2} />
                        <span className="text-xs font-medium">{item.label}</span>

                        {/* Notification Badge for Calls */}
                        {item.id === 'calls' && callsCount > 0 && (
                            <span className="absolute top-2 right-1/4 bg-primary-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                                {callsCount > 9 ? '9+' : callsCount}
                            </span>
                        )}
                    </button>
                )
            })}

            {/* Schedule Action - Distinct from tabs */}
            <button
                onClick={onScheduleClick}
                className="flex-1 flex flex-col items-center py-3 px-2 min-h-[56px] text-gray-500 hover:bg-gray-50 transition-colors"
            >
                <Calendar className="w-5 h-5 mb-1" strokeWidth={2} />
                <span className="text-xs font-medium">Schedule</span>
            </button>
        </nav>
    )
}
