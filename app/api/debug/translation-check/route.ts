import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/translation-check
 * 
 * Diagnostic endpoint to check why translations aren't working
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return ApiErrors.unauthorized()
    }

    // Get user's org
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .limit(1)

    const orgId = userRows?.[0]?.organization_id
    if (!orgId) {
      return ApiErrors.notFound('Organization not found')
    }

    // Check org plan
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('name, plan')
      .eq('id', orgId)
      .limit(1)

    const org = orgRows?.[0]

    // Check voice config
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('*')
      .eq('organization_id', orgId)
      .limit(1)

    const voiceConfig = vcRows?.[0]

    // Check for recent calls with transcriptions
    const { data: recentCalls } = await supabaseAdmin
      .from('calls')
      .select('id, status, started_at, ended_at')
      .eq('organization_id', orgId)
      .order('started_at', { ascending: false })
      .limit(5)

    // Check for ai_runs (transcription/translation)
    const { data: aiRuns } = await supabaseAdmin
      .from('ai_runs')
      .select('id, call_id, model, status, output, completed_at')
      .in('call_id', (recentCalls || []).map(c => c.id))
      .order('started_at', { ascending: false })
      .limit(10)

    // Check for recordings
    const { data: recordings } = await supabaseAdmin
      .from('recordings')
      .select('id, call_sid, recording_url, transcript_json, status')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5)

    // Environment check
    const envCheck = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY ? '✅ SET' : '❌ MISSING',
      ASSEMBLYAI_API_KEY: !!process.env.ASSEMBLYAI_API_KEY ? '✅ SET' : '❌ MISSING',
      ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY ? '✅ SET (audio)' : '⚠️ MISSING (no audio)',
    }

    // Translation status
    const translationStatus = {
      enabled: voiceConfig?.translate === true ? '✅ ENABLED' : '❌ DISABLED',
      from_language: voiceConfig?.translate_from || '❌ NOT SET',
      to_language: voiceConfig?.translate_to || '❌ NOT SET',
      plan_supports: ['global', 'enterprise', 'business', 'pro', 'standard', 'active'].includes(org?.plan?.toLowerCase() || '') 
        ? '✅ SUPPORTED' 
        : `❌ Plan "${org?.plan}" not supported`
    }

    // Issue diagnosis
    const issues: string[] = []
    
    if (!process.env.OPENAI_API_KEY) {
      issues.push('❌ OPENAI_API_KEY not set in Vercel env vars - translation cannot work')
    }
    if (voiceConfig?.translate !== true) {
      issues.push('❌ Translation not enabled in voice_configs')
    }
    if (!voiceConfig?.translate_from) {
      issues.push('❌ translate_from language not set')
    }
    if (!voiceConfig?.translate_to) {
      issues.push('❌ translate_to language not set')
    }
    if (!['global', 'enterprise', 'business', 'pro', 'standard', 'active'].includes(org?.plan?.toLowerCase() || '')) {
      issues.push(`❌ Org plan "${org?.plan}" doesn't support translation`)
    }
    if (!recordings || recordings.length === 0) {
      issues.push('❌ No recordings found - need recordings before translation')
    }
    if (recordings && recordings.every(r => !r.transcript_json)) {
      issues.push('❌ No transcripts found - need transcription before translation')
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: orgId,
        name: org?.name,
        plan: org?.plan
      },
      voice_config: voiceConfig ? {
        record: voiceConfig.record,
        transcribe: voiceConfig.transcribe,
        translate: voiceConfig.translate,
        translate_from: voiceConfig.translate_from,
        translate_to: voiceConfig.translate_to,
        survey: voiceConfig.survey
      } : null,
      environment: envCheck,
      translation_status: translationStatus,
      recent_calls: recentCalls?.length || 0,
      recent_ai_runs: aiRuns?.map(r => ({
        model: r.model,
        status: r.status,
        has_output: !!r.output,
        error: (r.output as any)?.error
      })),
      recent_recordings: recordings?.map(r => ({
        has_url: !!r.recording_url,
        has_transcript: !!r.transcript_json,
        status: r.status
      })),
      issues: issues.length > 0 ? issues : ['✅ No issues detected - translation should work'],
      fix_instructions: issues.length > 0 ? [
        '1. Set OPENAI_API_KEY in Vercel Dashboard → Settings → Environment Variables',
        '2. Go to Voice Operations → Call Settings tab',
        '3. Enable Translation toggle',
        '4. Set From Language and To Language',
        '5. Make a new call with recording enabled',
        '6. Wait for transcription to complete',
        '7. Translation will auto-trigger after transcription'
      ] : []
    })
  } catch (err: any) {
    return ApiErrors.internal(err?.message || 'Translation check failed')
  }
}
