/**
 * GET /api/integrations/hubspot/callback
 * HubSpot OAuth callback handler
 */

import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/services/crmProviders/hubspot'
import pgClient from '@/lib/pgClient'
import { encryptToken } from '@/lib/services/crmService'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'


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

        const upsertRes = await pgClient.query(
            `INSERT INTO integrations (organization_id, provider, provider_account_id, provider_account_name, status, connected_at, connected_by, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (organization_id, provider)
             DO UPDATE SET provider_account_id = EXCLUDED.provider_account_id, provider_account_name = EXCLUDED.provider_account_name, status = EXCLUDED.status, connected_at = EXCLUDED.connected_at, connected_by = EXCLUDED.connected_by, updated_at = EXCLUDED.updated_at
             RETURNING *`,
            [stateData.orgId, 'hubspot', tokenResult.accountInfo?.portalId ?? null, tokenResult.accountInfo?.hubDomain ?? null, 'active', new Date().toISOString(), stateData.userId, new Date().toISOString()]
        )

        const integration = upsertRes?.rows && upsertRes.rows.length ? upsertRes.rows[0] : null
        if (!integration) {
            return NextResponse.redirect(`${appUrl}/settings/integrations?error=integration_failed`)
        }

        try {
            await pgClient.query(
                `INSERT INTO oauth_tokens (integration_id, access_token_encrypted, refresh_token_encrypted, token_type, expires_at, scopes, instance_url, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 ON CONFLICT (integration_id) DO UPDATE SET access_token_encrypted = EXCLUDED.access_token_encrypted, refresh_token_encrypted = EXCLUDED.refresh_token_encrypted, token_type = EXCLUDED.token_type, expires_at = EXCLUDED.expires_at, scopes = EXCLUDED.scopes, instance_url = EXCLUDED.instance_url, updated_at = EXCLUDED.updated_at`,
                [integration.id, encryptToken(tokenResult.tokens.access_token), tokenResult.tokens.refresh_token ? encryptToken(tokenResult.tokens.refresh_token) : null, tokenResult.tokens.token_type ?? 'Bearer', tokenResult.tokens.expires_at ? tokenResult.tokens.expires_at.toISOString() : null, tokenResult.tokens.scopes ?? null, tokenResult.tokens.instance_url ?? null, new Date().toISOString()]
            )
        } catch (err) {
            logger.error('Failed to store OAuth tokens', err)
            return NextResponse.redirect(`${appUrl}/settings/integrations?error=token_store_failed`)
        }

        await pgClient.query(`INSERT INTO crm_sync_log (id, organization_id, integration_id, operation, status, created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [uuidv4(), stateData.orgId, integration.id, 'oauth_connect', 'success', new Date().toISOString()])
        await pgClient.query(`INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [uuidv4(), stateData.orgId, stateData.userId, 'integration', integration.id, 'connect', new Date().toISOString()])

        logger.info('HubSpot integration connected', {
            integrationId: integration.id,
            orgId: stateData.orgId
        })

        return NextResponse.redirect(`${appUrl}/settings/integrations?success=hubspot_connected`)
    } catch (err: unknown) {
        logger.error('HubSpot callback error', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.redirect(`${appUrl}/settings/integrations?error=unexpected_error`)
    }
}
