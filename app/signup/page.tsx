'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, useSession } from '@/components/AuthProvider'
import { Logo } from '@/components/Logo'
import {
  EmailInput,
  PasswordInput,
  isValidEmail,
  getPasswordStrength,
} from '@/components/ui/form-validation'
import { apiGet, apiPost, apiGetNoAuth } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface InviteData {
  email: string
  role: string
  organization_id: string
  organization_name: string
  expires_at: string
}

/**
 * SIGN UP PAGE
 *
 * Steve Jobs Principles Applied:
 * - One clear action: Create Account
 * - Minimal friction: Only required fields
 * - Visual hierarchy: Focus on the form
 * - Immediate feedback: Inline validation
 */
export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white"><div className="animate-pulse text-gray-400">Loading...</div></div>}>
      <SignUpContent />
    </Suspense>
  )
}

function SignUpContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleAvailable, setGoogleAvailable] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)

  // Invite handling
  const inviteToken = searchParams.get('invite')
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken)

  // Form validation state
  const emailValid = email.length === 0 || isValidEmail(email)
  const passwordStrength = getPasswordStrength(password)
  // Require org name only if not joining via invite
  const canSubmit =
    isValidEmail(email) &&
    passwordStrength.score >= 2 &&
    (inviteData || organizationName.trim().length > 0)

  // Validate invite token if present
  useEffect(() => {
    if (inviteToken) {
      setInviteLoading(true)
      apiGet(`/api/team/invites/validate/${inviteToken}`)
        .then((data) => {
          if (data.valid && data.invite) {
            setInviteData(data.invite)
            setEmail(data.invite.email)
          } else {
            setError(data.error || 'Invalid or expired invite link')
          }
        })
        .catch(() => setError('Failed to validate invite'))
        .finally(() => setInviteLoading(false))
    }
  }, [inviteToken])

  // Check available auth providers
  useEffect(() => {
    apiGet('/api/health/auth-providers')
      .then((j) => setGoogleAvailable(Boolean(j?.googleEnv)))
      .catch(() => setGoogleAvailable(false))
  }, [])

  // Redirect if already signed in (but not if accepting invite or currently signing up)
  useEffect(() => {
    if (session && !inviteToken && !isSigningUp && window.location.pathname !== '/signup') {
      router.push('/dashboard')
    }
  }, [session, router, inviteToken, isSigningUp])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Client-side validation
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }
    if (passwordStrength.score < 2) {
      setError('Please choose a stronger password')
      return
    }

    // If not joining via invite, require organization name
    if (!inviteData && !organizationName.trim()) {
      setError('Please enter an organization name')
      return
    }

    setError(null)
    setLoading(true)
    setIsSigningUp(true)

    try {
      // Step 0: Fetch CSRF token (same pattern as sign-in)
      const csrfData = await apiGetNoAuth('/api/auth/csrf')

      // Step 1: Create account
      const signupPayload: Record<string, string> = {
        email,
        password,
        name: name || email.split('@')[0],
        csrf_token: csrfData.csrf_token,
      }

      // Only include organizationName if not joining via invite
      if (!inviteData && organizationName.trim()) {
        signupPayload.organizationName = organizationName.trim()
      }

      const data = await apiPost('/api/auth/signup', signupPayload)

      // Step 2: Auto-sign in after successful signup
      const signInRes = await signIn('credentials', {
        username: email,
        password,
        redirect: false,
      })

      if (signInRes?.error) {
        // Account created but sign-in failed - redirect to signin with message
        logger.error('Auto sign-in failed', { error: signInRes.error })
        router.push('/signin?message=account-created')
        setIsSigningUp(false)
        return
      }

      // Step 3: If we have an invite token, accept the invite
      if (inviteToken && signInRes?.ok) {
        try {
          const acceptData = await apiPost(`/api/team/invites/accept/${inviteToken}`, undefined)

          if (acceptData.success) {
            logger.info('Joined organization', { organizationName: acceptData.organization_name })
          } else {
            logger.warn('Failed to accept invite', { error: acceptData.error })
          }
        } catch (acceptErr) {
          logger.error('Error accepting invite', { error: acceptErr })
        }
      }

      // Step 4: Redirect to onboarding (not dashboard as comment suggests)
      if (signInRes?.ok) {
        // Force redirect to onboarding, bypassing the session redirect useEffect
        setIsSigningUp(false)
        window.location.href = '/onboarding'
      } else {
        // Fallback - redirect to signin
        router.push('/signin?message=account-created')
        setIsSigningUp(false)
      }
    } catch (err: any) {
      logger.error('Signup error', { error: err?.message })
      setError(err?.message || 'Something went wrong')
      setLoading(false)
      setIsSigningUp(false)
    }
  }

  async function handleGoogleSignUp() {
    setLoading(true)
    await signIn('google', {
      callbackUrl: inviteToken ? `/signup?invite=${inviteToken}` : '/onboarding',
    })
  }

  if (status === 'loading' || inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-gray-400">
          {inviteLoading ? 'Validating invite...' : 'Loading...'}
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-semibold text-gray-900">Wordis Bond</span>
          </Link>
          <Link href="/signin" className="text-sm text-gray-600 hover:text-gray-900">
            Sign In
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              {inviteData ? `Join ${inviteData.organization_name}` : 'Create your account'}
            </h1>
            <p className="text-gray-600">
              {inviteData
                ? `You've been invited to join as ${inviteData.role}`
                : 'Start capturing business conversations with evidence-grade integrity.'}
            </p>
          </div>

          {/* Invite Info Banner */}
          {inviteData && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-medium">Organization Invite</span>
              </div>
              <p className="mt-1 text-sm text-blue-700">
                Create your account to join <strong>{inviteData.organization_name}</strong>
              </p>
            </div>
          )}

          {/* Google Sign Up */}
          {googleAvailable && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg width="20" height="20" viewBox="0 0 18 18">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">or</span>
                </div>
              </div>
            </>
          )}

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <EmailInput
                id="email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
                required
                disabled={!!inviteData}
              />
              {inviteData && (
                <p className="mt-1 text-xs text-gray-500">Email is locked to the invite</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={setPassword}
                placeholder="Create a secure password"
                autoComplete="new-password"
                showStrength
                showRequirements
              />
            </div>

            {/* Organization Name - only show if not joining via invite */}
            {!inviteData && (
              <div>
                <label
                  htmlFor="organizationName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="organizationName"
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Your Company Inc."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will be your team&apos;s workspace name
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className={`
                w-full py-3 px-4 font-medium rounded-lg transition-all
                ${
                  canSubmit
                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {loading
                ? 'Creating account...'
                : inviteData
                  ? `Join ${inviteData.organization_name}`
                  : 'Create Account'}
            </button>
          </form>

          {/* Terms */}
          <p className="mt-6 text-center text-xs text-gray-500">
            By creating an account, you agree to our{' '}
            <Link href="/trust#terms" className="underline hover:text-gray-700">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/trust#privacy" className="underline hover:text-gray-700">
              Privacy Policy
            </Link>
          </p>

          {/* Sign In Link */}
          <p className="mt-8 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/signin" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
