import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * CALLMONITOR LANDING PAGE - System of Record Positioning
 * 
 * Design Philosophy:
 * - Professional, trustworthy, competent
 * - Clean, light theme with navy blue primary
 * - Evidence-first messaging
 * 
 * Positioning: "The System of Record for Business Conversations"
 */

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <Logo size="hero" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-semibold text-gray-900 mb-6 leading-tight">
            The System of Record for<br />
            <span className="text-primary-600">Business Conversations</span>
          </h1>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-gray-600 mb-6 max-w-3xl mx-auto">
            Evidence, not opinions. Know exactly what happened — when it matters.
          </p>
          
          {/* Subtext */}
          <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto">
            Immutable recordings. Canonical transcripts. Full provenance. 
            The truth about every call, defensible in any dispute.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/dashboard"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600"
            >
              Get Started
            </Link>
            <Link 
              href="/api/auth/signin"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRUST SECTION - Why Operations Teams Choose CallMonitor
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-4">
            Why Operations Teams Choose CallMonitor
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Built for businesses that need to know — with certainty — what was said.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <TrustCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              title="Immutable Evidence"
              description="Source recordings never modified. Cryptographically hashed manifests. Audit-grade provenance for every artifact."
            />

            <TrustCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              }
              title="Legally Defensible"
              description="Canonical transcripts from AssemblyAI. Full timeline reconstruction. Export complete evidence bundles with one click."
            />

            <TrustCard
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              }
              title="Vendor Independent"
              description="No lock-in. Swap providers anytime. You own your data — truly. Self-contained exports work without us."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          WHAT WE ARE / WHAT WE'RE NOT
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 p-8 md:p-12 rounded-lg">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">What We're NOT</h3>
                <ul className="space-y-3 text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">×</span>
                    Another phone system
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">×</span>
                    AI summaries and opinions
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">×</span>
                    Just call recording software
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">What We ARE</h3>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span><strong className="text-white">Authoritative reconstruction</strong> of what happened</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span><strong className="text-white">Immutable evidence</strong> you can defend</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span><strong className="text-white">System of record</strong> for your conversations</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURES SECTION
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-4">
            Evidence-Grade Call Intelligence
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Every feature designed with provenance and auditability in mind.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              title="Source Recording"
              description="Immutable call audio from SignalWire. Never modified after capture."
              badge="Authoritative"
            />

            <FeatureCard
              title="Canonical Transcript"
              description="AssemblyAI transcription with version history and cryptographic hashes."
              badge="Authoritative"
            />

            <FeatureCard
              title="Post-Call Translation"
              description="Authoritative translation from the canonical transcript."
              badge="Authoritative"
            />

            <FeatureCard
              title="Evidence Export"
              description="One-click ZIP bundles with recording, transcript, timeline, and README."
              badge="Authoritative"
            />

            <FeatureCard
              title="Review Mode"
              description="Read-only evidence view for dispute resolution and compliance."
              badge="Authoritative"
            />

            <FeatureCard
              title="Live Translation"
              description="Real-time assist during calls. Not recorded as evidence."
              badge="Preview"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          POSITIONING QUOTE
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <blockquote className="text-xl md:text-2xl text-gray-700 italic leading-relaxed">
            "If RingCentral is 'make calls and manage people,' and Verint is 
            'analyze conversations at scale,' then CallMonitor is <strong className="text-primary-600 not-italic">remember 
            what happened — correctly — when it matters.</strong>"
          </blockquote>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          CTA SECTION
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-primary-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-semibold text-white mb-4">
            Ready to Have a System of Record?
          </h2>
          <p className="text-primary-100 mb-8 text-lg">
            Start capturing evidence-grade call records today.
          </p>
          <Link 
            href="/voice"
            className="inline-flex items-center justify-center px-10 py-4 text-lg font-medium text-primary-600 bg-white hover:bg-gray-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="py-12 px-6 border-t border-gray-200">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <div>
              <p className="text-sm font-medium text-gray-900">CallMonitor</p>
              <p className="text-xs text-gray-500">System of Record</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Latimer + Woods Tech LLC
          </p>
        </div>
      </footer>
    </main>
  )
}

/**
 * Trust Card Component
 */
function TrustCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-6 bg-white rounded-md border border-gray-200">
      <div className="w-12 h-12 rounded-md bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

/**
 * Feature Card Component
 */
function FeatureCard({ 
  title, 
  description,
  badge
}: { 
  title: string
  description: string
  badge: 'Authoritative' | 'Preview'
}) {
  const isAuthoritative = badge === 'Authoritative'
  
  return (
    <div className="p-5 bg-white rounded-md border border-gray-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isAuthoritative 
            ? 'bg-green-100 text-green-700' 
            : 'bg-amber-100 text-amber-700'
        }`}>
          {badge}
        </span>
      </div>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}
