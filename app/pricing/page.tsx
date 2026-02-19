import { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Pricing | Word Is Bond',
  description:
    'Simple, transparent pricing for evidence-grade call monitoring. Per-seat team pricing for debt collection agencies. Start free, scale as you grow.',
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
          <p className="text-lg text-gray-600 mb-4">
            Compliance-ready voice QA with audit-grade evidence.
          </p>
          {/* Annual discount callout */}
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 text-sm text-green-800 font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 8V5a2 2 0 012-2z" />
            </svg>
            Annual plans save 2 months — contact us for annual pricing
          </div>
        </div>
      </section>

      <section className="pb-12 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <PlanCard
            name="Pro"
            price="$49"
            period="/mo"
            description="Operational voice QA for small teams."
            features={[
              'Recording + transcription',
              'Evidence manifests',
              'Export bundle (basic)',
              'Email artifacts',
            ]}
            cta="Start Pro"
            plan="pro"
          />
          <PlanCard
            name="Business"
            price="$149"
            period="/mo"
            description="Audit-ready evidence and translation."
            highlight
            badge="Most Popular"
            features={[
              'Audit-ready evidence bundle',
              'Verification endpoint',
              'Translation + TTS',
              'Secret shopper scripts',
              'Reg F compliance engine',
            ]}
            cta="Upgrade to Business"
            plan="business"
          />
          <PlanCard
            name="Team"
            price="$15"
            period="/agent/mo"
            priceNote="5-seat minimum · $75/mo min"
            description="Per-seat pricing for collection agencies with 5–150 agents."
            features={[
              'Everything in Business',
              'Per-seat agent licensing',
              'Volume call handling',
              'Manager scorecards & QA',
              'FDCPA evidence bundles per agent',
            ]}
            cta="Get Team Pricing"
            plan="team"
          />
          <PlanCard
            name="Enterprise"
            price="Custom"
            period=""
            description="Full compliance controls, SLAs, and dedicated support."
            features={[
              'Retention controls + legal hold',
              'Dedicated compliance support',
              'SSO + custom roles',
              'Custom compliance requirements',
              'Annual contract + SLA',
            ]}
            cta="Request Demo"
            plan="enterprise"
          />
        </div>

        {/* Per-seat explainer */}
        <div className="max-w-6xl mx-auto mt-8 p-5 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Why per-seat pricing for collection agencies?
              </p>
              <p className="text-sm text-blue-800">
                A 30-seat agency at $15/agent pays $450/mo — and avoids a single $1,500+ FDCPA
                violation in the first week. The ROI is structural. Each agent seat comes with its
                own evidence bundle, Reg F compliance engine access, and bilingual TTS call delivery.
              </p>
            </div>
            <Link
              href="/request-demo"
              className="shrink-0 inline-flex items-center px-4 py-2 bg-blue-700 text-white text-sm font-medium rounded-md hover:bg-blue-800 transition-colors"
            >
              Talk to us about Team pricing
            </Link>
          </div>
        </div>

        {/* Pricing footnote */}
        <p className="max-w-6xl mx-auto mt-4 text-xs text-gray-400 text-center">
          All plans billed monthly. Annual plans available — contact us for a quote. Prices shown in USD. No setup fees.
        </p>
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
  period,
  priceNote,
  description,
  features,
  cta,
  highlight = false,
  badge,
  plan,
}: {
  name: string
  price: string
  period: string
  priceNote?: string
  description: string
  features: string[]
  cta: string
  highlight?: boolean
  badge?: string
  plan: string
}) {
  return (
    <div
      className={`relative border rounded-md p-6 flex flex-col ${highlight ? 'border-primary-600 bg-primary-50' : 'border-gray-200 bg-white'}`}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div className="mb-4">
        <p className="text-sm text-gray-500 uppercase tracking-wide">{name}</p>
        <div className="mt-2 flex items-baseline gap-1">
          <p className="text-3xl font-semibold text-gray-900">{price}</p>
          {period && <span className="text-sm text-gray-500">{period}</span>}
        </div>
        {priceNote && <p className="text-xs text-gray-400 mt-0.5">{priceNote}</p>}
        <p className="text-sm text-gray-600 mt-2">{description}</p>
      </div>
      <ul className="space-y-2 text-sm text-gray-700 mb-6 flex-1">
        {features.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <svg className="w-4 h-4 text-green-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
      <Link
        href={plan === 'enterprise' ? '/request-demo' : plan === 'team' ? '/request-demo?plan=team' : `/signup?plan=${plan}`}
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
