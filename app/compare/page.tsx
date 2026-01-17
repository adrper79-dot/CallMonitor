import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * Comparison Page - Word Is Bond vs Competitors
 * 
 * Educational page explaining the difference between:
 * - Traditional call recording (passive storage)
 * - AI insights platforms (Gong, Chorus)
 * - System of Record (Word Is Bond)
 */

export const metadata = {
  title: 'Word Is Bond vs Call Recording vs AI Insights | Comparison',
  description: 'Understand the difference between call recording software, AI conversation intelligence, and a true system of record for business conversations.',
  keywords: 'call recording comparison, gong alternative, chorus alternative, system of record, evidence-grade recording',
}

export default function ComparePage() {
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
            <Link href="#comparison" className="text-sm text-gray-600 hover:text-gray-900">Comparison</Link>
            <Link href="#use-cases" className="text-sm text-gray-600 hover:text-gray-900">Use Cases</Link>
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/api/auth/signin" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link 
              href="/api/auth/signin"
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Not All Call Solutions<br />
            Are Created <span className="text-primary-600">Equal</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Understand the critical difference between passive storage, insights platforms, 
            and evidence-grade systems of record.
          </p>
        </div>
      </section>

      {/* Three Categories */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Call Recording</h3>
              <p className="text-sm text-gray-600 mb-4">Traditional call recording software</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Records calls
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Basic storage
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500">✗</span> No transcription
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500">✗</span> No audit trails
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500">✗</span> No evidence packaging
                </li>
              </ul>
              <p className="mt-4 text-xs text-gray-500 italic">
                Good for: Basic compliance archiving
              </p>
            </div>

            <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Insights</h3>
              <p className="text-sm text-gray-600 mb-4">Gong, Chorus, conversation intelligence</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Analytics dashboards
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Sentiment analysis
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Sales coaching
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500">✗</span> Not evidence-grade
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500">✗</span> No chain of custody
                </li>
              </ul>
              <p className="mt-4 text-xs text-gray-500 italic">
                Good for: Sales performance optimization
              </p>
            </div>

            <div className="bg-primary-50 rounded-lg border-2 border-primary-600 p-6">
              <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">System of Record</h3>
              <p className="text-sm text-gray-600 mb-4">Word Is Bond - Evidence-grade authority</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Immutable audit trails
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Evidence packaging
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Chain of custody
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Court-ready exports
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Compliance by design
                </li>
              </ul>
              <p className="mt-4 text-xs font-semibold text-primary-900">
                Good for: Regulated industries, disputes, audits
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Comparison Table */}
      <section id="comparison" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            Feature Comparison
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-4 border-b-2 border-gray-200 text-gray-900 font-semibold">Feature</th>
                  <th className="text-center p-4 border-b-2 border-gray-200 text-gray-600 font-medium">Call Recording</th>
                  <th className="text-center p-4 border-b-2 border-gray-200 text-gray-600 font-medium">AI Insights</th>
                  <th className="text-center p-4 border-b-2 border-primary-600 bg-primary-50 text-primary-900 font-semibold">Word Is Bond</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-4 border-b border-gray-200 font-medium">Audio Recording</td>
                  <td className="p-4 border-b border-gray-200 text-center">✓</td>
                  <td className="p-4 border-b border-gray-200 text-center">✓</td>
                  <td className="p-4 border-b border-gray-200 text-center bg-primary-50">✓</td>
                </tr>
                <tr>
                  <td className="p-4 border-b border-gray-200 font-medium">Transcription</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center">✓</td>
                  <td className="p-4 border-b border-gray-200 text-center bg-primary-50">✓</td>
                </tr>
                <tr>
                  <td className="p-4 border-b border-gray-200 font-medium">Sentiment Analysis</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center">✓</td>
                  <td className="p-4 border-b border-gray-200 text-center bg-primary-50">✓</td>
                </tr>
                <tr>
                  <td className="p-4 border-b border-gray-200 font-medium">Immutable Audit Trails</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center bg-primary-50 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-4 border-b border-gray-200 font-medium">Chain of Custody</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center bg-primary-50 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-4 border-b border-gray-200 font-medium">Evidence Bundles</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center bg-primary-50 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-4 border-b border-gray-200 font-medium">Translation (12+ languages)</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center bg-primary-50">✓</td>
                </tr>
                <tr>
                  <td className="p-4 border-b border-gray-200 font-medium">Legal Hold Support</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center bg-primary-50 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-4 border-b border-gray-200 font-medium">Retention Policies (7+ years)</td>
                  <td className="p-4 border-b border-gray-200 text-center">±</td>
                  <td className="p-4 border-b border-gray-200 text-center">−</td>
                  <td className="p-4 border-b border-gray-200 text-center bg-primary-50">✓</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium">Court-Ready Exports</td>
                  <td className="p-4 text-center">−</td>
                  <td className="p-4 text-center">−</td>
                  <td className="p-4 text-center bg-primary-50 font-bold">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Use Case Match */}
      <section id="use-cases" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            Which Solution Is Right For You?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Call Recording If:</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  You only need basic archiving
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  Compliance requires storage only
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  No transcription needed
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  Budget is primary concern
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose AI Insights If:</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  Sales team coaching is priority
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  Analytics dashboards needed
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  Deal intelligence matters most
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  No regulatory requirements
                </li>
              </ul>
            </div>

            <div className="bg-primary-50 rounded-lg border-2 border-primary-600 p-6">
              <h3 className="text-lg font-semibold text-primary-900 mb-4">Choose Word Is Bond If:</h3>
              <ul className="space-y-3 text-sm text-gray-900">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 mt-0.5">✓</span>
                  <strong>Regulated industry</strong> (healthcare, legal, financial)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 mt-0.5">✓</span>
                  <strong>Disputes are common</strong> (tenant, client, patient)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 mt-0.5">✓</span>
                  <strong>Court-ready evidence</strong> required
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 mt-0.5">✓</span>
                  <strong>Compliance audits</strong> are frequent
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 mt-0.5">✓</span>
                  <strong>Authoritative record</strong> is critical
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Need Evidence You Can Defend?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Stop settling for storage. Get a system of record.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/api/auth/signin"
              className="w-full sm:w-auto px-8 py-4 bg-primary-600 text-white text-lg font-medium rounded-md hover:bg-primary-700 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link 
              href="/pricing"
              className="w-full sm:w-auto px-8 py-4 border border-gray-300 text-gray-700 text-lg font-medium rounded-md hover:bg-gray-50 transition-colors"
            >
              View Pricing
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
              <Link href="/pricing" className="text-sm text-gray-400 hover:text-white">Pricing</Link>
              <Link href="/trust" className="text-sm text-gray-400 hover:text-white">Trust Pack</Link>
              <Link href="/verticals/healthcare" className="text-sm text-gray-400 hover:text-white">Healthcare</Link>
              <Link href="/verticals/legal" className="text-sm text-gray-400 hover:text-white">Legal</Link>
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
