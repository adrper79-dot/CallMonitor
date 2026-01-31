import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * Government Vertical Landing Page
 * 
 * Targeting: Government agencies, constituent services offices, public records departments
 * 
 * Key Messages:
 * - Public Records Act compliance
 * - FOIA/transparency requirements
 * - Constituent interaction tracking
 * - Audit trail for public accountability
 */

export const metadata = {
  title: 'Government & Public Services | Word Is Bond - Public Records Compliance',
  description: 'Evidence-grade documentation for government agencies. FOIA-compliant call recording, constituent interaction tracking, and transparent public records management.',
  keywords: 'government call recording, public records, FOIA compliance, constituent services, transparency',
}

export default function GovernmentVerticalPage() {
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
            <Link href="/#solutions" className="text-sm text-gray-600 hover:text-gray-900">Solutions</Link>
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link>
            <Link href="/trust" className="text-sm text-gray-600 hover:text-gray-900">Trust Pack</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/api/auth/signin" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link 
              href="/api/auth/signin"
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 text-sm font-medium rounded-full mb-6">
            Government & Public Services
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Transparent Public Records<br />
            for <span className="text-primary-600">Accountable Government</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Evidence-grade documentation for constituent interactions. FOIA-compliant call recording, 
            public records management, and audit trails that meet transparency requirements.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/api/auth/signin"
              className="w-full sm:w-auto px-8 py-4 bg-primary-600 text-white text-lg font-medium rounded-md hover:bg-primary-700 transition-colors"
            >
              Request Demo
            </Link>
            <Link 
              href="/trust"
              className="w-full sm:w-auto px-8 py-4 border border-gray-300 text-gray-700 text-lg font-medium rounded-md hover:bg-gray-50 transition-colors"
            >
              View Compliance Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
            Government Communications Need Better Documentation
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12">
            Public agencies face unique challenges with accountability, transparency, and records retention.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📜</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">FOIA Requests</h3>
              <p className="text-gray-600">
                Scrambling to reconstruct constituent conversations when public records requests arrive.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">⚖️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Accountability Gaps</h3>
              <p className="text-gray-600">
                No reliable record when constituent interactions are questioned or disputed.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🗂️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Records Retention</h3>
              <p className="text-gray-600">
                Struggling to maintain required documentation for audits and oversight reviews.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Built for Public Accountability
            </h2>
            <p className="text-lg text-gray-600">
              Word Is Bond creates evidence-grade documentation for every government interaction.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 font-bold">1</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    FOIA-Ready Documentation
                  </h3>
                  <p className="text-gray-600">
                    Every call is automatically recorded, transcribed, and retained according to public records 
                    requirements. Respond to FOIA requests in minutes, not days.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 font-bold">2</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Constituent Interaction Tracking
                  </h3>
                  <p className="text-gray-600">
                    Complete audit trail of all communications with citizens. Track promises made, 
                    follow-ups required, and resolution timelines.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 font-bold">3</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Chain of Custody Protection
                  </h3>
                  <p className="text-gray-600">
                    Immutable records with timestamps, speaker identification, and audit logs. 
                    Meets legal requirements for public records authentication.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 font-bold">4</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Transparent Access Controls
                  </h3>
                  <p className="text-gray-600">
                    Role-based permissions with complete audit trails. Know exactly who accessed 
                    what records and when, for oversight compliance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
            Government Use Cases
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12">
            Evidence-grade documentation for every type of government interaction.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Use Case 1 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📞</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Constituent Services
              </h3>
              <p className="text-gray-600 mb-4">
                Record all citizen inquiries to city council offices, mayor's hotline, or 311 services.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Track issue resolution timelines</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Document promises made to constituents</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Public records for transparency reports</span>
                </li>
              </ul>
            </div>

            {/* Use Case 2 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🏛️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Public Benefits Administration
              </h3>
              <p className="text-gray-600 mb-4">
                Document benefit eligibility calls, application guidance, and status updates.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Verify instructions given to applicants</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Protect against fraud allegations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Appeal support documentation</span>
                </li>
              </ul>
            </div>

            {/* Use Case 3 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🚨</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Emergency Services Coordination
              </h3>
              <p className="text-gray-600 mb-4">
                Record non-emergency calls for dispatch review, training, and accountability.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Quality assurance for dispatchers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Evidence for complaint investigations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Training material for new staff</span>
                </li>
              </ul>
            </div>

            {/* Use Case 4 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🏗️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Permitting & Licensing
              </h3>
              <p className="text-gray-600 mb-4">
                Document all guidance provided to permit applicants and license holders.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Verify process instructions given</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Defend against "misinformation" claims</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Consistency in application guidance</span>
                </li>
              </ul>
            </div>

            {/* Use Case 5 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📋</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Code Enforcement
              </h3>
              <p className="text-gray-600 mb-4">
                Record violation notices, correction timelines, and compliance discussions.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Document warning notifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Enforcement action evidence</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Appeals hearing support</span>
                </li>
              </ul>
            </div>

            {/* Use Case 6 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🗳️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Voter Services
              </h3>
              <p className="text-gray-600 mb-4">
                Document voter registration assistance, polling place information, and ballot inquiries.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Verify guidance provided to voters</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Protect against disenfranchisement claims</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Election integrity documentation</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Built for Public Sector Compliance
            </h2>
            <p className="text-lg text-gray-600">
              Word Is Bond meets the unique requirements of government transparency and accountability.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Public Records Compliance</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">✓</span>
                  <span><strong>FOIA-Ready:</strong> Export call recordings and transcripts in response to public records requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">✓</span>
                  <span><strong>Retention Policies:</strong> Configurable retention schedules based on records management requirements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">✓</span>
                  <span><strong>Audit Trails:</strong> Complete chain of custody documentation for every record</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">✓</span>
                  <span><strong>Redaction Tools:</strong> Protect sensitive information while fulfilling transparency obligations</span>
                </li>
              </ul>
            </div>

            <div className="bg-green-50 rounded-lg border border-green-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Security & Access Control</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span><strong>Role-Based Permissions:</strong> Control who can access, export, or delete records</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span><strong>Access Logging:</strong> Track every access to every record for oversight compliance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span><strong>SOC 2 Type II:</strong> Enterprise-grade security controls and annual audits</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span><strong>Data Sovereignty:</strong> Your data stays in your jurisdiction for local regulations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Section */}
      <section className="py-20 px-6 bg-primary-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            Quantified Results for Public Agencies
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">85%</div>
              <div className="text-lg text-gray-900 font-medium mb-2">Faster FOIA Response</div>
              <div className="text-sm text-gray-600">Public records requests fulfilled in hours, not weeks</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">92%</div>
              <div className="text-lg text-gray-900 font-medium mb-2">Complaint Resolution</div>
              <div className="text-sm text-gray-600">Constituent disputes resolved with documented evidence</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">$50K+</div>
              <div className="text-lg text-gray-900 font-medium mb-2">Annual Savings</div>
              <div className="text-sm text-gray-600">Reduced legal costs and staff time on records requests</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Bring Transparency to Your Agency
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Schedule a demo to see how Word Is Bond can improve accountability and 
            streamline public records management.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/api/auth/signin"
              className="w-full sm:w-auto px-8 py-4 bg-primary-600 text-white text-lg font-medium rounded-md hover:bg-primary-700 transition-colors"
            >
              Request Demo
            </Link>
            <Link 
              href="/trust"
              className="w-full sm:w-auto px-8 py-4 border border-gray-300 text-gray-700 text-lg font-medium rounded-md hover:bg-gray-50 transition-colors"
            >
              Review Compliance Documentation
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            Questions? Contact our public sector team: government@wordisbond.ai
          </p>
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
              <Link href="/pricing" className="text-sm text-gray-400 hover:text-white">Pricing</Link>
              <Link href="/trust" className="text-sm text-gray-400 hover:text-white">Trust Pack</Link>
              <Link href="/compare" className="text-sm text-gray-400 hover:text-white">Compare</Link>
              <Link href="/case-studies" className="text-sm text-gray-400 hover:text-white">Case Studies</Link>
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
