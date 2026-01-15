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

type Step = 'target' | 'caller-id' | 'options' | 'confirm'

/**
 * OnboardingWizard - First-Call Setup
 * 
 * Guides new users through placing their first call.
 * Professional Design System v3.0
 */
export function OnboardingWizard({ organizationId, onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('target')
  const [config, setConfig] = useState<OnboardingConfig>({
    targetNumber: '',
    targetName: '',
    fromNumber: '',
    record: true,
    transcribe: true,
  })
  const [error, setError] = useState<string | null>(null)

  const steps: { id: Step; label: string }[] = [
    { id: 'target', label: 'Who to call' },
    { id: 'caller-id', label: 'Your number' },
    { id: 'options', label: 'Options' },
    { id: 'confirm', label: 'Confirm' },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === step)

  const validatePhoneNumber = (number: string): boolean => {
    const e164Regex = /^\+[1-9]\d{1,14}$/
    return e164Regex.test(number)
  }

  const handleNext = () => {
    setError(null)

    if (step === 'target') {
      if (!config.targetNumber) {
        setError('Please enter a phone number')
        return
      }
      if (!validatePhoneNumber(config.targetNumber)) {
        setError('Please use E.164 format (e.g., +12025551234)')
        return
      }
      setStep('caller-id')
    } else if (step === 'caller-id') {
      // Caller ID is optional for simple calls
      if (config.fromNumber && !validatePhoneNumber(config.fromNumber)) {
        setError('Please use E.164 format (e.g., +12025551234)')
        return
      }
      setStep('options')
    } else if (step === 'options') {
      setStep('confirm')
    } else if (step === 'confirm') {
      onComplete(config)
    }
  }

  const handleBack = () => {
    setError(null)
    const idx = currentStepIndex
    if (idx > 0) {
      setStep(steps[idx - 1].id)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-primary-50 px-6 py-4 border-b border-primary-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Set Up Your First Call</h2>
              <p className="text-sm text-gray-600 mt-0.5">Let's get you started in under a minute</p>
            </div>
            <button
              onClick={onSkip}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {steps.map((s, idx) => (
              <React.Fragment key={s.id}>
                <div 
                  className={`
                    flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                    ${idx < currentStepIndex 
                      ? 'bg-success text-white' 
                      : idx === currentStepIndex 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-gray-100 text-gray-400'
                    }
                  `}
                >
                  {idx < currentStepIndex ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${idx < currentStepIndex ? 'bg-success' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex].label}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-error-light border border-red-200 rounded-md text-error text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Target */}
          {step === 'target' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Enter the phone number you want to call. This can be a support line, customer number, or test line.
              </p>
              <Input
                label="Phone Number to Call"
                type="tel"
                value={config.targetNumber}
                onChange={(e) => setConfig({ ...config, targetNumber: e.target.value })}
                placeholder="+12025551234"
                hint="E.164 format required (include country code)"
                autoFocus
              />
              <Input
                label="Name (optional)"
                value={config.targetName || ''}
                onChange={(e) => setConfig({ ...config, targetName: e.target.value })}
                placeholder="Main Support Line"
                hint="For your reference only"
              />
            </div>
          )}

          {/* Step 2: Caller ID */}
          {step === 'caller-id' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Optionally enter your phone number. This enables "bridge calls" where we call you first, then connect you to the target.
              </p>
              <Input
                label="Your Phone Number (optional)"
                type="tel"
                value={config.fromNumber || ''}
                onChange={(e) => setConfig({ ...config, fromNumber: e.target.value })}
                placeholder="+12025559876"
                hint="Leave empty for direct outbound calls"
              />
              <div className="p-3 bg-info-light border border-blue-200 rounded-md">
                <p className="text-sm text-gray-700">
                  <strong>Bridge calls</strong> connect you to the target through our system, ensuring all calls are recorded with full provenance.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Options */}
          {step === 'options' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Choose what to capture during the call. These can be changed later.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Record Call</p>
                    <p className="text-xs text-gray-500">Immutable audio evidence</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Authoritative</Badge>
                    <Switch
                      checked={config.record}
                      onCheckedChange={(checked) => setConfig({ ...config, record: checked })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Transcribe</p>
                    <p className="text-xs text-gray-500">AI-powered canonical transcript</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Authoritative</Badge>
                    <Switch
                      checked={config.transcribe}
                      onCheckedChange={(checked) => setConfig({ ...config, transcribe: checked })}
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                More options (translation, surveys, secret shopper) available in Settings.
              </p>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Review your configuration and place your first call.
              </p>
              
              <div className="bg-gray-50 rounded-md p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500">Calling:</span>
                  <div className="text-right">
                    <p className="text-sm font-mono text-gray-900">{config.targetNumber}</p>
                    {config.targetName && (
                      <p className="text-xs text-gray-500">{config.targetName}</p>
                    )}
                  </div>
                </div>

                {config.fromNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Your number:</span>
                    <span className="text-sm font-mono text-gray-900">{config.fromNumber}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Recording:</span>
                  <Badge variant={config.record ? 'success' : 'default'}>
                    {config.record ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Transcription:</span>
                  <Badge variant={config.transcribe ? 'success' : 'default'}>
                    {config.transcribe ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
          {currentStepIndex > 0 && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button 
            variant="primary" 
            onClick={handleNext}
            className="flex-1"
          >
            {step === 'confirm' ? 'Place Call' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
