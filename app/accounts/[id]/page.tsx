/**
 * /accounts/[id] — Server wrapper for static export
 *
 * generateStaticParams returns a placeholder so Next.js can statically
 * export this route shell. The actual content is fully client-rendered
 * (useParams picks up the real ID at runtime via Cloudflare Pages SPA routing).
 */

import AccountDetailClient from './AccountDetailClient'

export function generateStaticParams() {
  // Return a single placeholder — Cloudflare Pages SPA fallback
  // delivers this shell for any /accounts/:id path at runtime
  return [{ id: 'placeholder' }]
}

export default function AccountDetailPage() {
  return <AccountDetailClient />
}
