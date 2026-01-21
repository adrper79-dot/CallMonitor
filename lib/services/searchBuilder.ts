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
import { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

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
    constructor(private supabaseAdmin: SupabaseClient) { }

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
        const { data: existing } = await this.supabaseAdmin
            .from('search_documents')
            .select('id, version, content_hash')
            .eq('organization_id', input.organizationId)
            .eq('source_type', input.sourceType)
            .eq('source_id', input.sourceId)
            .eq('is_current', true)
            .limit(1)

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
            await this.supabaseAdmin
                .from('search_documents')
                .update({ is_current: false, superseded_by: newDocId })
                .eq('id', existing[0].id)
        }

        // 2. Insert new version
        const { error: insertErr } = await this.supabaseAdmin
            .from('search_documents')
            .insert({
                id: newDocId,
                organization_id: input.organizationId,
                source_type: input.sourceType,
                source_id: input.sourceId,
                version: newVersion,
                is_current: true,
                title: input.title,
                content: input.content,
                content_hash: contentHash,
                call_id: input.callId,
                phone_number: input.phoneNumber,
                domain: input.domain,
                tags: input.tags,
                source_created_at: input.sourceCreatedAt,
                indexed_by: actorId ? 'human' : 'system',
                indexed_by_user_id: actorId
            })

        if (insertErr) {
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
        const { data: call } = await this.supabaseAdmin
            .from('calls')
            .select('id, organization_id, phone_number, from_number, status, created_at')
            .eq('id', callId)
            .single()

        if (!call) return

        // Fetch call notes separately
        const { data: callNotes } = await this.supabaseAdmin
            .from('call_notes')
            .select('id, note, created_at')
            .eq('call_id', callId)

        // Fetch recordings
        const { data: recordings } = await this.supabaseAdmin
            .from('recordings')
            .select('id')
            .eq('call_id', callId)

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
            const { data: transcript } = await this.supabaseAdmin
                .from('transcript_versions')
                .select('id, transcript_json, created_at')
                .eq('recording_id', rec.id)
                .order('version', { ascending: false })
                .limit(1)

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
        const { data: calls } = await this.supabaseAdmin
            .from('calls')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('is_deleted', false)

        for (const call of calls || []) {
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
        await this.supabaseAdmin.from('search_events').insert({
            id: uuidv4(),
            organization_id: params.organizationId,
            event_type: params.eventType,
            document_id: params.documentId,
            source_type: params.sourceType,
            source_id: params.sourceId,
            actor_type: params.actorId ? 'human' : 'system',
            actor_id: params.actorId,
            actor_label: params.actorLabel || (params.actorId ? 'user' : 'search-builder'),
            metadata: params.metadata
        })
    }
}
