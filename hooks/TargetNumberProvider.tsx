"use client"

import React, { createContext, useContext, useState } from 'react'

interface TargetNumberContextValue {
    targetNumber: string
    setTargetNumber: (number: string) => void
    isValid: boolean
}

const TargetNumberContext = createContext<TargetNumberContextValue | undefined>(undefined)

export function TargetNumberProvider({ children }: { children: React.ReactNode }) {
    const [targetNumber, setTargetNumber] = useState('')

    // E.164 format validation
    const isValid = /^\+[1-9]\d{1,14}$/.test(targetNumber)

    return (
        <TargetNumberContext.Provider value={{ targetNumber, setTargetNumber, isValid }}>
            {children}
        </TargetNumberContext.Provider>
    )
}

export function useTargetNumber() {
    const context = useContext(TargetNumberContext)
    if (!context) {
        throw new Error('useTargetNumber must be used within a TargetNumberProvider')
    }
    return context
}
