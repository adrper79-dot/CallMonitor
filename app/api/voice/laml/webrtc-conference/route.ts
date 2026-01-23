
// ARCH_DOCS COMPLIANCE: This endpoint is deprecated. Please use /api/voice/swml/bridge for all conference logic.
// If called, respond with migration notice and SWML fallback.
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    return NextResponse.json({
        error: 'This endpoint is deprecated. Use /api/voice/swml/bridge for conference calls.',
        migration: 'All conference logic must use SWML. See ARCH_DOCS for standards.'
    }, { status: 410 })
}

export async function POST() {
    return NextResponse.json({
        error: 'This endpoint is deprecated. Use /api/voice/swml/bridge for conference calls.',
        migration: 'All conference logic must use SWML. See ARCH_DOCS for standards.'
    }, { status: 410 })
}
