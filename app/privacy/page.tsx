'use client'

import Link from 'next/link'

export default function PrivacyPolicyPage() {
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
          <h1 className="mt-6 text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-muted-foreground">
            Last Updated: February 14, 2026
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <p className="leading-relaxed text-muted-foreground">
              Latimer + Woods Tech LLC (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or
              &quot;our&quot;) operates the Word Is Bond platform (&quot;Service&quot;). This
              Privacy Policy describes how we collect, use, disclose, and safeguard your
              information when you use our AI-powered voice intelligence platform. Please read
              this policy carefully. By accessing or using the Service, you acknowledge that you
              have read and understood this Privacy Policy.
            </p>
          </section>

          {/* 1. Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              1. Information We Collect
            </h2>

            <h3 className="mt-5 text-lg font-medium">1.1 Account Information</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              When you register for an account, we collect:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-muted-foreground">
              <li>Name, email address, and contact information</li>
              <li>Organization name and business details</li>
              <li>Job title and role within your organization</li>
              <li>Authentication credentials (passwords are hashed and never stored in plaintext)</li>
              <li>Billing information (processed and stored securely by Stripe)</li>
            </ul>

            <h3 className="mt-5 text-lg font-medium">1.2 Call Recordings and Voice Data</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              The core functionality of our Service involves processing voice communications:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-muted-foreground">
              <li>Audio recordings of calls made through the platform</li>
              <li>AI-generated transcriptions of call recordings</li>
              <li>Sentiment analysis, compliance scoring, and quality metrics derived from calls</li>
              <li>Call metadata (duration, timestamps, phone numbers, disposition codes)</li>
            </ul>

            <h3 className="mt-5 text-lg font-medium">1.3 AI Analysis Data</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Our AI systems generate the following data from your calls:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-muted-foreground">
              <li>Natural language processing outputs (key phrases, topics, entities)</li>
              <li>Compliance violation detection and flagging</li>
              <li>Agent performance scores and improvement recommendations</li>
              <li>Call outcome predictions and trend analyses</li>
            </ul>

            <h3 className="mt-5 text-lg font-medium">1.4 Usage and Technical Data</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              We automatically collect:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-muted-foreground">
              <li>Browser type, operating system, and device information</li>
              <li>IP addresses and approximate geographic location</li>
              <li>Pages visited, features used, and interaction patterns</li>
              <li>Session identifiers and authentication tokens</li>
              <li>Error logs and performance diagnostics</li>
            </ul>
          </section>

          {/* 2. How We Use Information */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              2. How We Use Your Information
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We use the information we collect for the following purposes:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong>Service Delivery:</strong> To operate, maintain, and provide the core
                features of the platform, including call management, recording, and playback
              </li>
              <li>
                <strong>AI Transcription and Analysis:</strong> To transcribe calls, perform
                sentiment analysis, generate compliance scores, and produce quality assurance
                reports
              </li>
              <li>
                <strong>Compliance Assistance:</strong> To help identify potential FDCPA, TCPA,
                and other regulatory compliance issues in real-time and in post-call review
              </li>
              <li>
                <strong>Analytics and Reporting:</strong> To provide dashboards, performance
                metrics, campaign analytics, and business intelligence insights
              </li>
              <li>
                <strong>Account Management:</strong> To manage your subscription, process payments,
                and communicate about your account
              </li>
              <li>
                <strong>Security:</strong> To detect and prevent fraud, unauthorized access, and
                other malicious activity
              </li>
              <li>
                <strong>Product Improvement:</strong> To improve our algorithms, fix bugs, and
                develop new features (using only anonymized, aggregated data)
              </li>
            </ul>
          </section>

          {/* 3. Data Sharing */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              3. Data Sharing and Third-Party Processors
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground font-medium">
              We do not sell your personal information or call data to third parties. Period.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              We share data only with the following categories of service providers, solely to
              operate the Service:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong>Telnyx:</strong> Voice-over-IP telephony provider for call routing,
                recording, and SIP connectivity
              </li>
              <li>
                <strong>Stripe:</strong> Payment processing for subscription billing and invoicing
              </li>
              <li>
                <strong>Cloudflare:</strong> Content delivery, DDoS protection, web application
                firewall, and edge computing infrastructure (Workers and Pages)
              </li>
              <li>
                <strong>Neon:</strong> PostgreSQL database hosting with branch isolation and
                row-level security
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Each processor is bound by contractual obligations to protect your data and use it
              only for the purposes we specify. We may also disclose information when required by
              law, subpoena, court order, or regulatory request.
            </p>
          </section>

          {/* 4. Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              4. Data Retention
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We retain your data according to the following guidelines:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong>Call Recordings:</strong> Retained for the period configured by your
                organization administrator, with a default of 90 days. Many regulatory frameworks
                require retention of at least 3 years; consult your compliance team.
              </li>
              <li>
                <strong>Transcripts and AI Analysis:</strong> Retained for as long as the
                associated call recording is stored, unless separately configured.
              </li>
              <li>
                <strong>Account Data:</strong> Retained for the duration of your active
                subscription and up to 30 days after termination to allow data export.
              </li>
              <li>
                <strong>Audit Logs:</strong> Retained for a minimum of 7 years to comply with
                financial and regulatory record-keeping requirements.
              </li>
              <li>
                <strong>Anonymized Analytics:</strong> Retained indefinitely in aggregated,
                de-identified form for product improvement.
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Organization administrators can configure retention periods for their team via the
              Settings panel. Upon request, we can permanently delete all organization data,
              subject to legal hold requirements.
            </p>
          </section>

          {/* 5. Security Measures */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              5. Security Measures
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We implement industry-leading security measures to protect your data:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong>Encryption at Rest:</strong> All sensitive data is encrypted using AES-256
                encryption
              </li>
              <li>
                <strong>Encryption in Transit:</strong> All communications use TLS 1.3 with strong
                cipher suites
              </li>
              <li>
                <strong>Web Application Firewall:</strong> Cloudflare WAF provides real-time
                threat detection and DDoS mitigation
              </li>
              <li>
                <strong>Database Security:</strong> Neon PostgreSQL with row-level security (RLS)
                ensures strict multi-tenant data isolation — no organization can access another
                organization&apos;s data
              </li>
              <li>
                <strong>Access Control:</strong> Role-based access control (RBAC) with granular
                permissions for owners, managers, supervisors, and agents
              </li>
              <li>
                <strong>Audit Logging:</strong> Comprehensive audit trail of all data access and
                modifications
              </li>
              <li>
                <strong>Rate Limiting:</strong> API rate limiting and brute-force protection on
                all authentication endpoints
              </li>
              <li>
                <strong>Regular Reviews:</strong> Periodic security audits and penetration testing
              </li>
            </ul>
          </section>

          {/* 6. Your Rights */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              6. Your Rights
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Depending on your jurisdiction, you may have the following rights regarding your
              personal data:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong>Right to Access:</strong> Request a copy of the personal data we hold
                about you
              </li>
              <li>
                <strong>Right to Deletion:</strong> Request deletion of your personal data,
                subject to legal retention requirements
              </li>
              <li>
                <strong>Right to Export:</strong> Request a machine-readable export of your data
                (call recordings, transcripts, reports) via the Settings panel or by contacting
                support
              </li>
              <li>
                <strong>Right to Opt-Out of AI Analysis:</strong> Request that your calls not be
                processed by AI analysis features; note that this will disable transcription,
                compliance scoring, and sentiment analysis for your account
              </li>
              <li>
                <strong>Right to Correction:</strong> Request correction of inaccurate personal
                data
              </li>
              <li>
                <strong>Right to Restriction:</strong> Request restriction of processing in
                certain circumstances
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              To exercise any of these rights, please contact us at{' '}
              <a
                href="mailto:privacy@wordis-bond.com"
                className="text-primary hover:underline"
              >
                privacy@wordis-bond.com
              </a>
              . We will respond within 30 days of receiving your verified request.
            </p>
          </section>

          {/* 7. FDCPA/TCPA Compliance */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              7. FDCPA and TCPA Compliance
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Word Is Bond provides tools designed to assist organizations with compliance
              monitoring under the Fair Debt Collection Practices Act (FDCPA), the Telephone
              Consumer Protection Act (TCPA), and other applicable regulations. However:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                The platform is a compliance assistance tool — it does <strong>not</strong>{' '}
                guarantee regulatory compliance
              </li>
              <li>
                You are solely responsible for ensuring your collection practices comply with all
                applicable laws
              </li>
              <li>
                AI-generated compliance scores and flags are advisory in nature and should be
                reviewed by qualified compliance personnel
              </li>
              <li>
                We recommend consulting with legal counsel to establish compliant policies and
                procedures for your organization
              </li>
            </ul>
          </section>

          {/* 8. Children's Privacy */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              8. Children&apos;s Privacy
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              The Service is not intended for use by individuals under the age of 18. We do not
              knowingly collect personal information from anyone under 18 years of age. If we
              learn that we have collected personal information from a minor, we will take steps
              to delete that information promptly. If you are a parent or guardian and believe
              your child has provided us with personal information, please contact us at{' '}
              <a
                href="mailto:privacy@wordis-bond.com"
                className="text-primary hover:underline"
              >
                privacy@wordis-bond.com
              </a>
              .
            </p>
          </section>

          {/* 9. Changes to This Policy */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              9. Changes to This Policy
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We may update this Privacy Policy from time to time to reflect changes in our
              practices, technology, legal requirements, or other factors. When we make material
              changes, we will:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2 text-muted-foreground">
              <li>Update the &quot;Last Updated&quot; date at the top of this page</li>
              <li>Notify registered users via email or in-app notification</li>
              <li>
                Provide a summary of changes for significant updates to data handling practices
              </li>
            </ul>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Your continued use of the Service after the effective date of any changes
              constitutes your acceptance of the revised policy.
            </p>
          </section>

          {/* 10. Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold border-b border-border pb-2">
              10. Contact Information
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              If you have any questions, concerns, or requests regarding this Privacy Policy or
              our data practices, please contact us at:
            </p>
            <div className="mt-4 rounded-lg border border-border bg-muted/50 p-6">
              <p className="font-semibold">Latimer + Woods Tech LLC</p>
              <p className="mt-1 text-muted-foreground">Word Is Bond — Privacy Team</p>
              <p className="mt-2 text-muted-foreground">
                Email:{' '}
                <a
                  href="mailto:privacy@wordis-bond.com"
                  className="text-primary hover:underline"
                >
                  privacy@wordis-bond.com
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
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
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
