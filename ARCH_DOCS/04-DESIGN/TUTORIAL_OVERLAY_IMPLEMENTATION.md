# Tutorial Overlay Implementation Guide

**Status:** Ready for Implementation  
**Estimated Effort:** 4-6 hours  
**Dependencies:** None (pure React implementation)

---

## Overview

A spotlight-style tutorial tour that guides new users through the interface. Similar to Slack, Notion, and Linear onboarding experiences.

---

## Architecture

### Component Structure

```
components/
  tour/
    ProductTour.tsx          # Main tour orchestrator
    TourStep.tsx             # Individual spotlight step
    TourTooltip.tsx          # Tooltip with content
    TourProgress.tsx         # Step indicator (1 of 5)
    useTour.tsx              # Tour state management hook
    tourDefinitions.ts       # Tour step definitions per page
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  localStorage                                                │
│  "tour_completed_voice" = true/false                        │
│  "tour_completed_dashboard" = true/false                    │
└───────────────────────────────────────────────────────────┬─┘
                                                            │
┌─────────────────────────────────────────────────────────────┐
│  useTour(tourId)                                            │
│  ├─ currentStep: number                                     │
│  ├─ isActive: boolean                                       │
│  ├─ next(): void                                            │
│  ├─ prev(): void                                            │
│  ├─ skip(): void                                            │
│  └─ restart(): void                                         │
└───────────────────────────────────────────────────────────┬─┘
                                                            │
┌─────────────────────────────────────────────────────────────┐
│  ProductTour                                                │
│  ├─ Renders TourStep for current step                      │
│  ├─ Handles keyboard navigation (Esc to skip)              │
│  └─ Auto-starts for new users                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation

### Step 1: Create useTour Hook

```tsx
// components/tour/useTour.tsx
"use client"

import { useState, useEffect, useCallback } from 'react'

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
```

### Step 2: Create TourStep Component

```tsx
// components/tour/TourStep.tsx
"use client"

import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface TourStepProps {
  targetSelector: string
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  currentStep: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  isFirst: boolean
  isLast: boolean
}

export function TourStep({
  targetSelector,
  title,
  content,
  position = 'bottom',
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  isFirst,
  isLast,
}: TourStepProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Find target element
    const target = document.querySelector(targetSelector)
    if (target) {
      const rect = target.getBoundingClientRect()
      setTargetRect(rect)
      
      // Scroll into view if needed
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip()
      if (e.key === 'ArrowRight') onNext()
      if (e.key === 'ArrowLeft' && !isFirst) onPrev()
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [targetSelector, onSkip, onNext, onPrev, isFirst])

  if (!mounted || !targetRect) return null

  // Calculate tooltip position
  const padding = 12
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10001,
  }

  switch (position) {
    case 'bottom':
      tooltipStyle.top = targetRect.bottom + padding
      tooltipStyle.left = targetRect.left + targetRect.width / 2
      tooltipStyle.transform = 'translateX(-50%)'
      break
    case 'top':
      tooltipStyle.bottom = window.innerHeight - targetRect.top + padding
      tooltipStyle.left = targetRect.left + targetRect.width / 2
      tooltipStyle.transform = 'translateX(-50%)'
      break
    case 'left':
      tooltipStyle.top = targetRect.top + targetRect.height / 2
      tooltipStyle.right = window.innerWidth - targetRect.left + padding
      tooltipStyle.transform = 'translateY(-50%)'
      break
    case 'right':
      tooltipStyle.top = targetRect.top + targetRect.height / 2
      tooltipStyle.left = targetRect.right + padding
      tooltipStyle.transform = 'translateY(-50%)'
      break
  }

  return createPortal(
    <>
      {/* Overlay with spotlight cutout */}
      <div className="fixed inset-0 z-[10000] pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.5)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      </div>

      {/* Spotlight border */}
      <div
        className="fixed z-[10000] border-2 border-primary-600 rounded-lg pointer-events-none"
        style={{
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          boxShadow: '0 0 0 4px rgba(30, 58, 95, 0.2)',
        }}
      />

      {/* Tooltip */}
      <div
        style={tooltipStyle}
        className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80 pointer-events-auto"
      >
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Skip tour
          </button>
        </div>

        {/* Content */}
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {content}
        </p>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={onPrev}
            disabled={isFirst}
            className={`px-3 py-1.5 text-sm rounded-md ${
              isFirst
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
```

### Step 3: Create Tour Definitions

```tsx
// components/tour/tourDefinitions.ts

export interface TourStepDefinition {
  targetSelector: string
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export const VOICE_TOUR: TourStepDefinition[] = [
  {
    targetSelector: '[data-tour="target-selector"]',
    title: 'Choose Who to Call',
    content: 'Select a saved target or enter a phone number directly. Recent numbers appear below for quick access.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="call-options"]',
    title: 'Configure Your Call',
    content: 'Enable recording, transcription, and other features. Click to expand and see all options.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="place-call"]',
    title: 'Place Your Call',
    content: 'Once configured, click here to start the call. You\'ll see real-time status updates.',
    position: 'top',
  },
  {
    targetSelector: '[data-tour="call-list"]',
    title: 'Call History',
    content: 'All your calls appear here. Click any call to see details, transcripts, and recordings.',
    position: 'right',
  },
  {
    targetSelector: '[data-tour="activity-feed"]',
    title: 'Activity Feed',
    content: 'Real-time updates on call progress, transcription status, and more.',
    position: 'left',
  },
]

export const DASHBOARD_TOUR: TourStepDefinition[] = [
  {
    targetSelector: '[data-tour="metrics"]',
    title: 'Your Metrics',
    content: 'Key stats at a glance: total calls, sentiment scores, and scheduled calls.',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="quick-actions"]',
    title: 'Quick Actions',
    content: 'Common tasks are one click away. Start a new call or schedule one for later.',
    position: 'right',
  },
  {
    targetSelector: '[data-tour="recent-calls"]',
    title: 'Recent Activity',
    content: 'Jump back into any recent call to review recordings and transcripts.',
    position: 'left',
  },
]

export const SETTINGS_TOUR: TourStepDefinition[] = [
  {
    targetSelector: '[data-tour="settings-tabs"]',
    title: 'Settings Categories',
    content: 'Settings are organized by task: Call Configuration, AI features, Quality Assurance, Team, and Billing.',
    position: 'bottom',
  },
]
```

### Step 4: Create ProductTour Component

```tsx
// components/tour/ProductTour.tsx
"use client"

import React from 'react'
import { useTour } from './useTour'
import { TourStep } from './TourStep'
import { TourStepDefinition } from './tourDefinitions'

interface ProductTourProps {
  tourId: string
  steps: TourStepDefinition[]
  autoStart?: boolean
}

export function ProductTour({ tourId, steps, autoStart = true }: ProductTourProps) {
  const {
    currentStep,
    isActive,
    next,
    prev,
    skip,
  } = useTour(tourId, steps.length)

  if (!isActive || steps.length === 0) return null

  const step = steps[currentStep]

  return (
    <TourStep
      targetSelector={step.targetSelector}
      title={step.title}
      content={step.content}
      position={step.position}
      currentStep={currentStep}
      totalSteps={steps.length}
      onNext={next}
      onPrev={prev}
      onSkip={skip}
      isFirst={currentStep === 0}
      isLast={currentStep === steps.length - 1}
    />
  )
}

export default ProductTour
```

### Step 5: Add Tour Trigger to AppShell

```tsx
// In components/layout/AppShell.tsx

// Add to navigation section:
<button
  onClick={() => {
    // Dispatch event to restart tour
    window.dispatchEvent(new CustomEvent('tour:restart'))
  }}
  className="text-sm text-gray-500 hover:text-gray-700"
  title="Show tour"
>
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
</button>
```

### Step 6: Integrate with Voice Page

```tsx
// In components/voice/VoiceOperationsClient.tsx

import { ProductTour } from '@/components/tour/ProductTour'
import { VOICE_TOUR } from '@/components/tour/tourDefinitions'

// Add data-tour attributes to target elements:
<div data-tour="target-selector">
  <TargetCampaignSelector ... />
</div>

<section data-tour="call-options">
  {/* Call options content */}
</section>

<div data-tour="place-call">
  <ExecutionControls ... />
</div>

<aside data-tour="call-list">
  <CallList ... />
</aside>

<aside data-tour="activity-feed">
  <ActivityFeedEmbed ... />
</aside>

// Add ProductTour component:
<ProductTour tourId="voice" steps={VOICE_TOUR} />
```

---

## CSS Requirements

Add to `globals.css`:

```css
/* Tour animations */
@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(30, 58, 95, 0.4);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(30, 58, 95, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(30, 58, 95, 0);
  }
}

.tour-spotlight {
  animation: pulse-ring 2s infinite;
}
```

---

## Testing Checklist

- [ ] Tour auto-starts for new users (localStorage empty)
- [ ] Tour doesn't start for returning users (localStorage set)
- [ ] "Skip tour" button works
- [ ] Navigation (Next/Back) works
- [ ] Keyboard navigation (Arrow keys, Escape)
- [ ] Tour completes and saves to localStorage
- [ ] "Restart tour" button in help menu works
- [ ] Spotlight follows target element
- [ ] Tooltip positions correctly for all positions
- [ ] Mobile responsiveness
- [ ] Scrolls target into view if off-screen
- [ ] Multiple tours (voice, dashboard, settings) work independently

---

## Security Considerations

1. **No user data in localStorage** - Only boolean completion flags
2. **No XSS risk** - All content is static, no dynamic HTML injection
3. **Escape key always works** - Users can never be trapped
4. **Accessible** - ARIA attributes, keyboard navigation

---

## Future Enhancements

1. **Video tooltips** - Embed short videos in tooltip content
2. **Conditional steps** - Show/hide steps based on user plan
3. **Analytics** - Track tour completion rates
4. **A/B testing** - Different tour content variants
5. **Interactive steps** - Require user to click target before proceeding
6. **Team visibility tour** - Guide users through activity feed + QA alerts
