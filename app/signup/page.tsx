"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn, useSession } from '@/components/AuthProvider'
import { Logo } from '@/components/Logo'
import { 
  EmailInput, 
  PasswordInput, 
  isValidEmail, 
  getPasswordStrength 
} from '@/components/ui/form-validation'

// API base URL for Workers API
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

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
  const router = useRouter()
  const { data: session, status } = useSession()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleAvailable, setGoogleAvailable] = useState(false)

  // Form validation state
  const emailValid = email.length === 0 || isValidEmail(email)
  const passwordStrength = getPasswordStrength(password)
  const canSubmit = isValidEmail(email) && passwordStrength.score >= 2

  // Check available auth providers
  useEffect(() => {
    fetch(`${API_BASE}/api/health/auth-providers`, { credentials: 'include' })
      .then(r => r.json())
      .then(j => setGoogleAvailable(Boolean(j?.googleEnv)))
      .catch(() => setGoogleAvailable(false))
  }, [])

  // Redirect if already signed in
  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

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
    
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error?.message || data?.error || 'Failed to create account')
        setLoading(false)
        return
      }

      // Auto-sign in after successful signup
      const signInRes = await signIn('credentials', {
        username: email,
        password,
        redirect: false
      })

      if (signInRes?.error) {
        // Account created but sign-in failed
        router.push('/signin?message=account-created')
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong')
      setLoading(false)
    }
  }

  async function handleGoogleSignUp() {
    setLoading(true)
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-gray-400">Loading...</div>
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
          <Link 
            href="/signin" 
            className="text-sm text-gray-600 hover:text-gray-900"
          >
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
              Create your account
            </h1>
            <p className="text-gray-600">
              Start capturing business conversations with evidence-grade integrity.
            </p>
          </div>

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
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <EmailInput
                id="email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
                required
              />
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

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className={`
                w-full py-3 px-4 font-medium rounded-lg transition-all
                ${canSubmit
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Terms */}
          <p className="mt-6 text-center text-xs text-gray-500">
            By creating an account, you agree to our{' '}
            <Link href="/trust" className="underline hover:text-gray-700">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/trust" className="underline hover:text-gray-700">
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
