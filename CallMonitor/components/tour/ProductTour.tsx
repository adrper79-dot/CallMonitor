"use client"

import React from 'react'
import { useTour } from './useTour'
import { TourStep } from './TourStep'
import { TourStepDefinition } from './tourDefinitions'

/**
 * Product Tour Component
 * 
 * Main tour orchestrator that renders spotlight tutorial steps.
 * Auto-starts for new users, remembers completion state.
 * 
 * Usage:
 * <ProductTour tourId="voice" steps={VOICE_TOUR} />
 * 
 * Per ARCH_DOCS/04-DESIGN/TUTORIAL_OVERLAY_IMPLEMENTATION.md
 */

interface ProductTourProps {
  /** Unique identifier for this tour (used for localStorage key) */
  tourId: string
  /** Array of step definitions */
  steps: TourStepDefinition[]
  /** Whether to auto-start for new users (default: true) */
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

  // Don't render if tour is not active or no steps
  if (!isActive || steps.length === 0) return null

  const step = steps[currentStep]
  
  // Don't render if step is missing (safety check)
  if (!step) return null

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
