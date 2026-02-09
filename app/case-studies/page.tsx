import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * Case Studies Page
 *
 * Customer success stories with ROI examples demonstrating
 * the value of Word Is Bond as a system of record.
 */

export const metadata = {
  title: 'Case Studies & ROI Examples | Word Is Bond',
  description:
    'Real-world examples of how businesses use Word Is Bond to resolve disputes, reduce legal costs, and maintain compliance. See proven ROI from our customers.',
  keywords: 'case studies, ROI examples, customer success, dispute resolution, legal cost savings',
}

export default function CaseStudiesPage() {
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
            <Link href="/#solutions" className="text-sm text-gray-600 hover:text-gray-900">
              Solutions
            </Link>
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
              Pricing
            </Link>
            <Link href="/trust" className="text-sm text-gray-600 hover:text-gray-900">
              Trust Pack
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

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Real Results from
            <br />
            <span className="text-primary-600">Real Customers</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See how businesses across healthcare, legal, and property management use Word Is Bond to
            resolve disputes, reduce costs, and maintain compliance.
          </p>
        </div>
      </section>

      {/* Case Study 1: Healthcare */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-8 md:p-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                Healthcare
              </div>
              <div className="text-sm text-blue-700 font-medium">Patient Scheduling Clinic</div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Medical Practice Ends 50 &quot;No-Show&quot; Disputes
            </h2>

            <p className="text-lg text-gray-700 mb-8">
              A 12-provider family practice was losing $15,000/month to disputed appointment
              confirmations and &quot;I never agreed to that&quot; billing conflicts. Word Is Bond
              eliminated the problem.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg p-6 border border-blue-200">
                <div className="text-3xl font-bold text-blue-600 mb-2">$180K</div>
                <div className="text-sm text-gray-600">Annual Revenue Protected</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-blue-200">
                <div className="text-3xl font-bold text-blue-600 mb-2">95%</div>
                <div className="text-sm text-gray-600">Dispute Reduction</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-blue-200">
                <div className="text-3xl font-bold text-blue-600 mb-2">2 Hours</div>
                <div className="text-sm text-gray-600">Saved Per Week</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-3">The Challenge:</h3>
              <ul className="space-y-2 text-gray-700 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Patients claiming they never confirmed appointments</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Billing disputes over discussed treatment costs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Insurance verification &quot;he-said/she-said&quot; situations</span>
                </li>
              </ul>

              <h3 className="font-semibold text-gray-900 mb-3">The Solution:</h3>
              <ul className="space-y-2 text-gray-700 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Record all appointment confirmation calls</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Transcribe billing and treatment cost discussions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Export evidence bundles for insurance disputes</span>
                </li>
              </ul>

              <blockquote className="border-l-4 border-blue-600 pl-4 italic text-gray-700">
                &quot;We went from 40-50 no-show disputes per month to less than 3. Patients now
                know we have the recording, and suddenly they &apos;remember&apos; the conversation.
                ROI in the first month.&quot;
              </blockquote>
              <p className="text-sm text-gray-600 mt-2">— Dr. Sarah Chen, Practice Administrator</p>
            </div>
          </div>
        </div>
      </section>

      {/* Case Study 2: Legal */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="bg-purple-50 rounded-2xl border border-purple-200 p-8 md:p-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded-full">
                Legal
              </div>
              <div className="text-sm text-purple-700 font-medium">Immigration Law Firm</div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Law Firm Defeats Malpractice Claim with Documented Evidence
            </h2>

            <p className="text-lg text-gray-700 mb-8">
              A 5-attorney immigration firm faced a $250,000 malpractice claim alleging
              &quot;improper advice.&quot; Word Is Bond&apos;s evidence bundle led to immediate
              dismissal.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg p-6 border border-purple-200">
                <div className="text-3xl font-bold text-purple-600 mb-2">$250K</div>
                <div className="text-sm text-gray-600">Claim Dismissed</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-purple-200">
                <div className="text-3xl font-bold text-purple-600 mb-2">$45K</div>
                <div className="text-sm text-gray-600">Legal Fees Saved</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-purple-200">
                <div className="text-3xl font-bold text-purple-600 mb-2">30 Days</div>
                <div className="text-sm text-gray-600">Case Resolution Time</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-purple-200">
              <h3 className="font-semibold text-gray-900 mb-3">The Challenge:</h3>
              <ul className="space-y-2 text-gray-700 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">•</span>
                  <span>Client claimed attorney gave incorrect advice about visa timing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">•</span>
                  <span>No written record of the disputed phone conversation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">•</span>
                  <span>Malpractice insurer preparing to settle for $150K</span>
                </li>
              </ul>

              <h3 className="font-semibold text-gray-900 mb-3">The Solution:</h3>
              <ul className="space-y-2 text-gray-700 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Retrieved recorded initial consultation with timestamp</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Generated transcript showing exact advice given</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Exported evidence bundle with chain of custody documentation</span>
                </li>
              </ul>

              <blockquote className="border-l-4 border-purple-600 pl-4 italic text-gray-700">
                &quot;The transcript was crystal clear: we gave the correct advice, the client
                misunderstood. Case dismissed within 30 days. Word Is Bond just saved our
                practice.&quot;
              </blockquote>
              <p className="text-sm text-gray-600 mt-2">— Michael Rodriguez, Managing Partner</p>
            </div>
          </div>
        </div>
      </section>

      {/* Case Study 3: Property Management */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-green-50 rounded-2xl border border-green-200 p-8 md:p-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-full">
                Property Management
              </div>
              <div className="text-sm text-green-700 font-medium">Multi-Family Housing</div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Property Manager Cuts Dispute Resolution Time by 85%
            </h2>

            <p className="text-lg text-gray-700 mb-8">
              A 500-unit property management company was spending 20+ hours per week resolving
              tenant disputes. Word Is Bond reduced it to 3 hours.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg p-6 border border-green-200">
                <div className="text-3xl font-bold text-green-600 mb-2">85%</div>
                <div className="text-sm text-gray-600">Faster Resolution</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-green-200">
                <div className="text-3xl font-bold text-green-600 mb-2">$72K</div>
                <div className="text-sm text-gray-600">Annual Savings</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-green-200">
                <div className="text-3xl font-bold text-green-600 mb-2">92%</div>
                <div className="text-sm text-gray-600">Win Rate in Disputes</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-green-200">
              <h3 className="font-semibold text-gray-900 mb-3">The Challenge:</h3>
              <ul className="space-y-2 text-gray-700 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Security deposit disputes every move-out</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Maintenance request &quot;I called 3 times!&quot; conflicts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>Lease violation he-said/she-said arguments</span>
                </li>
              </ul>

              <h3 className="font-semibold text-gray-900 mb-3">The Solution:</h3>
              <ul className="space-y-2 text-gray-700 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Record all tenant phone communications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Track maintenance request timestamps automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Export evidence for eviction proceedings</span>
                </li>
              </ul>

              <blockquote className="border-l-4 border-green-600 pl-4 italic text-gray-700">
                &quot;Disputes resolve in minutes now. We pull the recording, show the tenant, done.
                No more 3-hour back-and-forth arguments. This pays for itself monthly.&quot;
              </blockquote>
              <p className="text-sm text-gray-600 mt-2">— Jennifer Martinez, Regional Manager</p>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Calculate Your ROI</h2>
          <p className="text-lg text-gray-600 mb-12">
            Most customers see positive ROI within the first month.
          </p>

          <div className="grid md:grid-cols-2 gap-8 text-left">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Typical Costs Eliminated:
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex justify-between">
                  <span>Dispute resolution time</span>
                  <span className="font-semibold">15-20 hrs/month</span>
                </li>
                <li className="flex justify-between">
                  <span>Legal consultation fees</span>
                  <span className="font-semibold">$2,000-5,000</span>
                </li>
                <li className="flex justify-between">
                  <span>Settlement costs</span>
                  <span className="font-semibold">$5,000-15,000</span>
                </li>
                <li className="flex justify-between">
                  <span>Lost revenue (no-shows, etc)</span>
                  <span className="font-semibold">$3,000-10,000</span>
                </li>
                <li className="flex justify-between border-t pt-3 mt-3">
                  <span className="font-bold">Monthly Savings</span>
                  <span className="font-bold text-green-600">$10K - $30K</span>
                </li>
              </ul>
            </div>

            <div className="bg-primary-50 rounded-lg border-2 border-primary-600 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Word Is Bond Cost:</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Pro Plan</span>
                  <span className="text-2xl font-bold text-primary-600">$49/mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Business Plan</span>
                  <span className="text-2xl font-bold text-primary-600">$149/mo</span>
                </div>
                <div className="border-t pt-4 mt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">127x - 380x</div>
                    <div className="text-sm text-gray-600">Average ROI Multiple</div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 italic text-center">
                  One prevented dispute pays for a year of service.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to See Results Like These?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Start your 14-day free trial. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
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
              <Link href="/pricing" className="text-sm text-gray-400 hover:text-white">
                Pricing
              </Link>
              <Link href="/trust" className="text-sm text-gray-400 hover:text-white">
                Trust Pack
              </Link>
              <Link href="/compare" className="text-sm text-gray-400 hover:text-white">
                Compare
              </Link>
              <Link href="/verticals/healthcare" className="text-sm text-gray-400 hover:text-white">
                Healthcare
              </Link>
              <Link href="/verticals/legal" className="text-sm text-gray-400 hover:text-white">
                Legal
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
