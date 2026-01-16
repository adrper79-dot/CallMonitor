"use client"

import React, { createContext, useContext, ReactNode } from 'react'
import { useWebRTC, UseWebRTCResult } from './useWebRTC'

/**
 * WebRTC Provider
 * 
 * Provides WebRTC state to the component tree.
 * Per ARCH_DOCS: Context pattern for shared state.
 * 
 * Usage:
 * <WebRTCProvider organizationId={orgId}>
 *   <YourComponents />
 * </WebRTCProvider>
 * 
 * Then in child components:
 * const { connect, makeCall, status } = useWebRTCContext()
 */

const WebRTCContext = createContext<UseWebRTCResult | null>(null)

interface WebRTCProviderProps {
  organizationId: string | null
  children: ReactNode
}

export function WebRTCProvider({ organizationId, children }: WebRTCProviderProps) {
  const webrtc = useWebRTC(organizationId)
  
  return (
    <WebRTCContext.Provider value={webrtc}>
      {children}
    </WebRTCContext.Provider>
  )
}

/**
 * Hook to access WebRTC context
 * Must be used within WebRTCProvider
 */
export function useWebRTCContext(): UseWebRTCResult {
  const context = useContext(WebRTCContext)
  
  if (!context) {
    throw new Error('useWebRTCContext must be used within WebRTCProvider')
  }
  
  return context
}

/**
 * Hook that returns null if not within provider (safe version)
 */
export function useOptionalWebRTC(): UseWebRTCResult | null {
  return useContext(WebRTCContext)
}

export default WebRTCProvider
