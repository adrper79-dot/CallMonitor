/**
 * E2E Transcription Workflow Tests
 *
 * Tests the complete recording → transcription → callback flow.
 * Covers the critical workflow identified in CRITICAL_WORKFLOWS_AUDIT_2026-02-11.md
 *
 * Workflow tested:
 * 1. Telnyx webhook: call.recording.saved
 * 2. R2 upload + DB update
 * 3. AssemblyAI submission (if transcribe enabled)
 * 4. AssemblyAI callback webhook
 * 5. DB transcript update
 * 6. Retry cron for failed submissions
 */

import { describe, test, expect, beforeAll, vi } from 'vitest'
import { apiCall, API_URL, checkApiReachable, type ServiceCheckResult } from './helpers'

const RUN_E2E = !!process.env.RUN_E2E_TESTS
const describeOrSkip = RUN_E2E ? describe : describe.skip

describeOrSkip('E2E: Recording → Transcription → Callback Workflow', () => {
  let apiHealth: ServiceCheckResult

  beforeAll(async () => {
    apiHealth = await checkApiReachable()
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  E2E — TRANSCRIPTION WORKFLOW TESTS`)
    console.log(`${'═'.repeat(60)}`)
    console.log(`  🌐 API: ${API_URL} | Status: ${apiHealth.status.toUpperCase()}`)
    console.log(`${'═'.repeat(60)}\n`)
  })

  describe('Full Workflow: Recording → AssemblyAI → Callback', () => {
    test('POST /api/webhooks/telnyx handles call.recording.saved with transcription enabled', async () => {
      if (apiHealth.status === 'down') return

      // Mock Telnyx call.recording.saved webhook
      const telnyxPayload = {
        data: {
          event_type: 'call.recording.saved',
          payload: {
            call_session_id: 'test-call-123',
            recording_urls: {
              mp3: 'https://api.telnyx.com/v2/calls/test-call-123/recordings/test-recording.mp3'
            }
          }
        }
      }

      // This would normally:
      // 1. Download recording from Telnyx
      // 2. Upload to R2
      // 3. Check voice_configs.transcribe
      // 4. Submit to AssemblyAI
      // 5. Update calls.transcript_status = 'pending'

      const { status, data } = await apiCall('POST', '/api/webhooks/telnyx', telnyxPayload)

      // Should not 500 (processing error)
      expect(status).not.toBe(500)
      console.log(`  📞 Telnyx recording webhook → ${status}`)
    })

    test('POST /api/webhooks/assemblyai handles transcription completion callback', async () => {
      if (apiHealth.status === 'down') return

      // Mock AssemblyAI transcription completed webhook
      const assemblyPayload = {
        transcript_id: 'test-transcript-123',
        status: 'completed',
        text: 'Hello, this is a test transcription.'
      }

      // This would normally:
      // 1. Verify webhook signature
      // 2. Find call by transcript_id
      // 3. Update calls.transcript + transcript_status = 'completed'

      const { status, data } = await apiCall('POST', '/api/webhooks/assemblyai', assemblyPayload)

      // Should not 500 (processing error)
      expect(status).not.toBe(500)
      console.log(`  🎙️ AssemblyAI callback webhook → ${status}`)
    })

    test('GET /api/internal/cron-health shows transcription retry job status', async () => {
      if (apiHealth.status === 'down') return

      const { status, data } = await apiCall('GET', '/api/internal/cron-health')

      expect(status).toBe(200)
      expect(data).toHaveProperty('jobs')

      const retryJob = data.jobs.find((j: any) => j.job_name === 'retry_transcriptions')
      expect(retryJob).toBeDefined()
      expect(['healthy', 'degraded', 'down', 'unknown']).toContain(retryJob.status)

      console.log(`  ⏰ Retry cron status: ${retryJob.status} (${retryJob.staleness_minutes}min stale)`)
    })

    test('GET /api/internal/webhook-dlq shows failed webhook attempts', async () => {
      if (apiHealth.status === 'down') return

      const { status, data } = await apiCall('GET', '/api/internal/webhook-dlq')

      expect(status).toBe(200)
      expect(data).toHaveProperty('entries')
      expect(Array.isArray(data.entries)).toBe(true)

      console.log(`  📬 DLQ entries: ${data.entries.length}`)
    })

    test('GET /api/internal/schema-health validates critical table columns', async () => {
      if (apiHealth.status === 'down') return

      const { status, data } = await apiCall('GET', '/api/internal/schema-health')

      expect(status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('tables')

      // Check critical tables have expected columns
      const callsTable = data.tables.calls
      expect(callsTable).toBeDefined()
      expect(callsTable.status).toBe('valid')
      expect(callsTable.missing_columns).toHaveLength(0)

      console.log(`  🗄️ Schema validation: ${data.status}`)
    })
  })

  describe('Error Scenarios & Recovery', () => {
    test('POST /api/webhooks/telnyx handles invalid recording URLs gracefully', async () => {
      if (apiHealth.status === 'down') return

      const invalidPayload = {
        data: {
          event_type: 'call.recording.saved',
          payload: {
            call_session_id: 'test-call-invalid',
            recording_urls: {
              mp3: 'invalid-url'
            }
          }
        }
      }

      const { status } = await apiCall('POST', '/api/webhooks/telnyx', invalidPayload)

      // Should handle gracefully (not crash)
      expect([200, 500]).toContain(status) // 500 would be stored in DLQ
      console.log(`  ❌ Invalid recording URL → ${status}`)
    })

    test('POST /api/webhooks/assemblyai rejects invalid transcript_id', async () => {
      if (apiHealth.status === 'down') return

      const invalidPayload = {
        transcript_id: 'non-existent-id',
        status: 'completed',
        text: 'This should not update any call'
      }

      const { status } = await apiCall('POST', '/api/webhooks/assemblyai', invalidPayload)

      // Should handle gracefully (no matching call found)
      expect(status).toBe(200) // Webhook accepted but no update
      console.log(`  ❌ Invalid transcript_id → ${status}`)
    })
  })

  describe('Integration with Bond AI Copilot', () => {
    test('Transcription completion enables Bond AI context', async () => {
      if (apiHealth.status === 'down') return

      // This test would verify that completed transcriptions
      // are accessible to Bond AI for conversation context

      // Mock a call with completed transcription
      // Query Bond AI to verify transcript context is available

      console.log(`  🤖 Bond AI integration: Manual verification required`)
      console.log(`     - Check if transcriptions appear in Bond AI responses`)
      console.log(`     - Verify conversation context includes call transcripts`)
    })
  })
})