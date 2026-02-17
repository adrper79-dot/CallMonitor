'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from '@/components/AuthProvider'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { apiGet, apiPost } from '@/lib/apiClient'
import { OnboardingAIAdvisor } from '@/components/bond-ai/OnboardingAIAdvisor'

type Step = 'plan' | 'number' | 'compliance' | 'email' | 'import' | 'call' | 'team' | 'tour' | 'launch'

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'plan', label: '1. Trial Plan' },
  { key: 'number', label: '2. Claim Number' },
  { key: 'compliance', label: '3. Compliance' },
  { key: 'email', label: '4. Email OAuth (Optional)' },
  { key: 'import', label: '5. Import Contacts' },
  { key: 'call', label: '6. Test Call' },
  { key: 'team', label: '7. Invite Team' },
  { key: 'tour', label: '8. Get Started' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [step, setStep] = useState<Step>('plan')
  const [loading, setLoading] = useState(false)
  const [provisionedNumber, setProvisionedNumber] = useState('')
  const [trialEndsAt, setTrialEndsAt] = useState('')
  const [callStarted, setCallStarted] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [importSkipped, setImportSkipped] = useState(false)
  const [callingHoursStart, setCallingHoursStart] = useState('08:00')
  const [callingHoursEnd, setCallingHoursEnd] = useState('21:00')
  const [orgTimezone, setOrgTimezone] = useState('America/New_York')
  const [teamEmails, setTeamEmails] = useState('')
  const [gmailConnected, setGmailConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [emailProviderConnecting, setEmailProviderConnecting] = useState<'google_workspace' | 'outlook' | null>(null)

  const refreshEmailStatuses = async () => {
    try {
      const [googleRes, outlookRes] = await Promise.allSettled([
        apiGet<{ connected?: boolean }>('/api/google-workspace/status'),
        apiGet<{ connected?: boolean }>('/api/outlook/status'),
      ])

      setGmailConnected(googleRes.status === 'fulfilled' && !!googleRes.value.connected)
      setOutlookConnected(outlookRes.status === 'fulfilled' && !!outlookRes.value.connected)
    } catch {
      setGmailConnected(false)
      setOutlookConnected(false)
    }
  }

  const startEmailOAuth = async (provider: 'google_workspace' | 'outlook') => {
    setEmailProviderConnecting(provider)
    try {
      const endpoint = provider === 'google_workspace' ? '/api/google-workspace/connect' : '/api/outlook/connect'
      const res = await apiPost<{ success?: boolean; authUrl?: string }>(endpoint, { state: 'onboarding_email' })
      if (!res.authUrl) {
        alert('OAuth URL unavailable. Please check integration settings and try again.')
        return
      }
      window.location.assign(res.authUrl)
    } catch {
      alert('Failed to start email OAuth flow. Please try again.')
    } finally {
      setEmailProviderConnecting(null)
    }
  }

  const handleSetupOnboarding = async () => {
    setLoading(true)
    try {
      const res = await apiPost('/api/onboarding/setup')
      if (res.success) {
        setProvisionedNumber(res.provisionedNumber)
        setTrialEndsAt(res.trialEndsAt)
        setStep('number')
      }
    } catch (err) {
      alert('Failed to set up your account. Please try again or contact support.')
    } finally {
      setLoading(false)
    }
  }

  const handleStepProgress = async (nextStep: Step) => {
    setStep(nextStep)
    try {
      const stepMap: Record<Step, number> = {
        plan: 1, number: 2, compliance: 3, email: 4, import: 5, call: 6, team: 7, tour: 8, launch: 9,
      }
      await apiPost('/api/onboarding/progress', { step: stepMap[nextStep] })
    } catch (err) {
      // Progress update failed — non-critical
    }
  }

  useEffect(() => {
    const requestedStep = searchParams.get('step')
    if (requestedStep === 'email') {
      setStep('email')
    }

    const oauthStatus = searchParams.get('oauth_status')
    const oauthProvider = searchParams.get('oauth_provider')
    if (oauthStatus === 'success') {
      if (oauthProvider === 'google_workspace') setGmailConnected(true)
      if (oauthProvider === 'outlook') setOutlookConnected(true)
      setStep('email')
    }
  }, [searchParams])

  useEffect(() => {
    if (step === 'email') {
      refreshEmailStatuses().catch(() => {})
    }
  }, [step])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="loading-spinner" />
        <span className="ml-3 text-gray-500">Loading...</span>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <main className="min-h-screen bg-white flex flex-col">
        <header className="border-b border-gray-100 px-6 py-4">
          <div className="max-w-lg mx-auto flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-semibold text-gray-900">Wordis Bond</span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-lg text-center space-y-4">
            <h1 className="text-2xl font-semibold text-gray-900">Start your first call</h1>
            <p className="text-sm text-gray-600">
              Create an account to import contacts and place your first call in minutes.
            </p>
            <div className="flex justify-center">
              <Link href="/signup" className="px-6 py-3 bg-primary-600 text-white rounded-lg">
                Create account
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-100 bg-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-semibold text-gray-900">Wordis Bond</span>
          </div>
          <Link href="/voice-operations" className="text-sm text-gray-600 hover:text-gray-900">
            Skip to Calls
          </Link>
        </div>
      </header>

      <div className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Fast Track: Your First Ring</h1>
                <p className="text-sm text-gray-500">
                  Get started with your first automated call in under 5 minutes.
                </p>
              </div>
              <div className="text-xs text-gray-500">Estimated time: 3 minutes</div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {STEP_LABELS.map((s) => (
                <span
                  key={s.key}
                  className={`px-2 py-1 rounded ${step === s.key ? 'bg-primary-50 text-primary-700 font-medium' : 'bg-gray-100'}`}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Bond AI contextual advisor */}
          <OnboardingAIAdvisor currentStep={step} />

          {step === 'plan' && (
            <section className="bg-white border border-gray-200 rounded-lg p-8 space-y-6 text-center">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">Welcome to Word Is Bond</h2>
                <p className="text-gray-500 max-w-md mx-auto">
                  Let&apos;s set up your AI-powered voice engine. You&apos;re starting with a 14-day
                  Professional Trial.
                </p>
              </div>

              <div className="py-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  Trial active: $0.00 due today
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button size="lg" onClick={handleSetupOnboarding} disabled={loading}>
                  {loading ? 'Initializing...' : 'Configure My Business'}
                </Button>
              </div>
            </section>
          )}

          {step === 'number' && (
            <section className="bg-white border border-gray-200 rounded-lg p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Claim Your Voice</h2>
                <p className="text-gray-500">
                  We&apos;ll provision a dedicated phone number for your AI agents. This number will
                  be used for all automated outreach.
                </p>
              </div>

              <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-gray-200">
                    <span className="text-xl">📞</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {provisionedNumber || 'Provisional Line'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {provisionedNumber
                        ? 'Number Linked Successfully'
                        : 'Local or Toll-Free number'}
                    </p>
                  </div>
                </div>
                {!provisionedNumber && (
                  <Button variant="outline" size="sm" onClick={() => setStep('number')}>
                    Select different city
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-gray-500">
                  {trialEndsAt
                    ? `Trial active until ${new Date(trialEndsAt).toLocaleDateString()}`
                    : 'Powered by Telnyx Voice API. Number includes SMS and voice support.'}
                </p>
                <Button onClick={() => handleStepProgress('compliance')} disabled={!provisionedNumber}>
                  Next: Compliance Setup
                </Button>
              </div>
            </section>
          )}

          {step === 'compliance' && (
            <section className="bg-white border border-gray-200 rounded-lg p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Compliance Configuration</h2>
                <p className="text-gray-500">
                  Set your FDCPA/TCPA calling hours and timezone. These protect your agents from
                  regulatory violations.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">
                    Organization Timezone
                  </label>
                  <select
                    value={orgTimezone}
                    onChange={(e) => setOrgTimezone(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="America/Anchorage">Alaska Time (AKT)</option>
                    <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-xs">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 uppercase mb-1">
                      Calling Starts
                    </label>
                    <input
                      type="time"
                      value={callingHoursStart}
                      onChange={(e) => setCallingHoursStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 uppercase mb-1">
                      Calling Ends
                    </label>
                    <input
                      type="time"
                      value={callingHoursEnd}
                      onChange={(e) => setCallingHoursEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700">
                    <strong>FDCPA Requirement:</strong> Calls to consumers must be between 8:00 AM
                    and 9:00 PM in the <em>consumer&apos;s</em> local time zone. Our compliance engine
                    enforces this per-account based on debtor location.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input type="checkbox" id="dnc-enabled" defaultChecked className="rounded" />
                  <label htmlFor="dnc-enabled" className="text-sm text-gray-700">
                    Enable Do-Not-Call list enforcement
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input type="checkbox" id="disclosure" defaultChecked className="rounded" />
                  <label htmlFor="disclosure" className="text-sm text-gray-700">
                    Enable call recording disclosure announcements
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-gray-500">
                  You can adjust these settings anytime in Settings → Compliance.
                </p>
                <Button
                  onClick={async () => {
                    try {
                      await apiPost('/api/onboarding/compliance', {
                        timezone: orgTimezone,
                        calling_hours_start: callingHoursStart,
                        calling_hours_end: callingHoursEnd,
                        dnc_enabled: true,
                        disclosure_enabled: true,
                      })
                    } catch { /* Non-critical during onboarding */ }
                    handleStepProgress('email')
                  }}
                >
                  Save & Continue
                </Button>
              </div>
            </section>
          )}

          {step === 'email' && (
            <section className="bg-white border border-gray-200 rounded-lg p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Email Channel Setup (Optional)</h2>
                <p className="text-gray-500">
                  Connect Gmail or Outlook for email-based workflows. If your agency is SMS-only,
                  you can skip this step and continue.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-gray-900">Gmail OAuth</p>
                    <p className="text-xs text-gray-500">Google Workspace authorization</p>
                  </div>
                  <div className="text-xs">
                    {gmailConnected ? (
                      <span className="text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">Connected</span>
                    ) : (
                      <span className="text-gray-600 bg-gray-100 border border-gray-200 px-2 py-1 rounded">Not connected</span>
                    )}
                  </div>
                  <Button
                    variant={gmailConnected ? 'outline' : 'default'}
                    onClick={() => startEmailOAuth('google_workspace')}
                    disabled={emailProviderConnecting !== null}
                  >
                    {emailProviderConnecting === 'google_workspace'
                      ? 'Redirecting...'
                      : gmailConnected
                        ? 'Reconnect Gmail'
                        : 'Connect Gmail'}
                  </Button>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-gray-900">Outlook OAuth</p>
                    <p className="text-xs text-gray-500">Microsoft 365 / Outlook authorization</p>
                  </div>
                  <div className="text-xs">
                    {outlookConnected ? (
                      <span className="text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">Connected</span>
                    ) : (
                      <span className="text-gray-600 bg-gray-100 border border-gray-200 px-2 py-1 rounded">Not connected</span>
                    )}
                  </div>
                  <Button
                    variant={outlookConnected ? 'outline' : 'default'}
                    onClick={() => startEmailOAuth('outlook')}
                    disabled={emailProviderConnecting !== null}
                  >
                    {emailProviderConnecting === 'outlook'
                      ? 'Redirecting...'
                      : outlookConnected
                        ? 'Reconnect Outlook'
                        : 'Connect Outlook'}
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-700">
                  System emails (password reset, account notices) continue to use Resend. You can
                  manage or reconnect email OAuth later in{' '}
                  <Link href="/settings/integrations" className="font-medium underline">
                    Settings → Integrations
                  </Link>
                  .
                </p>
              </div>

              <div className="flex items-center justify-between pt-4">
                <Button variant="outline" onClick={() => handleStepProgress('import')}>
                  Skip (SMS-Only)
                </Button>
                <Button onClick={() => handleStepProgress('import')}>
                  Continue to Import
                </Button>
              </div>
            </section>
          )}

          {step === 'import' && (
            <section className="bg-white border border-gray-200 rounded-lg p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Import Your Contacts</h2>
                <p className="text-gray-500">
                  Upload a CSV file with your contacts, leads, or accounts. We auto-detect formats
                  from COLLECT!, Excel, and most CRM exports.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-primary-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Drag & drop or click to upload
                    </p>
                    <p className="text-xs text-gray-500">CSV, XLS, XLSX — up to 10,000 rows</p>
                  </div>
                </div>

                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
                  onClick={() => {
                    // Navigate to the full import wizard
                    localStorage.setItem('wib-onboarding-completed', 'true')
                    window.open('/voice-operations/accounts?tab=import', '_blank')
                  }}
                >
                  <p className="text-sm text-gray-600">Click here to open the full Import Wizard</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Supports COLLECT!, Salesforce, and custom CSV formats
                  </p>
                </div>

                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                    />
                  </svg>
                  <p className="text-xs text-blue-700">
                    <strong>Migrating from COLLECT!?</strong> Export your accounts as CSV, then
                    upload here. We auto-map account number, debtor name, balance, and phone fields.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportSkipped(true)
                    handleStepProgress('call')
                  }}
                >
                  Skip for Now
                </Button>
                <Button onClick={() => handleStepProgress('call')}>Next: Test Call</Button>
              </div>
            </section>
          )}

          {step === 'call' && (
            <section className="bg-white border border-gray-200 rounded-lg p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">
                  The &quot;First Ring&quot; Moment
                </h2>
                <p className="text-gray-500">
                  Hear how your AI agent sounds. Enter your mobile number below, and we&apos;ll
                  place a sample call to you right now.
                </p>
              </div>

              <div className="space-y-4">
                <div className="max-w-xs">
                  <label
                    htmlFor="test-phone"
                    className="block text-xs font-medium text-gray-700 uppercase mb-1"
                  >
                    Your Mobile Number
                  </label>
                  <input
                    id="test-phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={async () => {
                      setLoading(true)
                      try {
                        await apiPost('/api/calls/start', {
                          phone_number: testPhone,
                          caller_id: provisionedNumber,
                        })
                        setCallStarted(true)
                        handleStepProgress('team')
                      } catch (err) {
                        alert('Failed to place call. Check number format.')
                      } finally {
                        setLoading(false)
                      }
                    }}
                    disabled={!testPhone || loading}
                  >
                    {loading ? 'Dialing...' : 'Call Me Now'}
                  </Button>
                  <Button variant="outline" onClick={() => handleStepProgress('team')}>
                    Skip Test Call
                  </Button>
                </div>
              </div>
            </section>
          )}

          {step === 'team' && (
            <section className="bg-white border border-gray-200 rounded-lg p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Invite Your Team</h2>
                <p className="text-gray-500">
                  Add agents, managers, or admins to your organization. They&apos;ll receive an email
                  invitation to join.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase mb-1">
                    Email Addresses (one per line)
                  </label>
                  <textarea
                    value={teamEmails}
                    onChange={(e) => setTeamEmails(e.target.value)}
                    placeholder={'agent1@company.com\nagent2@company.com\nmanager@company.com'}
                    className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                    rows={4}
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg max-w-md">
                  <p className="text-xs text-blue-700">
                    <strong>Roles:</strong> You can assign specific roles (agent, manager, admin) after
                    they accept the invitation in Settings → Teams.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <Button variant="outline" onClick={() => handleStepProgress('tour')}>
                  Skip for Now
                </Button>
                <Button
                  onClick={async () => {
                    if (teamEmails.trim()) {
                      try {
                        const emails = teamEmails.split('\n').map(e => e.trim()).filter(Boolean)
                        // Send individual invitations via the existing team invite endpoint
                        await Promise.allSettled(
                          emails.map(email =>
                            apiPost('/api/team/invites', { email, role: 'agent' })
                          )
                        )
                      } catch { /* Non-critical */ }
                    }
                    handleStepProgress('tour')
                  }}
                >
                  {teamEmails.trim() ? 'Send Invitations' : 'Continue'}
                </Button>
              </div>
            </section>
          )}

          {step === 'tour' && (
            <section className="bg-white border border-gray-200 rounded-lg p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Choose Your Path</h2>
                <p className="text-gray-500">
                  Your trial is active. What would you like to explore first?
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => {
                    handleStepProgress('launch')
                    router.push('/campaigns')
                  }}
                  className="p-6 border border-gray-100 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-900">Custom Campaign</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Upload your own leads and script for a production-ready test.
                  </p>
                </button>

                <button
                  onClick={() => {
                    handleStepProgress('launch')
                    router.push('/analytics')
                  }}
                  className="p-6 border border-gray-100 rounded-xl bg-gray-50 hover:bg-purple-50 hover:border-purple-200 transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-900">Explore Analytics</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    See how our AI analyzes tone, sentiment, and conversion metrics.
                  </p>
                </button>
              </div>
            </section>
          )}

          {step === 'launch' && (
            <section className="bg-white border border-blue-100 rounded-lg p-10 space-y-8 text-center shadow-sm">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>

              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-gray-900">You&apos;re All Set!</h2>
                <p className="text-gray-500 text-lg max-w-lg mx-auto">
                  Your account is provisioned and your trial is active. You have full access to the
                  platform for the next 14 days.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-left max-w-md mx-auto">
                <div className="flex items-center gap-3 text-blue-700 font-bold mb-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  Quick Tip
                </div>
                <p className="text-blue-600 text-sm">
                  Need help? Use the chat bubble in the bottom right corner or visit our
                  documentation for script templates.
                </p>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  className="w-full max-w-xs h-12 text-lg"
                  onClick={() => {
                    localStorage.setItem('wib-onboarding-completed', 'true')
                    router.push('/dashboard')
                  }}
                >
                  Go to Dashboard
                </Button>
                {importSkipped && (
                  <p className="text-xs text-gray-500">
                    You can import contacts anytime from{' '}
                    <Link
                      href="/voice-operations/accounts?tab=import"
                      className="text-primary-600 hover:underline"
                    >
                      Voice Ops → Accounts
                    </Link>
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
