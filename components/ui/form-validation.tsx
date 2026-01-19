"use client"

import React from 'react'

/**
 * Form Validation Components
 * 
 * Inline validation for authentication forms.
 * Steve Jobs principle: Give immediate, clear feedback.
 * 
 * Professional Design System v3.0
 */

export interface PasswordStrength {
  score: number  // 0-4
  label: string
  color: string
  requirements: {
    length: boolean
    uppercase: boolean
    lowercase: boolean
    number: boolean
  }
}

export function getPasswordStrength(password: string): PasswordStrength {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  }

  const score = Object.values(requirements).filter(Boolean).length

  const labels: Record<number, { label: string; color: string }> = {
    0: { label: 'Too weak', color: 'bg-red-500' },
    1: { label: 'Weak', color: 'bg-red-400' },
    2: { label: 'Fair', color: 'bg-amber-400' },
    3: { label: 'Good', color: 'bg-lime-400' },
    4: { label: 'Strong', color: 'bg-green-500' },
  }

  return {
    score,
    ...labels[score],
    requirements,
  }
}

export interface PasswordStrengthIndicatorProps {
  password: string
  showRequirements?: boolean
}

export function PasswordStrengthIndicator({ 
  password, 
  showRequirements = true 
}: PasswordStrengthIndicatorProps) {
  const strength = getPasswordStrength(password)

  if (!password) return null

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i < strength.score ? strength.color : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${
          strength.score <= 1 ? 'text-red-600' 
          : strength.score === 2 ? 'text-amber-600' 
          : 'text-green-600'
        }`}>
          {strength.label}
        </span>
      </div>

      {/* Requirements checklist */}
      {showRequirements && strength.score < 4 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <RequirementCheck met={strength.requirements.length} label="8+ chars" />
          <RequirementCheck met={strength.requirements.uppercase} label="A-Z" />
          <RequirementCheck met={strength.requirements.lowercase} label="a-z" />
          <RequirementCheck met={strength.requirements.number} label="0-9" />
        </div>
      )}
    </div>
  )
}

function RequirementCheck({ met, label }: { met: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 ${met ? 'text-green-600' : 'text-gray-400'}`}>
      {met ? '✓' : '○'} {label}
    </span>
  )
}

export function isValidEmail(email: string): boolean {
  // RFC 5322 simplified
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export interface EmailInputProps {
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
  showValidation?: boolean
}

export function EmailInput({
  value,
  onChange,
  id = 'email',
  placeholder = 'you@company.com',
  required = true,
  autoComplete = 'email',
  showValidation = true,
}: EmailInputProps) {
  const isValid = value.length === 0 || isValidEmail(value)
  const hasValue = value.length > 0

  return (
    <div>
      <input
        id={id}
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={`
          w-full px-4 py-3 border rounded-lg outline-none transition-all
          ${hasValue && showValidation
            ? isValid 
              ? 'border-green-400 focus:ring-2 focus:ring-green-300' 
              : 'border-red-400 focus:ring-2 focus:ring-red-300'
            : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
          }
        `}
      />
      {hasValue && showValidation && !isValid && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <span>⚠</span> Please enter a valid email address
        </p>
      )}
    </div>
  )
}

export interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
  showStrength?: boolean
  showRequirements?: boolean
  minLength?: number
}

export function PasswordInput({
  value,
  onChange,
  id = 'password',
  placeholder = 'Your password',
  required = true,
  autoComplete = 'current-password',
  showStrength = false,
  showRequirements = false,
  minLength = 8,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false)
  const isMinLength = value.length >= minLength
  const hasValue = value.length > 0

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
          className={`
            w-full px-4 py-3 pr-12 border rounded-lg outline-none transition-all
            ${hasValue && !isMinLength 
              ? 'border-amber-400 focus:ring-2 focus:ring-amber-300'
              : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            }
          `}
        />
        {/* Show/hide toggle */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      
      {showStrength && <PasswordStrengthIndicator password={value} showRequirements={showRequirements} />}
    </div>
  )
}
