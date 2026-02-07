import { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Pricing | Word Is Bond',
  description:
    'Simple, transparent pricing for evidence-grade call monitoring. Start free, scale as you grow.',
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="font-semibold text-gray-900">Wordis Bond</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/trust" className="text-gray-600 hover:text-gray-900">
              Trust Pack
            </Link>
            <Link href="/dashboard" className="text-primary-600 hover:text-primary-700 font-medium">
              Go to App
            </Link>
          </div>
        </div>
      </header>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl font-semibold text-gray-900 mb-4">Pricing</h1>
          <p className="text-lg text-gray-600">
            Compliance-ready voice QA with audit-grade evidence.
          </p>
        </div>
      </section>

      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          <PlanCard
            name="Pro"
            price="$49/mo"
            description="Operational voice QA for small teams."
            features={[
              'Recording + transcription',
              'Evidence manifests',
              'Export bundle (basic)',
              'Email artifacts',
            ]}
            cta="Start Pro"
          />
          <PlanCard
            name="Business"
            price="$149/mo"
            description="Audit-ready evidence and translation."
            highlight
            features={[
              'Audit-ready evidence bundle',
              'Verification endpoint',
              'Translation + TTS',
              'Secret shopper scripts',
            ]}
            cta="Upgrade to Business"
          />
          <PlanCard
            name="Enterprise"
            price="Custom"
            description="Full compliance controls and SLAs."
            features={[
              'Retention controls + legal hold',
              'Dedicated support',
              'SSO + custom roles',
              'Custom compliance requirements',
            ]}
            cta="Talk to Sales"
          />
        </div>
      </section>

      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Upgrade Drivers</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <FeatureCard
              title="Audit‑Ready Evidence"
              description="Custody‑grade bundles with canonical hashing and verification."
            />
            <FeatureCard
              title="Export + Debug Bundle"
              description="Deterministic export packages with manifests and provenance."
            />
            <FeatureCard
              title="Compliance‑First QA"
              description="Scorecards + alerts designed for defensible QA workflows."
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function PlanCard({
  name,
  price,
  description,
  features,
  cta,
  highlight = false,
}: {
  name: string
  price: string
  description: string
  features: string[]
  cta: string
  highlight?: boolean
}) {
  return (
    <div
      className={`border rounded-md p-6 ${highlight ? 'border-primary-600 bg-primary-50' : 'border-gray-200 bg-white'}`}
    >
      <div className="mb-4">
        <p className="text-sm text-gray-500 uppercase tracking-wide">{name}</p>
        <p className="text-3xl font-semibold text-gray-900 mt-2">{price}</p>
        <p className="text-sm text-gray-600 mt-2">{description}</p>
      </div>
      <ul className="space-y-2 text-sm text-gray-700 mb-6">
        {features.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`block text-center py-2 rounded-md font-medium ${
          highlight
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}
