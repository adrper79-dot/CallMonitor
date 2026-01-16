import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * WORDIS BOND LANDING PAGE - System of Record Positioning
 * 
 * Design Philosophy:
 * - Professional, trustworthy, competent
 * - Clean, light theme with navy blue primary
 * - Evidence-first messaging
 * - "1960s Playboy confidence voice" - authoritative, not clever
 * 
 * Positioning: "The System of Record for Business Conversations"
 */

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO SECTION - Above the Fold
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <Logo size="hero" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-semibold text-gray-900 mb-6 leading-tight">
            What Was Said.<br />
            <span className="text-primary-600">Is What Matters.</span>
          </h1>

          {/* Subhead */}
          <p className="text-xl md:text-2xl text-gray-600 mb-6 max-w-3xl mx-auto">
            In business, conversations decide outcomes.<br className="hidden md:inline" />
            Wordis Bond captures, verifies, and preserves spoken words —<br className="hidden md:inline" />
            so intent, truth, and accountability never disappear.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Link 
              href="/dashboard"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600"
            >
              Request Access
            </Link>
            <Link 
              href="#how-it-works"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600"
            >
              See How It Works
              <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO EXPLANATION - Short, Sharp
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lg text-gray-600 mb-6">
            Most platforms move calls.<br />
            Some analyze them.
          </p>
          <p className="text-2xl font-semibold text-gray-900 mb-8">
            Wordis Bond remembers them.
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="p-4">
              <p className="text-gray-700 font-medium">Every call becomes evidence.</p>
            </div>
            <div className="p-4">
              <p className="text-gray-700 font-medium">Every transcript is traceable.</p>
            </div>
            <div className="p-4">
              <p className="text-gray-700 font-medium">Every artifact is provable.</p>
            </div>
          </div>
          <p className="text-gray-500 mt-6 italic">
            No opinions. No guesswork. Just the record.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          WHO THIS IS FOR - Customer Qualification
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-4">
            Built for People Who:
          </h2>
          <div className="grid md:grid-cols-2 gap-4 mt-10">
            <QualificationItem text="Manage teams that speak to customers" />
            <QualificationItem text="Rely on verbal commitments" />
            <QualificationItem text="Operate across languages" />
            <QualificationItem text="Need proof, not promises" />
          </div>
          <p className="text-center text-gray-600 mt-10 text-lg">
            <strong className="text-gray-900">Sales. Compliance. Operations. Investigations. Quality. Trust.</strong>
          </p>
          <p className="text-center text-gray-500 mt-4">
            If words carry weight where you work — this is your platform.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          WHAT MAKES IT DIFFERENT - Category Definition
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-semibold text-center text-white mb-4">
            This Is Not Call Analytics
          </h2>
          <p className="text-center text-gray-400 mb-10">
            Call analytics tell you <em>what happened</em>.<br />
            Wordis Bond tells you <em>what stands</em>.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-400 mb-4 uppercase tracking-wide">They</h3>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start gap-3">
                  <span className="text-gray-600 mt-0.5">—</span>
                  Optimize conversations
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gray-600 mt-0.5">—</span>
                  Summarize
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gray-600 mt-0.5">—</span>
                  Infer intent
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gray-600 mt-0.5">—</span>
                  Delete history
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 uppercase tracking-wide">We</h3>
              <ul className="space-y-3 text-gray-200">
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">+</span>
                  Preserve conversations
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">+</span>
                  Certify
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">+</span>
                  Record intent
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">+</span>
                  Retain truth
                </li>
              </ul>
            </div>
          </div>

          <p className="text-center text-gray-300 mt-12 text-lg">
            We don't grade your calls. We <strong className="text-white">bind them</strong>.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          CORE PROMISE - The Money Slide
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <blockquote className="text-2xl md:text-3xl text-gray-900 font-medium leading-relaxed mb-10">
            "Every conversation becomes a verifiable artifact."
          </blockquote>
          
          <div className="grid md:grid-cols-5 gap-4 text-sm">
            <PromiseItem title="Canonical audio" />
            <PromiseItem title="Authoritative transcripts" />
            <PromiseItem title="Translation with provenance" />
            <PromiseItem title="Immutable evidence manifests" />
            <PromiseItem title="Full audit trail" />
          </div>

          <p className="text-gray-600 mt-10 text-lg">
            If it was said — you can prove it.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          HOW IT WORKS - Architecture → Story
      ═══════════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-12">
            How It Works
          </h2>

          <div className="space-y-8">
            <HowItWorksStep 
              number={1}
              title="Calls Are Server-Controlled"
              description="You initiate intent. We orchestrate execution. No spoofing. No client-side lies."
            />
            <HowItWorksStep 
              number={2}
              title="SignalWire Executes the Call"
              description="Calls, recording, media flow — handled by a dedicated voice plane. Reliable. Observable. Accountable."
            />
            <HowItWorksStep 
              number={3}
              title="AssemblyAI Produces Canonical Truth"
              description="Transcripts and translations are generated post-call. They are authoritative. Versioned. Immutable."
            />
            <HowItWorksStep 
              number={4}
              title="Evidence Is Assembled"
              description="Every artifact is stitched into a single record: audio, text, translations, surveys, scores. Cryptographically hashed. Time-ordered. Unalterable."
            />
            <HowItWorksStep 
              number={5}
              title="The Record Lives Forever"
              description="Export it. Audit it. Present it. Your word — preserved."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURE SECTIONS - Sell Without Noise
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-4">
            Evidence-Grade Features
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Every feature designed with provenance and auditability in mind.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              title="Conversation Evidence"
              description="Every call is a root object. Everything else attaches to it. No orphan data. No missing context."
              badge="Authoritative"
            />
            <FeatureCard
              title="Live & Post-Call Translation"
              description="Speak freely. Understand instantly. Verify later. Translations are non-destructive previews — the canonical record is always preserved."
              badge="Authoritative"
            />
            <FeatureCard
              title="After-Call Surveys & Scoring"
              description="Not opinions. Signals. Every response is bound to the call that caused it."
              badge="Authoritative"
            />
            <FeatureCard
              title="Click-to-Call & WebRTC Dialing"
              description="No phone required. No number required. Just intent — and execution."
              badge="Authoritative"
            />
            <FeatureCard
              title="Evidence Export"
              description="One-click ZIP bundles with recording, transcript, timeline, and provenance chain."
              badge="Authoritative"
            />
            <FeatureCard
              title="Artifact Delivery"
              description="Email. Exports. Secure bundles. Evidence arrives where decisions are made."
              badge="Authoritative"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECURITY & TRUST - Enterprise Spine
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-4">
            Security & Trust
          </h2>
          <p className="text-center text-gray-600 mb-10">
            Trust is not claimed. It's constructed.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <TrustItem text="Server-side orchestration only" />
            <TrustItem text="Role-based access control" />
            <TrustItem text="Tenant isolation" />
            <TrustItem text="Append-only audit logs" />
            <TrustItem text="Provenance per artifact" />
            <TrustItem text="Evidence hashes for integrity" />
          </div>

          <div className="mt-12 text-center">
            <Link 
              href="/trust"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              View Trust Pack
              <svg className="inline-block ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          WHO THIS REPLACES - Without Naming Them
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            You Don't Need:
          </h2>
          <ul className="space-y-3 text-gray-600 mb-10">
            <li>a softphone</li>
            <li>a call recorder</li>
            <li>an analytics dashboard</li>
            <li>a transcription tool</li>
            <li>a compliance workaround</li>
          </ul>
          <p className="text-xl text-gray-900 font-medium">
            You need <strong className="text-primary-600">one system that remembers correctly</strong>.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          VERTICAL SOLUTIONS
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-gray-900 mb-10">
            Solutions by Industry
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link 
              href="/verticals/healthcare"
              className="group p-6 bg-white rounded-md border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">Healthcare</h3>
                  <p className="text-sm text-gray-500">HIPAA-ready compliance</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm">
                Consent capture, patient intake verification, and evidentiary-grade audit trails for healthcare providers.
              </p>
            </Link>
            
            <div className="p-6 bg-white rounded-md border border-gray-200 opacity-75">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Financial Services</h3>
                  <p className="text-sm text-gray-500">Coming soon</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm">
                Regulatory compliance, customer verification, and dispute resolution documentation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-primary-600">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl text-primary-100 mb-4">
            The difference between a conversation and a commitment<br />
            is the record.
          </p>
          <h2 className="text-3xl font-semibold text-white mb-8">
            Wordis Bond
          </h2>
          <Link 
            href="/voice"
            className="inline-flex items-center justify-center px-10 py-4 text-lg font-medium text-primary-600 bg-white hover:bg-gray-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
          >
            Request Access
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
              <p className="text-sm font-medium text-gray-900">Wordis Bond</p>
              <p className="text-xs text-gray-500">Your Word. On Record.</p>
            </div>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/trust" className="hover:text-gray-700">Trust Pack</Link>
            <Link href="/api/auth/signin" className="hover:text-gray-700">Sign In</Link>
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
 * Qualification Item Component
 */
function QualificationItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-md">
      <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-gray-700">{text}</span>
    </div>
  )
}

/**
 * Promise Item Component
 */
function PromiseItem({ title }: { title: string }) {
  return (
    <div className="p-4 bg-gray-50 rounded-md text-center">
      <span className="text-gray-700 font-medium">{title}</span>
    </div>
  )
}

/**
 * How It Works Step Component
 */
function HowItWorksStep({ 
  number, 
  title, 
  description 
}: { 
  number: number
  title: string
  description: string
}) {
  return (
    <div className="flex gap-6 items-start">
      <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold flex-shrink-0">
        {number}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
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
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
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

/**
 * Trust Item Component
 */
function TrustItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-md border border-gray-200">
      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      <span className="text-gray-700 text-sm">{text}</span>
    </div>
  )
}
