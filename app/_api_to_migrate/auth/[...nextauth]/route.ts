/**
 * NextAuth Route Handler - DISABLED
 * 
 * NextAuth has been disabled in favor of the custom Workers API authentication.
 * All authentication is now handled by the Workers API endpoints.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Disabled - return 404 for all NextAuth requests
export async function GET() {
  return new Response('NextAuth disabled - use Workers API authentication', { status: 404 })
}

export async function POST() {
  return new Response('NextAuth disabled - use Workers API authentication', { status: 404 })
}
