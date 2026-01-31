import React from 'react'
import { Lock } from 'lucide-react'
import Link from 'next/link'

interface ProtectedGateProps {
    title?: string
    description?: string
    redirectUrl?: string
}

/**
 * ProtectedGate - Professional Design System v3.0
 * 
 * Friendly, branded authentication gate.
 * Replaces raw "Sign in" screens with a trusted UI.
 */
export function ProtectedGate({
    title = "Sign in required",
    description = "Please sign in to access this secure area.",
    redirectUrl = "/voice-operations"
}: ProtectedGateProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md text-center">
                {/* Icon Circle */}
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
                    <Lock className="h-8 w-8 text-primary-600" strokeWidth={1.5} />
                </div>

                {/* Content */}
                <h2 className="mb-2 text-2xl font-semibold text-gray-900 tracking-tight">
                    {title}
                </h2>
                <p className="mb-8 text-gray-500 text-base leading-relaxed">
                    {description}
                </p>

                {/* Actions */}
                <div className="space-y-4">
                    <a
                        href={`/signin?callbackUrl=${encodeURIComponent(redirectUrl)}`}
                        className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    >
                        Sign In with Email
                    </a>

                    <p className="text-sm text-gray-500">
                        Don't have an account?{' '}
                        <Link
                            href="/signup"
                            className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                        >
                            Create one
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
