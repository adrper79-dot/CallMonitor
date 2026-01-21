/**
 * GET /api/integrations/hubspot/callback
 * HubSpot OAuth callback handler
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForTokens } from '@/lib/services/crmProviders/hubspot'
import { CRMService } from '@/lib/services/crmService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    try {
        const { searchParams } = new URL(req.url)
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        // Handle OAuth errors
        if (error) {
            logger.error('HubSpot OAuth error', undefined, { error, errorDescription })
            return NextResponse.redirect(
                `${appUrl}/settings/integrations?error=${encodeURIComponent(errorDescription || error)}`
            )
        }

        if (!code || !state) {
            return NextResponse.redirect(`${appUrl}/settings/integrations?error=missing_params`)
        }

        // Decode state to get org and user info
        let stateData: { orgId: string; userId: string; ts: number }
        try {
            stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
        } catch {
            return NextResponse.redirect(`${appUrl}/settings/integrations?error=invalid_state`)
        }

        // Validate state is not too old (15 minutes max)
        if (Date.now() - stateData.ts > 15 * 60 * 1000) {
            return NextResponse.redirect(`${appUrl}/settings/integrations?error=state_expired`)
        }

        // Exchange code for tokens
        const tokenResult = await exchangeCodeForTokens(code)
        if (!tokenResult.success || !tokenResult.tokens) {
            logger.error('HubSpot token exchange failed', undefined, { error: tokenResult.error })
            return NextResponse.redirect(
                `${appUrl}/settings/integrations?error=${encodeURIComponent(tokenResult.error || 'token_exchange_failed')}`
            )
        }

        // Create/update integration
        const crmService = new CRMService(supabaseAdmin)
        const result = await crmService.createIntegration(
            stateData.orgId,
            'hubspot',
            tokenResult.tokens,
            tokenResult.accountInfo?.portalId,
            tokenResult.accountInfo?.hubDomain,
            stateData.userId
        )

        if (!result.success) {
            return NextResponse.redirect(
                `${appUrl}/settings/integrations?error=${encodeURIComponent(result.error || 'integration_failed')}`
            )
        }

        logger.info('HubSpot integration connected', {
            integrationId: result.integrationId,
            orgId: stateData.orgId
        })

        return NextResponse.redirect(`${appUrl}/settings/integrations?success=hubspot_connected`)
    } catch (err: unknown) {
        logger.error('HubSpot callback error', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.redirect(`${appUrl}/settings/integrations?error=unexpected_error`)
    }
}
