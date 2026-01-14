'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

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
      const res = await fetch('/api/caller-id/verify')
      const data = await res.json()
      
      if (data.success) {
        setNumbers(data.numbers || [])
        setCurrentMask(data.current_mask)
        setSignalwireNumber(data.signalwire_number)
      } else {
        // Handle error object {id, code, message} or string
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
      
      const res = await fetch('/api/caller-id/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: newNumber,
          display_name: displayName || undefined
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setVerificationStep('calling')
        // After 5 seconds, prompt for code
        setTimeout(() => {
          setVerificationStep('enter_code')
        }, 5000)
      } else {
        // Handle error object {id, code, message} or string
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
      
      const res = await fetch('/api/caller-id/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: newNumber,
          code: verificationCode
        })
      })
      
      const data = await res.json()
      
      if (data.success && data.verified) {
        // Reset form
        setShowAddForm(false)
        setNewNumber('')
        setDisplayName('')
        setVerificationStep('idle')
        setVerificationCode('')
        // Refresh list
        fetchNumbers()
      } else {
        // Handle error object {id, code, message} or string
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
      // Update voice_configs directly
      const res = await fetch('/api/voice/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id_mask: phoneNumber,
          caller_id_verified: true
        })
      })
      
      if (res.ok) {
        fetchNumbers()
      }
    } catch (err) {
      console.error('Failed to set default', err)
    }
  }

  if (!organizationId) {
    return <div className="text-slate-400 p-4">Organization required</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-100">📞 Caller ID Masking</h3>
          <p className="text-sm text-slate-400">
            Display a different number when making outbound calls
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? 'outline' : 'default'}
        >
          {showAddForm ? 'Cancel' : '+ Add Number'}
        </Button>
      </div>

      {/* Current Caller ID */}
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="text-sm text-slate-400 mb-1">Currently Displayed As:</div>
        <div className="text-lg font-mono text-white">
          {currentMask || signalwireNumber || 'Default SignalWire Number'}
        </div>
        {currentMask && currentMask !== signalwireNumber && (
          <Badge variant="success" className="mt-2">Custom Mask Active</Badge>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Add Number Form */}
      {showAddForm && (
        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-4">
          <h4 className="font-medium text-white">Verify New Number</h4>
          
          {verificationStep === 'idle' && (
            <>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Phone Number</label>
                <Input
                  type="tel"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="+12025551234"
                  className="bg-slate-700 border-slate-600"
                />
                <p className="text-xs text-slate-500 mt-1">E.164 format required</p>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Display Name (optional)</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Main Office"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <Button 
                onClick={initiateVerification}
                disabled={verifying || !newNumber}
                className="w-full"
              >
                {verifying ? 'Calling...' : '📞 Call to Verify'}
              </Button>
              <p className="text-xs text-slate-500 text-center">
                We'll call this number and speak a 6-digit verification code
              </p>
            </>
          )}

          {verificationStep === 'calling' && (
            <div className="text-center py-6">
              <div className="text-4xl mb-4">📞</div>
              <div className="text-white mb-2">Calling {newNumber}...</div>
              <div className="text-slate-400 text-sm">
                Answer the call and listen for the 6-digit code
              </div>
            </div>
          )}

          {verificationStep === 'enter_code' && (
            <>
              <div className="text-center mb-4">
                <div className="text-white mb-2">Enter the 6-digit code you heard:</div>
              </div>
              <Input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="bg-slate-700 border-slate-600 text-center text-2xl tracking-widest"
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
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No verified numbers yet. Add one above!
        </div>
      ) : (
        <div className="space-y-2">
          {numbers.map((num) => (
            <div
              key={num.id}
              className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white">{num.phone_number}</span>
                  {num.is_verified ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                  {num.is_default && <Badge variant="default">Default</Badge>}
                </div>
                {num.display_name && (
                  <div className="text-sm text-slate-400">{num.display_name}</div>
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
      <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg text-sm">
        <strong className="text-blue-400">💡 How it works:</strong>
        <ul className="text-slate-300 mt-1 list-disc list-inside">
          <li>We call your number and speak a verification code</li>
          <li>Enter the code to prove you own the number</li>
          <li>Once verified, outbound calls will display this number</li>
        </ul>
      </div>
    </div>
  )
}
