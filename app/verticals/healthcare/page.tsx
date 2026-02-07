import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * Healthcare Vertical Landing Page
 *
 * High-conversion entry page for healthcare compliance use cases.
 * Targeted artifacts: Consent + Intake + Audit Trail
 */

export const metadata = {
  title: 'Healthcare Call Recording & Compliance | Word Is Bond',
  description:
    'HIPAA-ready call recording, transcription, and audit trails for healthcare providers. Consent capture, patient intake verification, and evidentiary-grade documentation.',
  keywords:
    'HIPAA compliance, healthcare call recording, medical transcription, patient consent, audit trail, healthcare documentation',
}

export default function HealthcareVerticalPage() {
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
            <Link href="#features" className="text-sm text-gray-600 hover:text-gray-900">
              Features
            </Link>
            <Link href="#compliance" className="text-sm text-gray-600 hover:text-gray-900">
              Compliance
            </Link>
            <Link href="#use-cases" className="text-sm text-gray-600 hover:text-gray-900">
              Use Cases
            </Link>
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/signin" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full mb-8">
            <svg
              className="w-4 h-4 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="text-sm font-medium text-blue-700">HIPAA-Ready Infrastructure</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Healthcare Call Recording
            <br />
            <span className="text-primary-600">Built for Compliance</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Capture patient consent, verify intake information, and maintain evidentiary-grade audit
            trails. Word Is Bond provides the documentation you need when it matters most.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-primary-600 text-white text-lg font-medium rounded-md hover:bg-primary-700 transition-colors"
            >
              Start 14-Day Free Trial
            </Link>
            <Link
              href="/trust"
              className="w-full sm:w-auto px-8 py-4 border border-gray-300 text-gray-700 text-lg font-medium rounded-md hover:bg-gray-50 transition-colors"
            >
              View Trust Pack
            </Link>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            No credit card required · Setup in 5 minutes · Cancel anytime
          </p>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 bg-gray-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-gray-900">256-bit</p>
              <p className="text-sm text-gray-600">AES Encryption</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">SOC 2</p>
              <p className="text-sm text-gray-600">Type II Ready</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">99.9%</p>
              <p className="text-sm text-gray-600">Uptime SLA</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">7+ Years</p>
              <p className="text-sm text-gray-600">Retention Available</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Purpose-Built for Healthcare</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every feature designed to support your compliance requirements and documentation
              needs.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Consent Capture</h3>
              <p className="text-gray-600 mb-4">
                Automated verbal consent detection and timestamped acknowledgment. Know exactly when
                consent was given and by whom.
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Verbal consent flagging
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Timestamped recordings
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Compliance reporting
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Intake Verification</h3>
              <p className="text-gray-600 mb-4">
                AI-powered transcription captures patient information accurately. Review and verify
                intake data with full source attribution.
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Medical-grade transcription
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Speaker identification
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Searchable records
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Audit Trail</h3>
              <p className="text-gray-600 mb-4">
                Complete chain of custody for every call. Know who accessed what, when, and why.
                Export-ready for audits and legal proceedings.
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-purple-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Actor attribution
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-purple-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Cryptographic hashes
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-purple-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Legal hold support
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section id="compliance" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Compliance Without Compromise
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Word Is Bond is designed from the ground up for regulated industries. Our System of
                Record architecture ensures your call evidence is defensible in audits, disputes,
                and legal proceedings.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-primary-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      HIPAA-Ready Infrastructure
                    </h3>
                    <p className="text-sm text-gray-600">
                      BAA available. Encrypted at rest and in transit. Access controls and audit
                      logging.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-primary-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Immutable Evidence</h3>
                    <p className="text-sm text-gray-600">
                      Recordings cannot be modified. Transcripts are versioned. Every change is
                      logged.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-primary-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Export-Ready Bundles</h3>
                    <p className="text-sm text-gray-600">
                      Self-contained evidence packages with full provenance chain. Hash-verified
                      integrity.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Evidence Bundle Contents</h3>
              <ul className="space-y-4">
                {[
                  {
                    name: 'Source Recording',
                    desc: 'Unmodified audio file with hash verification',
                  },
                  {
                    name: 'Canonical Transcript',
                    desc: 'Versioned text with producer attribution',
                  },
                  { name: 'Consent Markers', desc: 'Timestamped consent acknowledgments' },
                  { name: 'Audit Trail', desc: 'Complete access and modification history' },
                  { name: 'Evidence Manifest', desc: 'Cryptographic provenance chain' },
                  { name: 'Export Metadata', desc: 'Who exported, when, and why' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Healthcare Use Cases</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From small practices to large health systems, Word Is Bond supports your documentation
              needs.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'Patient Scheduling & Intake',
                description:
                  'Capture appointment confirmations, insurance verification, and pre-visit instructions with full documentation.',
                icon: '📅',
              },
              {
                title: 'Telehealth Documentation',
                description:
                  'Record virtual consultations with consent capture and transcript generation for medical records.',
                icon: '💻',
              },
              {
                title: 'Prior Authorization Calls',
                description:
                  'Document insurance discussions with timestamped records of approvals, denials, and follow-up requirements.',
                icon: '📋',
              },
              {
                title: 'Care Coordination',
                description:
                  'Track referral discussions, specialist consultations, and care team communications.',
                icon: '🤝',
              },
            ].map((useCase, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{useCase.icon}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{useCase.title}</h3>
                    <p className="text-gray-600">{useCase.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-primary-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Ready to Simplify Healthcare Compliance?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Start your 14-day free trial today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-white text-primary-600 text-lg font-medium rounded-md hover:bg-primary-50 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/trust"
              className="w-full sm:w-auto px-8 py-4 border-2 border-white text-white text-lg font-medium rounded-md hover:bg-primary-700 transition-colors"
            >
              Download Trust Pack
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <span className="text-white font-semibold">Word Is Bond</span>
            </div>
            <nav className="flex items-center gap-8">
              <Link href="/pricing" className="text-sm text-gray-400 hover:text-white">
                Pricing
              </Link>
              <Link href="/trust" className="text-sm text-gray-400 hover:text-white">
                Trust Pack
              </Link>
              <Link href="/api-docs" className="text-sm text-gray-400 hover:text-white">
                API Docs
              </Link>
              <Link
                href="mailto:support@voxsouth.online"
                className="text-sm text-gray-400 hover:text-white"
              >
                Contact
              </Link>
            </nav>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Latimer + Woods Tech LLC. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
