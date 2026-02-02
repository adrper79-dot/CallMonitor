"use client"
import React from "react"
import { SessionProvider } from "next-auth/react"

// Workers API URL for auth endpoints
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider 
      basePath={`${API_BASE}/api/auth`}
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  )
}
