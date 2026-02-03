'use client'

import { useState } from 'react'
import { ChatUI } from './ChatUI'

export function TroubleshootChatToggle() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <div className="fixed bottom-4 right-4 z-50">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-navy-900 text-white p-3 rounded-full shadow-lg hover:bg-navy-800 transition-colors border border-navy-700"
                    style={{ backgroundColor: '#0f172a' }} // Tailwind slate-900/navy fallback
                    aria-label="Toggle Stack Troubleshoot Bot"
                >
                    {/* Wrench/Tool Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="fixed bottom-20 right-4 z-50 w-[400px] h-[600px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col">
                    <div className="bg-[#0f172a] text-white p-3 flex justify-between items-center">
                        <h3 className="font-semibold text-sm">Stack Troubleshoot Bot</h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        <ChatUI endpoint="/api/chat/troubleshoot-stream" orgId="default" />
                    </div>
                </div>
            )}
        </>
    )
}
