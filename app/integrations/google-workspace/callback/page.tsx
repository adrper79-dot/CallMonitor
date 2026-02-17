'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiPost } from '@/lib/apiClient'

function getReturnPath(state: string | null) {
  if (state === 'onboarding_email') {
    return '/onboarding?step=email&oauth_provider=google_workspace&oauth_status=success'
  }
  return '/settings/integrations?oauth_provider=google_workspace&oauth_status=success'
}

export default function GoogleWorkspaceCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Completing Google authorization...')

  const code = useMemo(() => searchParams.get('code'), [searchParams])
  const state = useMemo(() => searchParams.get('state'), [searchParams])
  const error = useMemo(() => searchParams.get('error'), [searchParams])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (error) {
        setStatus('Google authorization was cancelled or denied.')
        setTimeout(() => router.replace('/settings/integrations?oauth_provider=google_workspace&oauth_status=error'), 1200)
        return
      }

      if (!code) {
        setStatus('Missing authorization code. Please retry the connection.')
        setTimeout(() => router.replace('/settings/integrations?oauth_provider=google_workspace&oauth_status=error'), 1200)
        return
      }

      try {
        await apiPost('/api/google-workspace/callback', { code, state: state || undefined })
        if (!cancelled) {
          setStatus('Google Workspace connected successfully. Redirecting...')
          setTimeout(() => router.replace(getReturnPath(state)), 600)
        }
      } catch {
        if (!cancelled) {
          setStatus('Failed to complete Google authorization. Please try again.')
          setTimeout(() => router.replace('/settings/integrations?oauth_provider=google_workspace&oauth_status=error'), 1200)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [code, error, router, state])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-md border border-gray-200 rounded-lg p-6 text-center space-y-3">
        <h1 className="text-lg font-semibold text-gray-900">Google Workspace OAuth</h1>
        <p className="text-sm text-gray-600">{status}</p>
      </div>
    </div>
  )
}
