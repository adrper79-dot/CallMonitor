"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

interface OnboardingWizardProps {
  organizationId: string | null
  onComplete: (config: OnboardingConfig) => void
  onSkip: () => void
}

export interface OnboardingConfig {
  targetNumber: string
  targetName?: string
  fromNumber?: string
  record: boolean
  transcribe: boolean
}

type Step = 'setup' | 'ready'

/**
 * OnboardingWizard - Simplified First-Call Setup
 * 
 * Steve Jobs principle: "Simple can be harder than complex"
 * Reduced from 4 steps to 2 for maximum conversion.
 * 
 * Step 1: Enter phone number (with optional name)
 * Step 2: Review & Place Call (recording/transcription enabled by default)
 * 
 * Professional Design System v3.0
 */
export function OnboardingWizard({ organizationId, onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('setup')
  const [config, setConfig] = useState<OnboardingConfig>({
    targetNumber: '',
    targetName: '',
    fromNumber: '',
    record: true,       // Default ON - this is our core value
    transcribe: true,   // Default ON - this is our core value
  })
  const [error, setError] = useState<string | null>(null)

  const validatePhoneNumber = (number: string): boolean => {
    const e164Regex = /^\+[1-9]\d{1,14}$/
    return e164Regex.test(number)
  }

  const formatPhoneHint = (value: string): string | null => {
    // Help users format correctly
    if (value && !value.startsWith('+')) {
      return 'Add + and country code (e.g., +1 for US)'
    }
    return null
  }

  const handleNext = () => {
    setError(null)

    if (step === 'setup') {
      if (!config.targetNumber) {
        setError('Please enter a phone number')
        return
      }
      if (!validatePhoneNumber(config.targetNumber)) {
        setError('Please use E.164 format (e.g., +12025551234)')
        return
      }
      // Optional: validate fromNumber if provided
      if (config.fromNumber && !validatePhoneNumber(config.fromNumber)) {
        setError('Your number should be in E.164 format (e.g., +12025551234)')
        return
      }
      setStep('ready')
    } else if (step === 'ready') {
      onComplete(config)
    }
  }

  const handleBack = () => {
    setError(null)
    if (step === 'ready') {
      setStep('setup')
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-primary-50 px-6 py-4 border-b border-primary-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {step === 'setup' ? 'Set Up Your First Call' : 'Ready to Call'}
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {step === 'setup' 
                  ? 'Enter the number you want to call' 
                  : 'Review and place your first call'
                }
              </p>
            </div>
            <button
              onClick={onSkip}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip
            </button>
          </div>
        </div>

        {/* Simple Progress - 2 steps */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div 
              className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${step === 'ready' ? 'bg-success text-white' : 'bg-primary-600 text-white'}
              `}
            >
              {step === 'ready' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : '1'}
            </div>
            <div className={`flex-1 h-1 rounded ${step === 'ready' ? 'bg-success' : 'bg-gray-200'}`} />
            <div 
              className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${step === 'ready' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'}
              `}
            >
              2
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-error-light border border-red-200 rounded-md text-error text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Step 1: Setup - Combined target + optional caller ID */}
          {step === 'setup' && (
            <div className="space-y-5">
              <div>
                <Input
                  label="Phone Number to Call *"
                  type="tel"
                  value={config.targetNumber}
                  onChange={(e) => setConfig({ ...config, targetNumber: e.target.value })}
                  placeholder="+12025551234"
                  hint={formatPhoneHint(config.targetNumber) || "E.164 format (include country code)"}
                  autoFocus
                />
              </div>
              
              <Input
                label="Name (optional)"
                value={config.targetName || ''}
                onChange={(e) => setConfig({ ...config, targetName: e.target.value })}
                placeholder="e.g., Main Support Line"
                hint="For your reference"
              />

              {/* Collapsible advanced option */}
              <details className="group">
                <summary className="text-sm text-primary-600 cursor-pointer hover:text-primary-700 flex items-center gap-1">
                  <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Add your phone number (for bridge calls)
                </summary>
                <div className="mt-3 pl-5">
                  <Input
                    label="Your Phone Number"
                    type="tel"
                    value={config.fromNumber || ''}
                    onChange={(e) => setConfig({ ...config, fromNumber: e.target.value })}
                    placeholder="+12025559876"
                    hint="We'll call you first, then connect to target"
                  />
                </div>
              </details>
            </div>
          )}

          {/* Step 2: Ready - Confirm and call */}
          {step === 'ready' && (
            <div className="space-y-4">
              {/* Call summary card */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Calling:</span>
                  <div className="text-right">
                    <p className="text-base font-mono font-medium text-gray-900">{config.targetNumber}</p>
                    {config.targetName && (
                      <p className="text-sm text-gray-500">{config.targetName}</p>
                    )}
                  </div>
                </div>

                {config.fromNumber && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-500">Via bridge:</span>
                    <span className="text-sm font-mono text-gray-900">{config.fromNumber}</span>
                  </div>
                )}
              </div>

              {/* Evidence options - inline toggles */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Evidence Capture</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, record: !config.record })}
                    className={`
                      flex-1 p-3 rounded-lg border-2 transition-all
                      ${config.record 
                        ? 'border-success bg-success/5' 
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Record</span>
                      <Switch
                        checked={config.record}
                        onCheckedChange={(checked) => setConfig({ ...config, record: checked })}
                      />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, transcribe: !config.transcribe })}
                    className={`
                      flex-1 p-3 rounded-lg border-2 transition-all
                      ${config.transcribe 
                        ? 'border-success bg-success/5' 
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Transcribe</span>
                      <Switch
                        checked={config.transcribe}
                        onCheckedChange={(checked) => setConfig({ ...config, transcribe: checked })}
                      />
                    </div>
                  </button>
                </div>
              </div>

              {/* Trust badge */}
              <div className="flex items-center gap-2 text-xs text-gray-500 pt-2">
                <Badge variant="secondary" className="text-xs">
                  Immutable Evidence
                </Badge>
                <span>All calls create court-ready records</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
          {step === 'ready' && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button 
            variant="primary" 
            onClick={handleNext}
            className="flex-1"
          >
            {step === 'ready' ? (
              <span className="flex items-center justify-center gap-2">
                <span></span> Place Call
              </span>
            ) : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
