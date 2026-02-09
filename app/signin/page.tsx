'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, useSession } from '@/components/AuthProvider'
import { Logo } from '@/components/Logo'
import { EmailInput, PasswordInput, isValidEmail } from '@/components/ui/form-validation'
import { apiGetNoAuth } from '@/lib/apiClient'

/**
 * SIGN IN PAGE
 *
 * Steve Jobs Principles Applied:
 * - One clear action: Sign In
 * - Multiple methods but clear hierarchy
 * - Minimal friction
 * - Immediate validation feedback
 */
export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleAvailable, setGoogleAvailable] = useState(false)
  const [emailLinkAvailable, setEmailLinkAvailable] = useState(false)
  const [authMethod, setAuthMethod] = useState<'password' | 'email'>('password')

  // Form validation
  const emailValid = email.length === 0 || isValidEmail(email)
  const canSubmit = isValidEmail(email) && (authMethod === 'email' || password.length > 0)

  // Check for success message from signup
  const message = searchParams.get('message')

  // Check available auth providers
  useEffect(() => {
    apiGetNoAuth('/api/health/auth-providers')
      .then((j: any) => {
        setGoogleAvailable(Boolean(j?.googleEnv))
        setEmailLinkAvailable(Boolean(j?.adapterEnv && j?.resendEnv))
      })
      .catch(() => {
        setGoogleAvailable(false)
        setEmailLinkAvailable(false)
      })
  }, [])

  // Redirect if already signed in
  useEffect(() => {
    if (session) {
      const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
      router.push(callbackUrl)
    }
  }, [session, router, searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (authMethod === 'email') {
        // Magic link
        const res = await signIn('email', { email, redirect: false } as any)
        if (res?.error) {
          setError('Failed to send sign-in link')
        } else {
          setError(null)
          // Show success message
          router.push('/signin?message=email-sent')
        }
      } else {
        // Password
        const res = await signIn('credentials', {
          username: email,
          password,
          redirect: false,
        })

        if (res?.error) {
          setError('Invalid email or password')
        } else if (res?.ok) {
          const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
          router.push(callbackUrl)
        } else {
          setError('Sign in failed. Please try again.')
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
    await signIn('google', { callbackUrl })
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
            href="/signup"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome back</h1>
            <p className="text-gray-600">Sign in to access your voice intelligence platform.</p>
          </div>

          {/* Success Messages */}
          {message === 'account-created' && (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Account created successfully! Please sign in.
            </div>
          )}
          {message === 'email-sent' && (
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              Check your email for a sign-in link.
            </div>
          )}

          {/* Google Sign In */}
          {googleAvailable && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
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

          {/* Auth Method Toggle */}
          {emailLinkAvailable && (
            <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setAuthMethod('password')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  authMethod === 'password'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('email')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  authMethod === 'email'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Email Link
              </button>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <EmailInput
                id="email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </div>

            {authMethod === 'password' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Your password"
                  autoComplete="current-password"
                  showStrength={false}
                />
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
                ? 'Please wait...'
                : authMethod === 'email'
                  ? 'Send Sign-In Link'
                  : 'Sign In'}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="mt-8 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
