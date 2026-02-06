'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'
import { apiGet, apiPost, apiPut } from '@/lib/apiClient'

interface CallerIdNumber {
  id: string
  phone_number: string
  display_name?: string
  is_verified: boolean
  is_default: boolean
  verified_at?: string
  use_count: number
}

interface CallerIdManagerProps {
  organizationId: string | null
}

/**
 * CallerIdManager - Professional Design System v3.0
 * 
 * Manage verified caller ID numbers for outbound call masking.
 * Clean, professional design - no emojis.
 */
export default function CallerIdManager({ organizationId }: CallerIdManagerProps) {
  const [numbers, setNumbers] = useState<CallerIdNumber[]>([])
  const [currentMask, setCurrentMask] = useState<string | null>(null)
  const [signalwireNumber, setSignalwireNumber] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Verification flow
  const [showAddForm, setShowAddForm] = useState(false)
  const [newNumber, setNewNumber] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [verificationStep, setVerificationStep] = useState<'idle' | 'calling' | 'enter_code'>('idle')
  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  const fetchNumbers = async () => {
    try {
      setLoading(true)
      const data = await apiGet('/api/caller-id/verify')
      
      if (data.success) {
        setNumbers(data.numbers || [])
        setCurrentMask(data.current_mask)
        setSignalwireNumber(data.signalwire_number)
      } else {
        setError(typeof data.error === 'object' ? data.error?.message : data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) {
      fetchNumbers()
    }
  }, [organizationId])

  const initiateVerification = async () => {
    if (!newNumber) return
    
    try {
      setVerifying(true)
      setError(null)
      
      const data = await apiPost('/api/caller-id/verify', {
        phone_number: newNumber,
        display_name: displayName || undefined
      })
      
      if (data.success) {
        setVerificationStep('calling')
        setTimeout(() => {
          setVerificationStep('enter_code')
        }, 5000)
      } else {
        setError(typeof data.error === 'object' ? data.error?.message : data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setVerifying(false)
    }
  }

  const confirmVerification = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }
    
    try {
      setVerifying(true)
      setError(null)
      
      const data = await apiPut('/api/caller-id/verify', {
        phone_number: newNumber,
        code: verificationCode
      })
      
      if (data.success && data.verified) {
        setShowAddForm(false)
        setNewNumber('')
        setDisplayName('')
        setVerificationStep('idle')
        setVerificationCode('')
        fetchNumbers()
      } else {
        const errorMsg = typeof data.error === 'object' ? data.error?.message : data.error
        setError(errorMsg || 'Verification failed')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setVerifying(false)
    }
  }

  const setAsDefault = async (numberId: string, phoneNumber: string) => {
    try {
      await apiPut('/api/voice/config', {
        orgId: organizationId,
        modulations: {
          caller_id_mask: phoneNumber,
          caller_id_verified: true
        }
      })
      
      fetchNumbers()
    } catch (err) {
      logger.error('CallerIdManager: failed to set default mask', err, {
        organizationId,
        numberId,
        phoneNumber
      })
    }
  }

  if (!organizationId) {
    return <div className="text-gray-500 p-4">Organization required</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Caller ID Masking</h3>
          <p className="text-sm text-gray-500">
            Display a different number when making outbound calls
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? 'outline' : 'primary'}
          size="sm"
        >
          {showAddForm ? 'Cancel' : 'Add Number'}
        </Button>
      </div>

      {/* Current Caller ID */}
      <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
        <div className="text-sm text-gray-500 mb-1">Currently Displayed As:</div>
        <div className="text-base font-mono text-gray-900">
          {currentMask || signalwireNumber || 'Default SignalWire Number'}
        </div>
        {currentMask && currentMask !== signalwireNumber && (
          <Badge variant="success" className="mt-2">Custom Mask Active</Badge>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-error-light border border-red-200 rounded-md text-error text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Add Number Form */}
      {showAddForm && (
        <div className="p-4 bg-white rounded-md border border-gray-200 space-y-4">
          <h4 className="font-medium text-gray-900">Verify New Number</h4>
          
          {verificationStep === 'idle' && (
            <>
              <Input
                label="Phone Number"
                type="tel"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="+12025551234"
                hint="E.164 format required"
              />
              <Input
                label="Display Name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Main Office"
              />
              <Button 
                onClick={initiateVerification}
                disabled={verifying || !newNumber}
                className="w-full"
                variant="primary"
              >
                {verifying ? 'Calling...' : 'Call to Verify'}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                We will call this number and speak a 6-digit verification code
              </p>
            </>
          )}

          {verificationStep === 'calling' && (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div className="text-gray-900 mb-2">Calling {newNumber}...</div>
              <div className="text-gray-500 text-sm">
                Answer the call and listen for the 6-digit code
              </div>
            </div>
          )}

          {verificationStep === 'enter_code' && (
            <>
              <div className="text-center mb-4">
                <div className="text-gray-900 mb-2">Enter the 6-digit code you heard:</div>
              </div>
              <Input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="text-center text-xl tracking-widest"
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setVerificationStep('idle')
                    setVerificationCode('')
                  }}
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button 
                  onClick={confirmVerification}
                  disabled={verifying || verificationCode.length !== 6}
                  className="flex-1"
                  variant="primary"
                >
                  {verifying ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Verified Numbers List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No verified numbers yet. Add one above.
        </div>
      ) : (
        <div className="space-y-2">
          {numbers.map((num) => (
            <div
              key={num.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-gray-900">{num.phone_number}</span>
                  {num.is_verified ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                  {num.is_default && <Badge variant="info">Default</Badge>}
                </div>
                {num.display_name && (
                  <div className="text-sm text-gray-500">{num.display_name}</div>
                )}
              </div>
              {num.is_verified && !num.is_default && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAsDefault(num.id, num.phone_number)}
                >
                  Set as Default
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-info-light border border-blue-200 rounded-md text-sm">
        <strong className="text-blue-700">How it works:</strong>
        <ul className="text-gray-700 mt-1 list-disc list-inside">
          <li>We call your number and speak a verification code</li>
          <li>Enter the code to prove you own the number</li>
          <li>Once verified, outbound calls will display this number</li>
        </ul>
      </div>
    </div>
  )
}
