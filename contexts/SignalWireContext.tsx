import { createContext, useContext, useRef, ReactNode } from 'react'

/**
 * SignalWire Context - Manages SDK instance state
 * 
 * Purpose: Provides isolated SignalWire SDK loading state per application instance.
 * Replaces module-level singleton to support concurrent rendering and testing.
 * 
 * ARCH_DOCS Compliance: UI state management layer only, not System of Record.
 * Data persistence handled by Supabase (per SYSTEM_OF_RECORD_COMPLIANCE.md).
 */

interface SignalWireContextValue {
    /**
     * Promise for SDK loading deduplication
     * Ensures SDK is only loaded once per context instance
     */
    sdkPromiseRef: React.MutableRefObject<Promise<any> | null>
}

const SignalWireContext = createContext<SignalWireContextValue | null>(null)

export function SignalWireProvider({ children }: { children: ReactNode }) {
    const sdkPromiseRef = useRef<Promise<any> | null>(null)

    return (
        <SignalWireContext.Provider value={{ sdkPromiseRef }}>
            {children}
        </SignalWireContext.Provider>
    )
}

export function useSignalWireContext() {
    const context = useContext(SignalWireContext)
    if (!context) {
        throw new Error('useSignalWireContext must be used within SignalWireProvider')
    }
    return context
}
