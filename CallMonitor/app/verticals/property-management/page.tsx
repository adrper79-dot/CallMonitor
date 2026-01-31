import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * Property Management Vertical Landing Page
 * 
 * High-conversion entry page for property management compliance use cases.
 * Targeted artifacts: Tenant Communication + Maintenance Requests + Dispute Resolution
 */

export const metadata = {
  title: 'Property Management Call Recording & Documentation | Word Is Bond',
  description: 'Evidence-grade call recording for property managers. Document tenant communications, maintenance requests, and dispute resolution with defensible audit trails.',
  keywords: 'property management call recording, tenant documentation, maintenance request tracking, dispute evidence, property manager software',
}

export default function PropertyManagementVerticalPage() {
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
            <Link href="#benefits" className="text-sm text-gray-600 hover:text-gray-900">Benefits</Link>
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

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full mb-8">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-sm font-medium text-green-700">Landlord-Tenant Protection</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Property Management<br />
            <span className="text-primary-600">Documentation That Protects</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            End "he-said, she-said" disputes with evidence-grade documentation. Record tenant 
            communications, track maintenance requests, and resolve conflicts with defensible proof.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/api/auth/signin"
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
              <p className="text-3xl font-bold text-gray-900">$250K+</p>
              <p className="text-sm text-gray-600">Dispute Savings</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">85%</p>
              <p className="text-sm text-gray-600">Faster Resolution</p>
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
              Built for Property Managers
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every feature designed to protect your business and resolve disputes faster.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Maintenance Request Tracking
              </h3>
              <p className="text-gray-600">
                Document every maintenance call with timestamp-accurate transcripts. Track request-to-completion 
                timelines and vendor coordination.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Dispute Resolution Evidence
              </h3>
              <p className="text-gray-600">
                Export complete evidence bundles for eviction proceedings, security deposit disputes, 
                and lease violation claims.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Lease Agreement Verification
              </h3>
              <p className="text-gray-600">
                Record lease signing calls, rent increase notifications, and renewal discussions 
                with evidentiary-grade documentation.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Multi-Language Support
              </h3>
              <p className="text-gray-600">
                Serve diverse tenant populations with transcription and translation in 12+ languages. 
                Meet language access requirements.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Secure Multi-Property Access
              </h3>
              <p className="text-gray-600">
                Role-based access control for regional managers, property managers, and maintenance coordinators. 
                Audit trails included.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Quality Assurance
              </h3>
              <p className="text-gray-600">
                Score leasing agent calls, maintenance response times, and tenant satisfaction. 
                Identify training opportunities across properties.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Stop Losing Disputes
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Property managers waste thousands annually in frivolous disputes. Word Is Bond provides 
                the evidence you need to resolve conflicts quickly and fairly.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Reduce Legal Costs</h3>
                    <p className="text-gray-600">
                      Settle disputes faster with clear documentation. Avoid costly court proceedings 
                      with evidence that speaks for itself.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Protect Security Deposits</h3>
                    <p className="text-gray-600">
                      Document move-in/move-out conditions, maintenance agreements, and damage disputes 
                      with timestamp-accurate records.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Improve Response Times</h3>
                    <p className="text-gray-600">
                      Track maintenance request timelines with precision. Demonstrate compliance 
                      with habitability requirements.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                Dispute Resolution ROI
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Security Deposit Disputes</span>
                    <span className="text-sm font-semibold text-green-600">-75%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: '75%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Eviction Costs</span>
                    <span className="text-sm font-semibold text-green-600">-60%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: '60%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Legal Fees</span>
                    <span className="text-sm font-semibold text-green-600">-85%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: '85%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Resolution Time</span>
                    <span className="text-sm font-semibold text-green-600">-70%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: '70%'}}></div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-6">
                *Based on customer surveys across 50+ property management companies managing 10,000+ units
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Property Management Use Cases
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From single-family rentals to large apartment complexes, Word Is Bond protects your business.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'Tenant Screening & Leasing',
                description: 'Record application conversations, income verification calls, and lease signing discussions with timestamp accuracy.',
                icon: '👤',
              },
              {
                title: 'Maintenance Request Management',
                description: 'Track every maintenance call from initial report through completion. Document vendor coordination and tenant satisfaction.',
                icon: '🔧',
              },
              {
                title: 'Lease Violation Documentation',
                description: 'Record noise complaints, unauthorized occupants, and lease violation discussions for eviction proceedings.',
                icon: '⚠️',
              },
              {
                title: 'Move-In/Move-Out Inspections',
                description: 'Document property condition discussions, security deposit negotiations, and damage assessments over the phone.',
                icon: '📋',
              },
              {
                title: 'Rent Collection & Late Fees',
                description: 'Record rent reminder calls, payment arrangement discussions, and late fee explanations to prevent disputes.',
                icon: '💰',
              },
              {
                title: 'Emergency Response Coordination',
                description: 'Track after-hours emergency calls, vendor dispatch times, and tenant communication during urgent repairs.',
                icon: '🚨',
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
          <h2 className="text-3xl font-bold text-white mb-4">
            Protect Your Properties Today
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join property managers who trust Word Is Bond for tenant documentation and dispute resolution.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/api/auth/signin"
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
