import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * Collections / Debt Recovery Vertical Landing Page
 *
 * Primary use case landing page for debt collection agencies
 * migrating from COLLECT! and similar ARM platforms.
 * 
 * Design: Dieter Rams — functional, no waste. Don Norman — match mental model.
 */

export const metadata = {
  title: 'Debt Collection Software with AI Compliance | Word Is Bond',
  description:
    'Replace COLLECT! with AI-powered call monitoring, Reg F compliance tracking, evidence-grade recordings, and power-dial workflows. Built for collection agencies.',
  keywords:
    'debt collection software, COLLECT alternative, Reg F compliance, FDCPA, TCPA, collection agency software, ARM software, power dialer, skip tracing, debt recovery',
}

export default function CollectionsVerticalPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-lg font-semibold text-gray-900">Word Is Bond</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-gray-600 hover:text-gray-900">Features</Link>
            <Link href="#compliance" className="text-sm text-gray-600 hover:text-gray-900">Compliance</Link>
            <Link href="#migration" className="text-sm text-gray-600 hover:text-gray-900">Migration</Link>
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/signin" className="text-sm text-gray-600 hover:text-gray-900">Sign In</Link>
            <Link href="/signup" className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors">
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-full mb-8">
            <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-sm font-medium text-primary-700">FDCPA + Reg F + TCPA Compliance Built-In</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Debt Collection Software
            <br />
            <span className="text-primary-600">That Protects Your Agency</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Every call recorded. Every word transcribed. Every compliance rule enforced.
            Word Is Bond gives collection agencies evidence-grade documentation
            that stands up to regulators, courts, and auditors.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-primary-600 text-white text-lg font-medium rounded-md hover:bg-primary-700 transition-colors">
              Start 14-Day Free Trial
            </Link>
            <Link href="#migration" className="w-full sm:w-auto px-8 py-4 border border-gray-300 text-gray-700 text-lg font-medium rounded-md hover:bg-gray-50 transition-colors">
              Switching from COLLECT!?
            </Link>
          </div>

          {/* Social Proof */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>SOC 2 Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>256-bit Encryption</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-16 px-6 bg-gray-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Collection Agencies Face Three Existential Risks
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <ProblemCard
              number="01"
              title="Regulatory Exposure"
              description="CFPB fines averaged $1.2M per enforcement action in 2025. A single unrecorded call where your agent fails to deliver the mini-Miranda can cost more than your entire annual software budget."
            />
            <ProblemCard
              number="02"
              title="He-Said-She-Said Disputes"
              description="Without evidence-grade recordings and AI-verified transcripts, every disputed debt becomes your agent's word against the consumer's. Courts side with consumers 70% of the time."
            />
            <ProblemCard
              number="03"
              title="Agent Productivity Drain"
              description="Your agents spend 30% of their day on administrative tasks — manual note-taking, switching between systems, searching for debtor history. That's 2.5 hours/day not collecting."
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Built for How Collectors Actually Work
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Not a generic call center tool. Word Is Bond is designed around the
              account-centric workflow that debt collectors depend on every day.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <FeatureCard
              icon={<PhoneIcon />}
              title="Account-Centric Call Queue"
              description="See debtor balance, call history, promises, and notes before you dial. Auto-advance through your daily queue after each disposition. No searching, no clicking — just collecting."
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="Automatic Compliance Monitoring"
              description="Real-time Reg F call frequency tracking, time-of-day validation, and mini-Miranda script verification. AI flags compliance risks during the call — not after the lawsuit."
            />
            <FeatureCard
              icon={<DocumentIcon />}
              title="Evidence-Grade Recordings"
              description="Every call recorded, transcribed, and preserved with tamper-proof evidence manifests. Chain of custody documentation that satisfies CFPB examiners and litigation holds."
            />
            <FeatureCard
              icon={<ChartIcon />}
              title="AI-Powered Call Intelligence"
              description="Automatic sentiment analysis, disposition suggestions, and promise-to-pay detection. Know which debtors are likely to pay and which need escalation — without guessing."
            />
            <FeatureCard
              icon={<UsersIcon />}
              title="Team Performance Dashboards"
              description="Real-time agent rankings, calls-per-hour metrics, collection rate tracking, and compliance scores. Give your managers the visibility they need to coach effectively."
            />
            <FeatureCard
              icon={<ImportIcon />}
              title="Bulk Import from Any System"
              description="CSV import with auto-field mapping for COLLECT!, Latitude, FICO, and Excel. Import 10,000 accounts in minutes with validation, deduplication, and error reporting."
            />
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section id="compliance" className="py-20 px-6 bg-gray-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Compliance Is Not a Feature. It's the Foundation.
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every interaction with Word Is Bond is designed to keep your agency compliant
              with federal and state collection regulations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ComplianceBadge title="FDCPA" description="Fair Debt Collection Practices Act" />
            <ComplianceBadge title="Reg F" description="CFPB Regulation F (7-in-7 rule)" />
            <ComplianceBadge title="TCPA" description="Telephone Consumer Protection Act" />
            <ComplianceBadge title="State Laws" description="50-state mini-Miranda support" />
          </div>

          <div className="mt-12 bg-white rounded-lg border border-gray-200 p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">What Happens When You Get Audited</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Without Word Is Bond</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 shrink-0 mt-0.5">&#x2717;</span>
                    Scramble to locate call recordings across multiple systems
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 shrink-0 mt-0.5">&#x2717;</span>
                    Manually transcribe flagged calls for review
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 shrink-0 mt-0.5">&#x2717;</span>
                    Hope your agents followed the script
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 shrink-0 mt-0.5">&#x2717;</span>
                    Weeks of preparation, thousands in legal fees
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">With Word Is Bond</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 shrink-0 mt-0.5">&#x2713;</span>
                    Export complete evidence bundle with one click
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 shrink-0 mt-0.5">&#x2713;</span>
                    AI-generated transcripts with timestamps and speaker ID
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 shrink-0 mt-0.5">&#x2713;</span>
                    Compliance score per call with flagged violations
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 shrink-0 mt-0.5">&#x2713;</span>
                    Audit-ready in minutes, not weeks
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Migration Section */}
      <section id="migration" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Switching from COLLECT!? We Made It Easy.
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Import your accounts, keep your workflow, gain AI superpowers.
              Most agencies are fully operational within 48 hours.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <MigrationStep
              step="1"
              title="Export from COLLECT!"
              description="Use COLLECT!'s built-in export to create a CSV of your debtor accounts. We support all standard COLLECT! export fields including Account #, Debtor Name, Balance, Phone, Status."
            />
            <MigrationStep
              step="2"
              title="Import into Word Is Bond"
              description="Our import wizard auto-maps COLLECT! fields, validates data, flags duplicates, and imports 10,000+ accounts in minutes. Your contacts are ready to call immediately."
            />
            <MigrationStep
              step="3"
              title="Start Collecting"
              description="Your agents log in, see their queue, and start dialing. Recording AND transcription are on by default. AI compliance monitoring starts from call one. No training needed."
            />
          </div>

          <div className="mt-12 text-center">
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 text-white text-lg font-medium rounded-md hover:bg-primary-700 transition-colors">
              Start Your Free Migration
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonial / Case Study */}
      <section className="py-20 px-6 bg-gray-50 border-y border-gray-200">
        <div className="max-w-4xl mx-auto text-center">
          <blockquote className="text-2xl font-medium text-gray-900 mb-6 leading-relaxed">
            &ldquo;We switched from COLLECT! in February and recovered our first disputed
            debt within a week — using the AI transcript as evidence. The recording
            proved our agent delivered the mini-Miranda correctly. That one case
            paid for a year of Word Is Bond.&rdquo;
          </blockquote>
          <div className="text-gray-600">
            <p className="font-semibold">Collections Agency Owner</p>
            <p className="text-sm">45-seat agency, Southeastern US</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Your Next Unrecorded Call Could Be Your Last
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Start recording, transcribing, and monitoring every call today.
            14-day free trial. No credit card required. Import your COLLECT! data in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-primary-600 text-white text-lg font-medium rounded-md hover:bg-primary-700 transition-colors">
              Start Free Trial
            </Link>
            <Link href="/pricing" className="w-full sm:w-auto px-8 py-4 border border-gray-300 text-gray-700 text-lg font-medium rounded-md hover:bg-gray-50 transition-colors">
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-200">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span>Word Is Bond by Latimer + Woods Tech LLC</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/trust" className="hover:text-gray-900">Trust Pack</Link>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
            <Link href="/compare" className="hover:text-gray-900">Compare</Link>
            <Link href="/api-docs" className="hover:text-gray-900">API</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Sub-Components — Kept in-file for vertical page isolation
═══════════════════════════════════════════════════════════════ */

function ProblemCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <span className="text-4xl font-bold text-gray-200">{number}</span>
      <h3 className="text-lg font-semibold text-gray-900 mt-2 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:border-primary-200 transition-colors">
      <div className="w-10 h-10 rounded-md bg-primary-50 flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}

function ComplianceBadge({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <h4 className="font-bold text-gray-900">{title}</h4>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  )
}

function MigrationStep({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-primary-600 text-white flex items-center justify-center text-lg font-bold mb-4">
        {step}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}

/* ═══════ Icons ═══════ */

function PhoneIcon() {
  return (
    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  )
}

function ImportIcon() {
  return (
    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}
