
import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rateLimit'

// ...existing code...

export const dynamic = 'force-dynamic'

// POST /api/voice/bridge: Bridge two PSTN numbers together (Click-to-Call) using SWML only
export async function POST(request: NextRequest) {
    try {
        // --- Config validation ---
        const requiredEnv = [
            'SIGNALWIRE_PROJECT_ID',
            'SIGNALWIRE_TOKEN',
            'SIGNALWIRE_SPACE',
            'SIGNALWIRE_NUMBER',
            'NEXT_PUBLIC_APP_URL',
        ];
        for (const key of requiredEnv) {
            if (!process.env[key]) {
                logger.error(`[Bridge] Missing required env var: ${key}`);
                return NextResponse.json(
                    { success: false, error: { code: 'CONFIG_ERROR', message: `Missing env var: ${key}` } },
                    { status: 500 }
                );
            }
        }

        // --- Auth check ---
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        if (!userId) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        // --- Rate limiting (per user) ---
        const rateLimitKey = `bridge:${userId}`;
        const rateLimit = await checkRateLimit(rateLimitKey, 10, 60 * 60 * 1000); // 10 bridges/hour
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: { code: 'RATE_LIMIT', message: `Too many bridge requests. Try again in ${Math.ceil(rateLimit.resetIn / 1000)}s.` } },
                { status: 429 }
            );
        }

        // --- Get user's organization and RBAC ---
        const { rows: members } = await query(
            `SELECT organization_id, role FROM org_members WHERE user_id = $1 LIMIT 1`,
            [userId]
        );
        const member = members[0];

        if (!member) {
            return NextResponse.json(
                { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
                { status: 403 }
            );
        }
        if (!['owner', 'admin', 'operator'].includes(member.role)) {
            return NextResponse.json(
                { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' } },
                { status: 403 }
            );
        }

        // --- Parse and validate request body ---
        const body = await request.json();
        const { fromNumber, toNumber, callerId } = body;
        if (!fromNumber || !toNumber) {
            return NextResponse.json(
                { success: false, error: { code: 'MISSING_PARAMS', message: 'fromNumber and toNumber required' } },
                { status: 400 }
            );
        }

        // --- SignalWire config ---
        const projectId = process.env.SIGNALWIRE_PROJECT_ID!;
        const apiToken = process.env.SIGNALWIRE_TOKEN!;
        const spaceUrl = process.env.SIGNALWIRE_SPACE!.replace('https://', '').replace(/\/$/, '');
        const defaultCallerId = process.env.SIGNALWIRE_NUMBER!;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

        const callerIdToUse = callerId || defaultCallerId;

        // --- Create call record ---
        const { v4: uuidv4 } = await import('uuid');
        const callId = uuidv4();

        await query(
            `INSERT INTO calls (id, organization_id, created_by, status, caller_id_used)
             VALUES ($1, $2, $3, 'initiating', $4)`,
            [callId, member.organization_id, userId, callerIdToUse]
        );

        // --- Translation config ---
        const { rows: voiceConfigs } = await query(
            `SELECT live_translate, translate_from, translate_to FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
            [member.organization_id]
        );
        const voiceConfig = voiceConfigs[0];
        const translationEnabled = voiceConfig?.live_translate === true &&
            voiceConfig?.translate_from &&
            voiceConfig?.translate_to;

        logger.info('[Bridge] Creating bridge call', {
            callId,
            fromNumber: '[REDACTED]',
            toNumber: '[REDACTED]',
            translationEnabled,
            languages: translationEnabled ? `${voiceConfig.translate_from} → ${voiceConfig.translate_to}` : 'none'
        });

        // --- Step 1: Dial the first leg (agent/operator) ---
        // Validate phone numbers
        const phoneRegex = /^\+?\d{10,15}$/;
        if (!fromNumber.match(phoneRegex) || !toNumber.match(phoneRegex)) {
            logger.error('[Bridge] Invalid phone number format', { fromNumber, toNumber });
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_PHONE', message: 'Invalid phone number format' } },
                { status: 400 }
            );
        }
        const endpoint = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`;
        const authString = Buffer.from(`${projectId}:${apiToken}`).toString('base64');
        const conferenceName = `bridge-${callId}`;
        const swmlUrl = `${appUrl}/api/voice/swml/bridge?` +
            `callId=${callId}&` +
            `conferenceName=${encodeURIComponent(conferenceName)}&` +
            `leg=first&` +
            `toNumber=${encodeURIComponent(toNumber)}&` +
            `translationEnabled=${translationEnabled}` +
            (translationEnabled ? `&fromLang=${voiceConfig.translate_from}&toLang=${voiceConfig.translate_to}` : '');
        logger.info('[Bridge] Using SWML for translation support', { swmlUrl });
        const requestBody1 = {
            From: callerIdToUse,
            To: fromNumber,
            Url: swmlUrl
        };
        logger.info('[Bridge] Sending first leg request', { requestBody1 });
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(requestBody1).toString()
        });
        if (!response.ok) {
            const errorText = await response.text();
            let parsedError = {};
            try { parsedError = JSON.parse(errorText || '{}'); } catch { }
            if ((parsedError as any).code === '21211') {
                logger.error('[Bridge] Missing To parameter (first leg)', { requestBody1 });
            }
            logger.error('[Bridge] SignalWire Error (first leg)', { status: response.status, error: errorText, requestBody1 });
            await query(`UPDATE calls SET status = 'failed' WHERE id = $1`, [callId]);
            return NextResponse.json(
                { success: false, error: { code: 'SIGNALWIRE_ERROR', message: `Bridge failed: ${response.status}`, details: parsedError } },
                { status: 502 }
            );
        }
        const firstLegData = await response.json();

        // --- Step 2: Dial the second leg (customer) ---
        const swmlUrl2 = `${appUrl}/api/voice/swml/bridge?` +
            `callId=${callId}&` +
            `conferenceName=${encodeURIComponent(conferenceName)}&` +
            `leg=second&` +
            `translationEnabled=${translationEnabled}` +
            (translationEnabled ? `&fromLang=${voiceConfig.translate_from}&toLang=${voiceConfig.translate_to}` : '');
        logger.info('[Bridge] Dialing second leg with SWML', { swmlUrl: swmlUrl2 });
        const requestBody2 = {
            From: callerIdToUse,
            To: toNumber,
            Url: swmlUrl2
        };
        logger.info('[Bridge] Sending second leg request', { requestBody2 });
        const response2 = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(requestBody2).toString()
        });
        if (!response2.ok) {
            const errorText2 = await response2.text();
            let parsedError2 = {};
            try { parsedError2 = JSON.parse(errorText2 || '{}'); } catch { }
            if ((parsedError2 as any).code === '21211') {
                logger.error('[Bridge] Missing To parameter (second leg)', { requestBody2 });
            }
            logger.error('[Bridge] SignalWire Error (second leg)', { status: response2.status, error: errorText2, requestBody2 });
            // First leg is already connected, log but don't fail the whole bridge
            logger.warn('[Bridge] Second leg failed but first leg connected', { callId });
        }
        const secondLegData = await response2.json();

        // --- Update call record with first leg SID ---
        await query(
            `UPDATE calls SET status = 'in-progress', call_sid = $1, started_at = NOW() WHERE id = $2`,
            [firstLegData.sid, callId]
        );

        // --- Audit log ---
        try {
            await query(
                `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, after)
                 VALUES ($1, $2, $3, 'call', $4, 'voice:bridge.initiated', 'human', $5, $6)`,
                [
                    uuidv4(),
                    member.organization_id,
                    userId,
                    callId,
                    userId,
                    JSON.stringify({
                        from: '[REDACTED]',
                        to: '[REDACTED]',
                        first_leg_sid: firstLegData.sid,
                        second_leg_sid: secondLegData.sid,
                        conference: conferenceName
                    })
                ]
            );
        } catch (e) { /* ignore */ }

        logger.info('[Bridge] Both legs initiated', {
            callId,
            firstLegSid: firstLegData.sid,
            secondLegSid: secondLegData.sid,
            conference: conferenceName
        });

        return NextResponse.json({
            success: true,
            callId,
            firstLegSid: firstLegData.sid,
            secondLegSid: secondLegData.sid,
            conference: conferenceName,
            message: 'Bridge call initiated - both parties will be connected in conference'
        });

    } catch (err: any) {
        logger.error('[Bridge] Internal error', err);
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
            { status: 500 }
        );
    }
}
