'use client'

import Link from 'next/link'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-muted-foreground">
            Last Updated: February 14, 2026
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* 1. Acceptance of Terms */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              1. Acceptance of Terms
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              By accessing or using the Word Is Bond platform (&quot;Service&quot;), operated by
              Latimer + Woods Tech LLC (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or
              &quot;our&quot;), you agree to be bound by these Terms of Service
              (&quot;Terms&quot;). If you do not agree to these Terms, you may not access or use
              the Service. These Terms apply to all visitors, users, and others who access or use
              the Service, including authorized agents and employees of subscribing organizations.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We reserve the right to update or modify these Terms at any time. Continued use of
              the Service after any such changes constitutes your acceptance of the revised Terms.
              We will notify registered users of material changes via email or in-app notification.
            </p>
          </section>

          {/* 2. Description of Service */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              2. Description of Service
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Word Is Bond is an AI-powered voice intelligence platform designed for call centers
              and debt collection operations. The Service provides:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>Outbound and inbound call management via VoIP telephony</li>
              <li>Real-time call recording, transcription, and AI-powered analysis</li>
              <li>Compliance monitoring and regulatory adherence tools</li>
              <li>Agent performance analytics and quality assurance scoring</li>
              <li>Campaign management and scheduling capabilities</li>
              <li>Team management and role-based access control</li>
              <li>Reporting and business intelligence dashboards</li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              The Service is provided on an &quot;as-is&quot; and &quot;as-available&quot; basis.
              We do not guarantee uninterrupted, error-free, or secure operation of the platform
              at all times.
            </p>
          </section>

          {/* 3. Account Registration and Security */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              3. Account Registration and Security
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              To use the Service, you must register for an account and provide accurate, complete,
              and current information. You are responsible for:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized access or security breach</li>
              <li>Ensuring that all users within your organization comply with these Terms</li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Organization administrators are responsible for managing user roles, permissions,
              and access levels within their accounts. We reserve the right to suspend or
              terminate accounts that violate these Terms or pose a security risk.
            </p>
          </section>

          {/* 4. Acceptable Use Policy */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              4. Acceptable Use Policy
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              You agree to use the Service only for lawful purposes and in compliance with all
              applicable federal, state, and local laws and regulations. Specifically, you agree
              that you will NOT:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                Engage in any debt collection practices that violate the Fair Debt Collection
                Practices Act (FDCPA), the Telephone Consumer Protection Act (TCPA), or any
                applicable state consumer protection statutes
              </li>
              <li>Use the Service to harass, threaten, or intimidate any individual</li>
              <li>Make calls outside of legally permitted hours or to numbers on the Do Not Call registry</li>
              <li>Misrepresent yourself, the amount of a debt, or the legal status of a debt</li>
              <li>Record calls without proper consent as required by applicable state and federal laws</li>
              <li>
                Use the AI features to generate misleading, deceptive, or fraudulent
                communications
              </li>
              <li>Attempt to reverse-engineer, decompile, or exploit the platform&apos;s systems</li>
              <li>
                Share, resell, or sublicense access to the Service without prior written
                authorization
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Violation of this Acceptable Use Policy may result in immediate suspension or
              termination of your account and potential referral to law enforcement authorities.
            </p>
          </section>

          {/* 5. Payment Terms */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              5. Payment Terms
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Access to the Service requires a paid subscription. Payment processing is handled
              securely through Stripe, Inc. By subscribing, you agree to the following:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                Subscription fees are billed in advance on a monthly or annual basis, depending
                on the plan selected
              </li>
              <li>
                All fees are non-refundable except as required by law or as expressly stated in
                your service agreement
              </li>
              <li>
                Usage-based charges (e.g., telephony minutes, AI processing) are billed in arrears
                and itemized in your monthly invoice
              </li>
              <li>
                We reserve the right to adjust pricing with 30 days&apos; written notice prior to
                your next billing cycle
              </li>
              <li>
                Failure to pay may result in suspension of access until the outstanding balance is
                resolved
              </li>
            </ul>
          </section>

          {/* 6. Data Privacy and Recording Consent */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              6. Data Privacy and Recording Consent
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              The Service includes call recording and AI analysis capabilities. You acknowledge
              and agree that:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                You are solely responsible for obtaining all necessary consents before recording
                any call, in compliance with applicable one-party or two-party consent laws
              </li>
              <li>
                Recorded calls, transcriptions, and AI-generated analyses are stored in accordance
                with our{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </li>
              <li>
                We process call data using AI models to provide transcription, sentiment analysis,
                and compliance scoring; this data is not sold to third parties
              </li>
              <li>
                Data retention periods are configurable by organization administrators and subject
                to applicable legal requirements
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              For full details on how we collect, use, and protect your data, please review our{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          {/* 7. Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              7. Intellectual Property
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              All rights, title, and interest in and to the Service — including its design,
              software, algorithms, AI models, documentation, trademarks, and branding — are
              owned by Latimer + Woods Tech LLC or its licensors. These Terms do not grant you
              any right, license, or interest in any intellectual property owned by us, except
              the limited right to use the Service in accordance with these Terms.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              You retain ownership of all data, call recordings, and content that you upload or
              generate through the Service (&quot;Your Content&quot;). By using the Service, you
              grant us a limited, non-exclusive license to process Your Content solely for the
              purpose of providing the Service to you.
            </p>
          </section>

          {/* 8. Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              8. Limitation of Liability
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, LATIMER + WOODS TECH LLC SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, BUSINESS
              INTERRUPTION, OR REGULATORY PENALTIES, ARISING OUT OF OR RELATED TO YOUR USE OF
              THE SERVICE.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE
              TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12)
              MONTHS PRECEDING THE CLAIM. THE SERVICE IS A TOOL TO ASSIST WITH COMPLIANCE; IT
              DOES NOT GUARANTEE REGULATORY COMPLIANCE, AND YOU REMAIN SOLELY RESPONSIBLE FOR
              YOUR OWN COMPLIANCE WITH ALL APPLICABLE LAWS.
            </p>
          </section>

          {/* 9. Termination */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              9. Termination
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Either party may terminate this agreement at any time. You may cancel your
              subscription through your account settings or by contacting our support team.
              We may suspend or terminate your access if:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>You breach any provision of these Terms</li>
              <li>Your use of the Service poses a security or legal risk</li>
              <li>Your account has outstanding unpaid balances beyond 30 days</li>
              <li>Required by law or regulatory order</li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Upon termination, your right to access the Service will cease immediately. You may
              request an export of Your Content within 30 days of termination, after which we may
              delete it in accordance with our data retention policies.
            </p>
          </section>

          {/* 10. Governing Law */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              10. Governing Law
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the
              State of Georgia, United States, without regard to its conflict of law provisions.
              Any legal action or proceeding arising under these Terms shall be brought
              exclusively in the federal or state courts located in Fulton County, Georgia, and
              the parties consent to personal jurisdiction and venue therein.
            </p>
          </section>

          {/* 11. Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              11. Contact Information
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-4 rounded-lg border border-border bg-muted/50 p-6">
              <p className="font-semibold">Latimer + Woods Tech LLC</p>
              <p className="mt-1 text-muted-foreground">Word Is Bond Platform</p>
              <p className="mt-2 text-muted-foreground">
                Email:{' '}
                <a
                  href="mailto:legal@wordis-bond.com"
                  className="text-primary hover:underline"
                >
                  legal@wordis-bond.com
                </a>
              </p>
              <p className="mt-1 text-muted-foreground">
                Website:{' '}
                <a
                  href="https://wordis-bond.com"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://wordis-bond.com
                </a>
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Latimer + Woods Tech LLC. All rights reserved.
          </p>
          <div className="mt-2 space-x-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
