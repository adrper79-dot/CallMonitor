"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { logger } from '@/lib/logger'

/**
 * Tour Step Component
 * 
 * Renders a spotlight overlay highlighting a target element
 * with a tooltip showing step content and navigation controls.
 * 
 * Per ARCH_DOCS/04-DESIGN/TUTORIAL_OVERLAY_IMPLEMENTATION.md
 */

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

  // Update target rect on resize/scroll
  const updateTargetRect = useCallback(() => {
    const target = document.querySelector(targetSelector)
    if (target) {
      const rect = target.getBoundingClientRect()
      setTargetRect(rect)
    }
  }, [targetSelector])

  useEffect(() => {
    setMounted(true)
    
    // Find target element with retry logic for dynamic content
    const findTarget = (attempt = 0) => {
      const target = document.querySelector(targetSelector)
      if (target) {
        const rect = target.getBoundingClientRect()
        setTargetRect(rect)
        
        // Scroll into view if needed
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (attempt < 3) {
        // Retry after short delay for dynamic content
        setTimeout(() => findTarget(attempt + 1), 200)
      } else {
        // Target not found after retries - skip to next step
        logger.warn('Tour: Target not found, skipping step', { targetSelector })
        onNext()
      }
    }
    
    findTarget()

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip()
      if (e.key === 'ArrowRight' || e.key === 'Enter') onNext()
      if (e.key === 'ArrowLeft' && !isFirst) onPrev()
    }
    
    // Update rect on window changes
    const handleResize = () => updateTargetRect()
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [targetSelector, onSkip, onNext, onPrev, isFirst, updateTargetRect])

  if (!mounted || !targetRect) return null

  // Calculate tooltip position
  const padding = 16
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10001,
  }

  // Adjust for viewport boundaries
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const tooltipWidth = 320

  switch (position) {
    case 'bottom':
      tooltipStyle.top = Math.min(targetRect.bottom + padding, viewportHeight - 200)
      tooltipStyle.left = Math.max(padding, Math.min(
        targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        viewportWidth - tooltipWidth - padding
      ))
      break
    case 'top':
      tooltipStyle.bottom = Math.min(viewportHeight - targetRect.top + padding, viewportHeight - 100)
      tooltipStyle.left = Math.max(padding, Math.min(
        targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        viewportWidth - tooltipWidth - padding
      ))
      break
    case 'left':
      tooltipStyle.top = Math.max(padding, targetRect.top + targetRect.height / 2 - 80)
      tooltipStyle.right = Math.max(padding, viewportWidth - targetRect.left + padding)
      break
    case 'right':
      tooltipStyle.top = Math.max(padding, targetRect.top + targetRect.height / 2 - 80)
      tooltipStyle.left = Math.min(targetRect.right + padding, viewportWidth - tooltipWidth - padding)
      break
  }

  return createPortal(
    <>
      {/* Overlay with spotlight cutout */}
      <div 
        className="fixed inset-0 z-[10000] pointer-events-none"
        aria-hidden="true"
      >
        <svg className="w-full h-full">
          <defs>
            <mask id={`spotlight-mask-${currentStep}`}>
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
            fill="rgba(0, 0, 0, 0.6)"
            mask={`url(#spotlight-mask-${currentStep})`}
          />
        </svg>
      </div>

      {/* Spotlight border with pulse animation */}
      <div
        className="fixed z-[10000] border-2 border-blue-500 rounded-lg pointer-events-none tour-spotlight"
        style={{
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
        }}
        aria-hidden="true"
      />

      {/* Click blocker (allows clicking the spotlight area) */}
      <div 
        className="fixed inset-0 z-[9999]"
        onClick={onSkip}
        aria-hidden="true"
      />

      {/* Tooltip */}
      <div
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-content"
        style={tooltipStyle}
        className="bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-80 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentStep
                      ? 'bg-blue-600'
                      : i < currentStep
                      ? 'bg-blue-300'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip tour
          </button>
        </div>

        {/* Content */}
        <h3 
          id="tour-title"
          className="text-base font-semibold text-gray-900 mb-2"
        >
          {title}
        </h3>
        <p 
          id="tour-content"
          className="text-sm text-gray-600 mb-5 leading-relaxed"
        >
          {content}
        </p>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={onPrev}
            disabled={isFirst}
            className={`px-3 py-2 text-sm rounded-md transition-colors ${
              isFirst
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            autoFocus
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>

        {/* Keyboard hint */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">→</kbd> for next, <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">Esc</kbd> to skip
          </p>
        </div>
      </div>
    </>,
    document.body
  )
}

export default TourStep
