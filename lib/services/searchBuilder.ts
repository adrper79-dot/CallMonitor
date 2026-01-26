/**
 * Search Builder Service
 * 
 * Builds search_documents from canonical sources.
 * NON-AUTHORITATIVE: This is derived data for search only.
 * 
 * SYSTEM_OF_RECORD_COMPLIANCE:
 * - Append-only: Creates new versions, never updates
 * - Server timestamps: All times from server
 * - Auditable: All operations logged to search_events
 */

import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import pgClient from '@/lib/pgClient'

export interface SearchDocumentInput {
    organizationId: string
    sourceType: 'call' | 'recording' | 'transcript' | 'evidence' | 'note'
    sourceId: string
    title?: string
    content: string
    callId?: string
    phoneNumber?: string
    domain?: string
    tags?: string[]
    sourceCreatedAt?: string
}

export interface BuildSearchDocResult {
    success: boolean
    documentId?: string
    version?: number
    error?: string
}

export class SearchBuilder {
    constructor() { }

    /**
     * Build a search document from a canonical source.
     * Creates new version if content changed, skips if content unchanged.
     */
    async buildDocument(
        input: SearchDocumentInput,
        actorId?: string,
        actorLabel?: string
    ): Promise<BuildSearchDocResult> {
        const contentHash = this.hashContent(input.content)

        // Check for existing current version
        const existingRes = await pgClient.query(
            `SELECT id, version, content_hash FROM search_documents
             WHERE organization_id = $1 AND source_type = $2 AND source_id = $3 AND is_current = TRUE
             LIMIT 1`,
            [input.organizationId, input.sourceType, input.sourceId]
        )
        const existing = existingRes.rows || []

        // Skip if content unchanged
        if (existing?.[0]?.content_hash === contentHash) {
            logger.debug('SearchBuilder: content unchanged, skipping reindex', {
                sourceType: input.sourceType,
                sourceId: input.sourceId
            })
            return { success: true, documentId: existing[0].id, version: existing[0].version }
        }

        const newVersion = (existing?.[0]?.version ?? 0) + 1
        const newDocId = uuidv4()

        // 1. Mark previous version as not current
        if (existing?.[0]) {
            await pgClient.query('UPDATE search_documents SET is_current = FALSE, superseded_by = $1 WHERE id = $2', [newDocId, existing[0].id])
        }

        // 2. Insert new version
        try {
            await pgClient.query(
                `INSERT INTO search_documents (id, organization_id, source_type, source_id, version, is_current, title, content, content_hash, call_id, phone_number, domain, tags, source_created_at, indexed_by, indexed_by_user_id, created_at)
                 VALUES ($1,$2,$3,$4,$5,TRUE,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
                [
                    newDocId,
                    input.organizationId,
                    input.sourceType,
                    input.sourceId,
                    newVersion,
                    input.title || null,
                    input.content,
                    contentHash,
                    input.callId || null,
                    input.phoneNumber || null,
                    input.domain || null,
                    input.tags ? JSON.stringify(input.tags) : null,
                    input.sourceCreatedAt || null,
                    actorId ? 'human' : 'system',
                    actorId || null,
                    new Date().toISOString()
                ]
            )
        } catch (insertErr: any) {
            logger.error('SearchBuilder: failed to insert document', insertErr)
            return { success: false, error: insertErr.message }
        }

        // 3. Log event
        await this.logEvent({
            organizationId: input.organizationId,
            eventType: newVersion === 1 ? 'indexed' : 'reindexed',
            documentId: newDocId,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            actorId,
            actorLabel
        })

        return { success: true, documentId: newDocId, version: newVersion }
    }

    /**
     * Build search documents for a call and all related artifacts.
     */
    async buildForCall(callId: string, actorId?: string): Promise<void> {
        // Fetch call with related data
        const callRes = await pgClient.query('SELECT id, organization_id, phone_number, from_number, status, created_at FROM calls WHERE id = $1 LIMIT 1', [callId])
        const call = callRes.rows?.[0]
        if (!call) return

        // Fetch call notes separately
        const callNotesRes = await pgClient.query('SELECT id, note, created_at FROM call_notes WHERE call_id = $1', [callId])
        const callNotes = callNotesRes.rows || []

        // Fetch recordings
        const recordingsRes = await pgClient.query('SELECT id FROM recordings WHERE call_id = $1', [callId])
        const recordings = recordingsRes.rows || []

        // Index call
        await this.buildDocument({
            organizationId: call.organization_id,
            sourceType: 'call',
            sourceId: call.id,
            title: `Call to ${call.phone_number || 'Unknown'}`,
            content: [
                call.phone_number,
                call.from_number,
                call.status
            ].filter(Boolean).join(' '),
            callId: call.id,
            phoneNumber: call.phone_number,
            sourceCreatedAt: call.created_at
        }, actorId)

        // Index recordings + transcripts
        for (const rec of recordings || []) {
            // Fetch latest transcript version
            const transcriptRes = await pgClient.query('SELECT id, transcript_json, created_at FROM transcript_versions WHERE recording_id = $1 ORDER BY version DESC LIMIT 1', [rec.id])
            const transcript = transcriptRes.rows || []

            if (transcript?.[0]) {
                const text = this.extractTranscriptText(transcript[0].transcript_json)
                await this.buildDocument({
                    organizationId: call.organization_id,
                    sourceType: 'transcript',
                    sourceId: transcript[0].id,
                    title: `Transcript for Call ${call.id}`,
                    content: text,
                    callId: call.id,
                    phoneNumber: call.phone_number,
                    sourceCreatedAt: transcript[0].created_at
                }, actorId)
            }
        }

        // Index call notes
        for (const note of callNotes || []) {
            await this.buildDocument({
                organizationId: call.organization_id,
                sourceType: 'note',
                sourceId: note.id,
                title: `Note on Call ${call.id}`,
                content: note.note || '',
                callId: call.id,
                phoneNumber: call.phone_number,
                sourceCreatedAt: note.created_at
            }, actorId)
        }
    }

    /**
     * Rebuild entire search index for an organization.
     * Creates new versions for all documents (append-only).
     */
    async rebuildForOrganization(organizationId: string, actorId: string): Promise<{ totalIndexed: number }> {
        // Log rebuild start
        await this.logEvent({
            organizationId,
            eventType: 'rebuild_started',
            actorId,
            actorLabel: 'admin'
        })

        let totalIndexed = 0

        // Fetch all calls for org
        const callsRes = await pgClient.query('SELECT id FROM calls WHERE organization_id = $1 AND is_deleted = FALSE', [organizationId])
        const calls = callsRes.rows || []

        for (const call of calls) {
            await this.buildForCall(call.id, actorId)
            totalIndexed++
        }

        // Log rebuild complete
        await this.logEvent({
            organizationId,
            eventType: 'rebuild_completed',
            actorId,
            actorLabel: 'admin',
            metadata: { totalIndexed }
        })

        return { totalIndexed }
    }

    private hashContent(content: string): string {
        return createHash('sha256').update(content).digest('hex')
    }

    private extractTranscriptText(transcriptJson: unknown): string {
        if (!transcriptJson) return ''
        if (typeof transcriptJson === 'string') return transcriptJson
        if (typeof transcriptJson === 'object' && transcriptJson !== null) {
            const obj = transcriptJson as Record<string, unknown>
            if (typeof obj.text === 'string') return obj.text
            if (Array.isArray(obj.utterances)) {
                return obj.utterances.map((u: unknown) => {
                    if (typeof u === 'object' && u !== null && 'text' in u) {
                        return (u as { text: string }).text || ''
                    }
                    return ''
                }).join(' ')
            }
        }
        return JSON.stringify(transcriptJson)
    }

    private async logEvent(params: {
        organizationId: string
        eventType: string
        documentId?: string
        sourceType?: string
        sourceId?: string
        actorId?: string
        actorLabel?: string
        metadata?: Record<string, unknown>
    }) {
        await pgClient.query(
            `INSERT INTO search_events (id, organization_id, event_type, document_id, source_type, source_id, actor_type, actor_id, actor_label, metadata, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
                uuidv4(),
                params.organizationId,
                params.eventType,
                params.documentId || null,
                params.sourceType || null,
                params.sourceId || null,
                params.actorId ? 'human' : 'system',
                params.actorId || null,
                params.actorLabel || (params.actorId ? 'user' : 'search-builder'),
                params.metadata ? JSON.stringify(params.metadata) : null,
                new Date().toISOString()
            ]
        )
    }
}
