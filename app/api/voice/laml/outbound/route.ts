import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ARCH_DOCS COMPLIANCE: This endpoint is deprecated. Please use /api/voice/swml/outbound for all outbound call logic.
// If called, respond with migration notice and SWML fallback.
export async function POST() {
  return NextResponse.json({
    error: 'This endpoint is deprecated. Use /api/voice/swml/outbound for outbound calls.',
    migration: 'All outbound call logic must use SWML. See ARCH_DOCS for standards.'
  }, { status: 410 })
}

// ... existing code ...

export async function GET() {
  return NextResponse.json({
    ok: false,
    route: '/api/voice/laml/outbound',
    migration: 'This endpoint is deprecated. Use /api/voice/swml/outbound.'
  }, { status: 410 })
}

