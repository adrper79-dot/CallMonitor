"use client"

import { useState, useEffect, useCallback } from 'react'

/**
 * Tour State Management Hook
 * 
 * Manages tutorial tour state with localStorage persistence.
 * Auto-starts tour for new users, remembers completion for returning users.
 * 
 * Per ARCH_DOCS/04-DESIGN/TUTORIAL_OVERLAY_IMPLEMENTATION.md
 */

interface TourState {
  currentStep: number
  isActive: boolean
  isCompleted: boolean
}

interface UseTourReturn extends TourState {
  next: () => void
  prev: () => void
  skip: () => void
  restart: () => void
  goToStep: (step: number) => void
}

export function useTour(tourId: string, totalSteps: number): UseTourReturn {
  const storageKey = `tour_completed_${tourId}`
  
  const [state, setState] = useState<TourState>({
    currentStep: 0,
    isActive: false,
    isCompleted: false,
  })

  // Check localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(storageKey) === 'true'
    setState(prev => ({
      ...prev,
      isCompleted: completed,
      isActive: !completed, // Auto-start if not completed
    }))
  }, [storageKey])

  // Listen for restart events
  useEffect(() => {
    const handleRestart = () => {
      localStorage.removeItem(storageKey)
      setState({ currentStep: 0, isActive: true, isCompleted: false })
    }
    
    window.addEventListener('tour:restart', handleRestart)
    return () => window.removeEventListener('tour:restart', handleRestart)
  }, [storageKey])

  const next = useCallback(() => {
    setState(prev => {
      if (prev.currentStep >= totalSteps - 1) {
        // Tour complete
        localStorage.setItem(storageKey, 'true')
        return { ...prev, isActive: false, isCompleted: true }
      }
      return { ...prev, currentStep: prev.currentStep + 1 }
    })
  }, [totalSteps, storageKey])

  const prev = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(0, prev.currentStep - 1),
    }))
  }, [])

  const skip = useCallback(() => {
    localStorage.setItem(storageKey, 'true')
    setState(prev => ({ ...prev, isActive: false, isCompleted: true }))
  }, [storageKey])

  const restart = useCallback(() => {
    localStorage.removeItem(storageKey)
    setState({ currentStep: 0, isActive: true, isCompleted: false })
  }, [storageKey])

  const goToStep = useCallback((step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(0, Math.min(totalSteps - 1, step)),
    }))
  }, [totalSteps])

  return {
    ...state,
    next,
    prev,
    skip,
    restart,
    goToStep,
  }
}

export default useTour
