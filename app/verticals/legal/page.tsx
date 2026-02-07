import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * Legal Vertical Landing Page
 *
 * High-conversion entry page for legal services compliance use cases.
 * Targeted artifacts: Client Intake + Attorney-Client Privilege + Malpractice Defense
 */

export const metadata = {
  title: 'Legal Call Recording & Client Documentation | Word Is Bond',
  description:
    'Attorney-client privilege protection with evidentiary-grade call recording for law firms. Secure intake documentation, consultation records, and malpractice defense.',
  keywords:
    'legal call recording, attorney client privilege, law firm documentation, legal intake, malpractice protection, evidence grade recording',
}

export default function LegalVerticalPage() {
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
              Security
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full mb-8">
            <svg
              className="w-4 h-4 text-purple-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
              />
            </svg>
            <span className="text-sm font-medium text-purple-700">
              Attorney-Client Privilege Protected
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Legal Documentation
            <br />
            <span className="text-primary-600">Evidence You Can Defend</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Document client intake, protect attorney-client communications, and build defensible
            case records. Word Is Bond provides court-ready evidence when disputes arise.
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
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Purpose-Built for Legal Practice
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every feature designed to support attorney-client privilege and professional
              responsibility.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Automated Client Intake</h3>
              <p className="text-gray-600">
                Capture initial consultations with timestamp-accurate transcripts. Document conflict
                checks, retainer agreements, and scope discussions.
              </p>
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
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Privilege Protection</h3>
              <p className="text-gray-600">
                Role-based access control ensures attorney-client communications remain
                confidential. Encrypted storage with audit trails.
              </p>
            </div>

            {/* Feature 3 */}
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Evidence-Grade Records</h3>
              <p className="text-gray-600">
                Immutable audit trails with SHA-256 hashing. Export complete evidence bundles for
                court proceedings or disciplinary defense.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-yellow-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Language Support</h3>
              <p className="text-gray-600">
                Transcribe and translate client communications in 12+ languages. Serve immigrant
                communities while maintaining accurate records.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Malpractice Defense</h3>
              <p className="text-gray-600">
                Document client instructions, advice given, and scope limitations. Defendable
                evidence for professional liability claims.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Flexible Retention</h3>
              <p className="text-gray-600">
                Configurable retention from 1 to 7+ years to meet state bar requirements. Legal hold
                support for active litigation.
              </p>
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
                Professional Responsibility Ready
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Word Is Bond is designed from the ground up for regulated professions. Our System of
                Record architecture ensures your client evidence is defensible in malpractice
                claims, fee disputes, and bar proceedings.
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
                    <h3 className="font-semibold text-gray-900 mb-1">State Bar Compliance</h3>
                    <p className="text-gray-600">
                      Meet recordkeeping requirements across all 50 states with configurable
                      retention and secure access controls.
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
                    <h3 className="font-semibold text-gray-900 mb-1">Privilege Protection</h3>
                    <p className="text-gray-600">
                      Encrypted at rest and in transit. Role-based access ensures only authorized
                      attorneys can access privileged communications.
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Evidence Export</h3>
                    <p className="text-gray-600">
                      One-click export of complete evidence bundles with chain of custody
                      documentation for court proceedings.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                Professional Standards Met
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <svg
                    className="w-4 h-4 text-green-500 mt-1"
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
                  ABA Model Rules compliance
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="w-4 h-4 text-green-500 mt-1"
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
                  State bar recordkeeping requirements
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="w-4 h-4 text-green-500 mt-1"
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
                  Client confidentiality rules
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="w-4 h-4 text-green-500 mt-1"
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
                  Conflict of interest tracking
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="w-4 h-4 text-green-500 mt-1"
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
                  Malpractice claim defense
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="w-4 h-4 text-purple-500 mt-1"
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

      {/* Use Cases */}
      <section id="use-cases" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Legal Practice Use Cases</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From solo practitioners to AmLaw 200 firms, Word Is Bond supports your documentation
              needs.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'Client Intake & Consultation',
                description:
                  'Record initial consultations with conflict check documentation, retainer discussions, and scope of representation clarity.',
                icon: '⚖️',
              },
              {
                title: 'Immigration Law Documentation',
                description:
                  'Capture client interviews in their native language with accurate transcription and translation for case files.',
                icon: '🌐',
              },
              {
                title: 'Family Law Mediation',
                description:
                  'Document settlement negotiations, child custody discussions, and support agreements with timestamp accuracy.',
                icon: '👨‍👩‍👧‍👦',
              },
              {
                title: 'Personal Injury Case Building',
                description:
                  'Record client injury descriptions, medical history intake, and ongoing status updates for case documentation.',
                icon: '🏥',
              },
              {
                title: 'Estate Planning Discussions',
                description:
                  'Capture testamentary intent, beneficiary instructions, and asset distribution wishes with evidentiary-grade records.',
                icon: '📜',
              },
              {
                title: 'Client Instruction Verification',
                description:
                  'Document settlement authority, litigation decisions, and strategy approvals to defend against malpractice claims.',
                icon: '✅',
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
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Protect Your Practice?</h2>
          <p className="text-xl text-primary-100 mb-8">
            Join law firms who trust Word Is Bond for client documentation and malpractice defense.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-white text-primary-600 text-lg font-medium rounded-md hover:bg-gray-50 transition-colors"
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
              <Link href="/verticals/healthcare" className="text-sm text-gray-400 hover:text-white">
                Healthcare
              </Link>
            </nav>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            <p>© {new Date().getFullYear()} Latimer + Woods Tech LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
