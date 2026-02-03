import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * Trust Pack Page - Wordis Bond
 * 
 * Public-facing page explaining data handling, retention,
 * export guarantees, and system of record positioning.
 * 
 * Reference: ARCH_DOCS/01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md
 */

export default function TrustPackPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="font-semibold text-gray-900">Wordis Bond</span>
          </Link>
          <Link 
            href="/dashboard"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Go to App
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-semibold text-gray-900 mb-4">
            Trust Pack
          </h1>
          <p className="text-xl text-gray-600">
            How we handle your data, what we guarantee,<br />
            and why you can trust Wordis Bond as your system of record.
          </p>
        </div>
      </section>

      {/* System of Record Definition */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            What "System of Record" Means
          </h2>
          <div className="prose prose-gray max-w-none">
            <p>
              A <strong>system of record</strong> is the authoritative source for a particular 
              piece of data. When disputes arise, when questions are asked, when proof is needed — 
              the system of record is where you go.
            </p>
            <p>
              Wordis Bond is designed from the ground up to be the system of record for your 
              business conversations. This means:
            </p>
            <ul>
              <li><strong>Source recordings are never modified</strong> after capture</li>
              <li><strong>Transcripts are versioned and immutable</strong> — changes create new versions</li>
              <li><strong>Every artifact has provenance</strong> — who created it, when, and how</li>
              <li><strong>Cryptographic hashes</strong> ensure integrity can be verified</li>
              <li><strong>Audit logs track all access</strong> — who viewed what, when</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Artifact Authority */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Artifact Authority Classification
          </h2>
          <p className="text-gray-600 mb-6">
            We explicitly classify every artifact as either <strong>Authoritative</strong> (legally 
            defensible, canonical) or <strong>Preview</strong> (real-time assist only, not evidential).
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Artifact</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Authority</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Producer</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Mutable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-3 px-4 text-gray-700">Call Record</td>
                  <td className="py-3 px-4"><AuthBadge type="authoritative" /></td>
                  <td className="py-3 px-4 text-gray-500">Server</td>
                  <td className="py-3 px-4 text-gray-500">Limited</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-700">Source Recording</td>
                  <td className="py-3 px-4"><AuthBadge type="authoritative" /></td>
                  <td className="py-3 px-4 text-gray-500">SignalWire</td>
                  <td className="py-3 px-4 text-gray-500">No</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-700">Canonical Transcript</td>
                  <td className="py-3 px-4"><AuthBadge type="authoritative" /></td>
                  <td className="py-3 px-4 text-gray-500">AssemblyAI</td>
                  <td className="py-3 px-4 text-gray-500">No</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-700">Evidence Manifest</td>
                  <td className="py-3 px-4"><AuthBadge type="authoritative" /></td>
                  <td className="py-3 px-4 text-gray-500">System CAS</td>
                  <td className="py-3 px-4 text-gray-500">No</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-700">Audit Logs</td>
                  <td className="py-3 px-4"><AuthBadge type="authoritative" /></td>
                  <td className="py-3 px-4 text-gray-500">Server</td>
                  <td className="py-3 px-4 text-gray-500">No</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-700">Live Translation</td>
                  <td className="py-3 px-4"><AuthBadge type="preview" /></td>
                  <td className="py-3 px-4 text-gray-500">SignalWire AI</td>
                  <td className="py-3 px-4 text-gray-500">N/A</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-700">AI Summaries</td>
                  <td className="py-3 px-4"><AuthBadge type="preview" /></td>
                  <td className="py-3 px-4 text-gray-500">OpenAI</td>
                  <td className="py-3 px-4 text-gray-500">N/A</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Data Retention */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Data Retention Policy
          </h2>
          <div className="space-y-6">
            <PolicyItem 
              title="Call Records"
              description="Retained for the duration of your account plus 90 days after account closure."
            />
            <PolicyItem 
              title="Source Recordings"
              description="Stored securely in dedicated media storage. Available for export at any time. Retained per your plan terms."
            />
            <PolicyItem 
              title="Transcripts & Evidence"
              description="Immutable once created. Retained as long as the associated call record exists."
            />
            <PolicyItem 
              title="Audit Logs"
              description="Append-only logs retained for minimum 7 years for compliance purposes."
            />
          </div>
        </div>
      </section>

      {/* Export Guarantees */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Export Guarantees
          </h2>
          <div className="prose prose-gray max-w-none">
            <p>
              Your data is yours. We provide complete, self-contained export bundles that 
              work <strong>without Wordis Bond</strong>.
            </p>
            <p>Every export includes:</p>
            <ul>
              <li><strong>Call metadata</strong> — timestamps, participants, duration</li>
              <li><strong>Source recording</strong> — original audio file</li>
              <li><strong>Canonical transcript</strong> — versioned, with hashes</li>
              <li><strong>Translations</strong> — if applicable</li>
              <li><strong>Scores & surveys</strong> — all QA data</li>
              <li><strong>Evidence manifest</strong> — cryptographic provenance chain</li>
              <li><strong>README</strong> — human-readable explanation of contents</li>
            </ul>
            <p>
              Export bundles are <strong>deterministic</strong> — the same call will always 
              produce the same export. Hash verification is built in.
            </p>
          </div>
        </div>
      </section>

      {/* Evidence Independence */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Evidence Independence
          </h2>
          <div className="p-6 bg-primary-50 border border-primary-200 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Your evidence is preserved even if you disable AI features.
                </h3>
                <p className="text-gray-600">
                  Source recordings are always captured. You can disable transcription, translation, 
                  or any AI feature — your call evidence remains intact and exportable. The core 
                  system of record functionality is independent of AI processing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Security Architecture
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <SecurityItem 
              title="Server-Side Orchestration"
              description="All call control happens server-side. No client-side spoofing possible."
            />
            <SecurityItem 
              title="Tenant Isolation"
              description="Row-level security ensures complete data isolation between organizations."
            />
            <SecurityItem 
              title="Role-Based Access"
              description="Granular permissions control who can view, edit, or export evidence."
            />
            <SecurityItem 
              title="Append-Only Audit"
              description="All access is logged. Logs cannot be modified or deleted."
            />
            <SecurityItem 
              title="Encryption at Rest"
              description="All data encrypted with industry-standard algorithms."
            />
            <SecurityItem 
              title="Encryption in Transit"
              description="TLS 1.3 for all communications. No exceptions."
            />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Questions?
          </h2>
          <p className="text-gray-600 mb-6">
            If you have questions about our data handling practices, security architecture, 
            or need specific compliance documentation, we're here to help.
          </p>
          <Link 
            href="mailto:trust@wordisbond.com"
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
          >
            Contact Trust Team
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-200">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-sm text-gray-500">Wordis Bond — System of Record</span>
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
 * Authority Badge Component
 */
function AuthBadge({ type }: { type: 'authoritative' | 'preview' }) {
  if (type === 'authoritative') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Authoritative
      </span>
    )
  }
  
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
      <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      Preview
    </span>
  )
}

/**
 * Policy Item Component
 */
function PolicyItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}

/**
 * Security Item Component
 */
function SecurityItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4 bg-white rounded-md border border-gray-200">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <div>
          <h3 className="font-medium text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </div>
  )
}
