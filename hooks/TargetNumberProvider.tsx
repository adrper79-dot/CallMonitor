"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

interface TargetNumberContextValue {
    targetNumber: string
    setTargetNumber: (number: string) => void
    isValid: boolean
}

const TargetNumberContext = createContext<TargetNumberContextValue | undefined>(undefined)

const STORAGE_KEY = 'voice-target-number'

export function TargetNumberProvider({ children }: { children: React.ReactNode }) {
    const [targetNumber, setTargetNumberState] = useState('')

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            setTargetNumberState(stored)
        }
    }, [])

    // Persist to localStorage when changed
    const setTargetNumber = (number: string) => {
        setTargetNumberState(number)
        if (number) {
            localStorage.setItem(STORAGE_KEY, number)
        } else {
            localStorage.removeItem(STORAGE_KEY)
        }
    }

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
