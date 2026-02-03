export interface ArtifactReference {
  type: 'recording' | 'transcript' | 'translation' | 'survey' | 'score'
  id: string
  uri?: string
  sha256?: string
  produced_by: 'system' | 'human' | 'model'
  produced_by_model?: string
  produced_by_user_id?: string
  produced_at: string
  input_refs?: Array<{ type: string; id: string; hash?: string }>
  version: number
  metadata?: Record<string, any>
}
