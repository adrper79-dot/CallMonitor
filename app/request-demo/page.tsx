'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Logo } from '@/components/Logo'

/**
 * Enterprise Request Demo Page — CEO item #18
 *
 * Two scheduling paths — both backed by the internal demo-request API:
 *  1. Native time-slot picker — pick a date + 30-min slot (Eastern), no external deps
 *  2. Contact form — for buyers who prefer async / email-first outreach
 *
 * Uses our own booking UX (matching the in-app scheduler pattern from
 * components/schedule/CallbackScheduler.tsx) so prospects see the product in action.
 *
 * @see ARCH_DOCS/EIB_FINDINGS_TRACKER.md — CEO-18
 * @see workers/src/routes/internal.ts — POST /demo-request
 */

const API_URL = 'https://wordisbond-api.adrper79.workers.dev/api/internal/demo-request'

/** 30-min slots 9 am – 4:30 pm Eastern */
const TIME_SLOTS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '1:00 PM',  '1:30 PM',  '2:00 PM',  '2:30 PM',
  '3:00 PM',  '3:30 PM',  '4:00 PM',  '4:30 PM',
]

/** Return yyyy-mm-dd for today + next N weekdays */
function getUpcomingWeekdays(count: number): string[] {
  const days: string[] = []
  const d = new Date()
  // Start from tomorrow
  d.setDate(d.getDate() + 1)
  while (days.length < count) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      days.push(d.toISOString().split('T')[0])
    }
    d.setDate(d.getDate() + 1)
  }
  return days
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00') // noon to avoid DST edge
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const USE_CASES = [
  'Debt Collection / ARM',
  'Healthcare',
  'Legal',
  'Property Management',
  'Government',
  'Other',
]

const TEAM_SIZES = [
  '1–9 agents',
  '10–29 agents',
  '30–99 agents',
  '100–499 agents',
  '500+ agents',
]

export default function RequestDemoPage() {
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<'schedule' | 'form'>('schedule')

  // ── Native scheduler state ──────────────────────────────────────────────────
  const weekdays = getUpcomingWeekdays(10)
  const [schedDate, setSchedDate] = useState(weekdays[0])
  const [schedTime, setSchedTime] = useState('')
  const [schedName, setSchedName] = useState('')
  const [schedEmail, setSchedEmail] = useState('')
  const [schedCompany, setSchedCompany] = useState('')
  const [schedSubmitted, setSchedSubmitted] = useState(false)
  const [schedSending, setSchedSending] = useState(false)

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!schedTime) return
    setSchedSending(true)
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: schedName,
          email: schedEmail,
          company: schedCompany,
          preferredDate: schedDate,
          preferredTime: schedTime,
          useCase: 'Debt Collection / ARM',
          message: `Demo slot requested: ${formatDateLabel(schedDate)} at ${schedTime} ET`,
        }),
      }).catch(() => {})
      setSchedSubmitted(true)
    } finally {
      setSchedSending(false)
    }
  }

  // ── Contact form state ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    teamSize: '',
    useCase: '',
    message: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      // Fire-and-forget to the API — if it fails we still show success
      // so the buyer isn't blocked (sales team follows up from email notification)
      await fetch('https://wordisbond-api.adrper79.workers.dev/api/internal/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).catch(() => {})
      setSubmitted(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="font-semibold text-gray-900">Wordis Bond</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
            <Link href="/trust" className="text-gray-600 hover:text-gray-900">Trust Pack</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-14 px-6 bg-gray-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block mb-4 text-xs font-semibold uppercase tracking-widest text-primary-600 bg-primary-50 border border-primary-200 px-3 py-1 rounded-full">
            Enterprise & Team Plans
          </span>
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
            See Wordis Bond in Action
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            A 30-minute call with our team. We show you the FDCPA evidence bundle live,
            walk through Reg F compliance controls, and map them to your agency&apos;s
            existing call flow — no slide decks, no pitch, just the product.
          </p>

          {/* Value props */}
          <div className="grid grid-cols-3 gap-4 mt-8 text-left">
            {[
              { icon: '🛡️', label: 'FDCPA defense', sub: 'Evidence bundle walkthrough' },
              { icon: '📞', label: 'Reg F compliance', sub: 'Call caps, mini-Miranda, mini-Miranda delivery logs' },
              { icon: '🌐', label: 'Bilingual TTS', sub: 'English + Spanish call delivery' },
            ].map((v) => (
              <div key={v.label} className="bg-white border border-gray-200 rounded-md p-4">
                <span className="text-2xl">{v.icon}</span>
                <p className="text-sm font-semibold text-gray-900 mt-2">{v.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{v.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tab selector */}
      <section className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 mb-8 border-b border-gray-200">
            <button
              onClick={() => setTab('schedule')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'schedule'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Pick a Time
            </button>
            <button
              onClick={() => setTab('form')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'form'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Send Us a Message
            </button>
          </div>

          {/* ── Native time-slot scheduler ──────────────────────────────── */}
          {tab === 'schedule' && !schedSubmitted && (
            <form onSubmit={handleScheduleSubmit} className="space-y-6">
              <p className="text-sm text-gray-500">
                All times Eastern (ET) · 30-minute discovery call · Mon – Fri
              </p>

              {/* Date strip */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select a date</p>
                <div className="flex gap-2 flex-wrap">
                  {weekdays.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setSchedDate(d); setSchedTime('') }}
                      className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                        schedDate === d
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                      }`}
                    >
                      {formatDateLabel(d)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select a time</p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {TIME_SLOTS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSchedTime(t)}
                      className={`py-2 rounded-md text-xs font-medium border transition-colors ${
                        schedTime === t
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact fields */}
              {schedTime && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700">
                    Confirming: <span className="text-primary-600">{formatDateLabel(schedDate)} at {schedTime} ET</span>
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your name <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={schedName}
                        onChange={(e) => setSchedName(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Work email <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="email"
                        value={schedEmail}
                        onChange={(e) => setSchedEmail(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="jane@agency.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={schedCompany}
                        onChange={(e) => setSchedCompany(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Acme Collections LLC"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={schedSending}
                    className="w-full py-3 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 transition-colors disabled:opacity-60"
                  >
                    {schedSending ? 'Confirming…' : `Confirm ${formatDateLabel(schedDate)} at ${schedTime} ET →`}
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    We&apos;ll send a confirmation to your email. No spam — you&apos;ll hear from the founder directly.
                  </p>
                </div>
              )}
            </form>
          )}

          {tab === 'schedule' && schedSubmitted && (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Demo scheduled!</h2>
              <p className="text-gray-600 max-w-sm mx-auto">
                We&apos;ve received your request for {formatDateLabel(schedDate)} at {schedTime} ET.
                A confirmation will land in your inbox shortly — you&apos;ll hear from the founder directly.
              </p>
              <div className="mt-6 flex justify-center gap-4 text-sm">
                <Link href="/verticals/collections" className="text-primary-600 hover:text-primary-700 underline">
                  Explore the debt collection use case
                </Link>
                <Link href="/trust" className="text-primary-600 hover:text-primary-700 underline">
                  Review the Trust Pack
                </Link>
              </div>
            </div>
          )}

          {/* Contact form */}
          {tab === 'form' && !submitted && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Your name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={form.name}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Work email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="jane@agencyname.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                    Company / Agency name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    required
                    value={form.company}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Acme Collections LLC"
                  />
                </div>
                <div>
                  <label htmlFor="teamSize" className="block text-sm font-medium text-gray-700 mb-1">
                    Team size
                  </label>
                  <select
                    id="teamSize"
                    name="teamSize"
                    value={form.teamSize}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">Select agent count</option>
                    {TEAM_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="useCase" className="block text-sm font-medium text-gray-700 mb-1">
                  Primary use case
                </label>
                <select
                  id="useCase"
                  name="useCase"
                  value={form.useCase}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">Select your industry</option>
                  {USE_CASES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  What would you like to see in the demo?
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  value={form.message}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. We recently received a CFPB complaint and want to see how the evidence bundle would have protected us..."
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-3 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Request Demo →'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                We respond within one business day. No spam, no SDRs — you&apos;ll hear from the founder.
              </p>
            </form>
          )}

          {tab === 'form' && submitted && (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Request received</h2>
              <p className="text-gray-600 max-w-sm mx-auto">
                We&apos;ll be in touch within one business day. In the meantime, explore the{' '}
                <Link href="/verticals/collections" className="text-primary-600 hover:text-primary-700 underline">
                  debt collection use case
                </Link>{' '}
                or review our{' '}
                <Link href="/trust" className="text-primary-600 hover:text-primary-700 underline">
                  Trust Pack
                </Link>.
              </p>
            </div>
          )}
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-gray-200">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <span>© {new Date().getFullYear()} Latimer + Woods Tech LLC</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
            <Link href="/trust" className="hover:text-gray-700">Trust Pack</Link>
            <Link href="/pricing" className="hover:text-gray-700">Pricing</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
