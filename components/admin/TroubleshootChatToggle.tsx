'use client'

import { useState } from 'react'
import { ChatUI } from './ChatUI'

export function TroubleshootChatToggle() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            {/* FAB positioned above Bond AI button (bottom-24) */}
            <div className="fixed bottom-24 right-6 z-50">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-slate-700"
                    style={{ backgroundColor: '#0f172a' }}
                    aria-label="Toggle Stack Troubleshoot Bot"
                >
                    {/* Wrench/Tool Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="fixed bottom-40 right-6 z-50 w-[400px] h-[600px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                    <div className="bg-[#0f172a] text-white p-3 flex justify-between items-center">
                        <h3 className="font-semibold text-sm">Stack Troubleshoot Bot</h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        <ChatUI contextType="general" />
                    </div>
                </div>
            )}
        </>
    )
}
