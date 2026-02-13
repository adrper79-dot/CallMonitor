'use client'

import dynamic from 'next/dynamic'

const BugReporter = dynamic(
  () => import('./BugReporter').then(mod => ({ default: mod.BugReporter })),
  { ssr: false }
)

/** Client-side wrapper for BugReporter — safe to import from Server Components */
export default function BugReporterWrapper() {
  return <BugReporter />
}
