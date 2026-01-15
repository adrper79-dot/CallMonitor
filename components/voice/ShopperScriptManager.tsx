'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface ExpectedOutcome {
  type: 'keyword' | 'sentiment' | 'duration_min' | 'duration_max' | 'response_time'
  value: any
  weight: number
}

interface ShopperScript {
  id: string
  name: string
  description?: string
  script_text: string
  persona: string
  tts_provider: string
  tts_voice: string
  expected_outcomes: ExpectedOutcome[]
  is_active: boolean
  use_count: number
  created_at: string
}

interface ShopperScriptManagerProps {
  organizationId: string | null
}

const PERSONAS = [
  { value: 'professional', label: '👔 Professional - Formal, business-like' },
  { value: 'casual', label: '😊 Casual - Friendly, relaxed' },
  { value: 'frustrated', label: '😤 Frustrated - Impatient, testing patience' },
  { value: 'elderly', label: '👴 Elderly - Slower, may need repetition' },
  { value: 'non-native', label: '🌍 Non-native - Accent, simpler vocabulary' },
  { value: 'detailed', label: '🔍 Detail-oriented - Many questions' }
]

const TTS_VOICES = {
  signalwire: [
    { value: 'rime.spore', label: 'English - Spore (Default)' },
    { value: 'rime.koda', label: 'English - Koda' },
    { value: 'rime.alberto', label: 'Spanish - Alberto' },
    { value: 'rime.viola', label: 'French - Viola' },
    { value: 'rime.stella', label: 'German - Stella' }
  ],
  elevenlabs: [
    { value: 'rachel', label: 'Rachel (Female, Professional)' },
    { value: 'adam', label: 'Adam (Male, Conversational)' },
    { value: 'custom', label: 'Custom Voice ID' }
  ]
}

export default function ShopperScriptManager({ organizationId }: ShopperScriptManagerProps) {
  const [scripts, setScripts] = useState<ShopperScript[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editor state
  const [editingScript, setEditingScript] = useState<Partial<ShopperScript> | null>(null)
  const [newOutcome, setNewOutcome] = useState<Partial<ExpectedOutcome>>({
    type: 'keyword',
    value: '',
    weight: 20
  })

  const fetchScripts = async () => {
    if (!organizationId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/shopper/scripts/manage?orgId=${organizationId}`, { credentials: 'include' })
      const data = await response.json()
      
      if (data.success) {
        setScripts(data.scripts || [])
      } else {
        setError(data.error || 'Failed to load scripts')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load scripts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScripts()
  }, [organizationId])

  const handleNewScript = () => {
    setEditingScript({
      name: '',
      description: '',
      script_text: `Hello, I'm calling to inquire about your services.

[Wait for response]

I'd like to schedule an appointment for next week if possible.

[Wait for response]

What availability do you have?

[Wait for response]

That sounds good. Can you tell me about your pricing?

[Wait for response]

Thank you for the information. I'll get back to you soon.`,
      persona: 'professional',
      tts_provider: 'signalwire',
      tts_voice: 'rime.spore',
      expected_outcomes: [
        { type: 'keyword', value: ['appointment', 'schedule', 'available'], weight: 30 },
        { type: 'sentiment', value: 'positive', weight: 40 },
        { type: 'duration_min', value: 60, weight: 20 },
        { type: 'response_time', value: 5, weight: 10 }
      ],
      is_active: true
    })
    setShowEditor(true)
  }

  const handleEditScript = (script: ShopperScript) => {
    setEditingScript({ ...script })
    setShowEditor(true)
  }

  const handleSaveScript = async () => {
    if (!editingScript || !organizationId) return
    
    try {
      setSaving(true)
      const response = await fetch('/api/shopper/scripts/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...editingScript,
          organization_id: organizationId
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setShowEditor(false)
        setEditingScript(null)
        fetchScripts()
      } else {
        setError(data.error || 'Failed to save script')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save script')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteScript = async (scriptId: string) => {
    if (!confirm('Delete this script?')) return
    
    try {
      const response = await fetch(`/api/shopper/scripts/manage?id=${scriptId}&orgId=${organizationId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        fetchScripts()
      }
    } catch (err) {
      console.error('Failed to delete script', err)
    }
  }

  const addOutcome = () => {
    if (!editingScript || !newOutcome.type || !newOutcome.value) return
    
    const outcome: ExpectedOutcome = {
      type: newOutcome.type as any,
      value: newOutcome.type === 'keyword' 
        ? (newOutcome.value as string).split(',').map(s => s.trim())
        : newOutcome.value,
      weight: newOutcome.weight || 20
    }
    
    setEditingScript({
      ...editingScript,
      expected_outcomes: [...(editingScript.expected_outcomes || []), outcome]
    })
    
    setNewOutcome({ type: 'keyword', value: '', weight: 20 })
  }

  const removeOutcome = (index: number) => {
    if (!editingScript) return
    
    setEditingScript({
      ...editingScript,
      expected_outcomes: editingScript.expected_outcomes?.filter((_, i) => i !== index)
    })
  }

  if (!organizationId) {
    return <div className="text-slate-400 p-4">Organization required</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-100">🕵️ Secret Shopper Scripts</h3>
          <p className="text-sm text-slate-400">
            Create scripts for synthetic callers to evaluate call quality
          </p>
        </div>
        <Button onClick={handleNewScript} className="bg-blue-600 hover:bg-blue-700">
          + New Script
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-slate-400">Loading scripts...</div>
      )}

      {/* Scripts List */}
      {!loading && scripts.length === 0 && !showEditor && (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-4xl mb-4">🕵️</div>
          <h4 className="text-lg font-medium text-slate-200 mb-2">No Scripts Yet</h4>
          <p className="text-slate-400 mb-4">
            Create a secret shopper script to test your call handling quality
          </p>
          <Button onClick={handleNewScript}>Create Your First Script</Button>
        </div>
      )}

      {!loading && scripts.length > 0 && !showEditor && (
        <div className="space-y-3">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-white">{script.name}</h4>
                    <Badge variant={script.is_active ? 'success' : 'default'}>
                      {script.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="default">{script.persona}</Badge>
                  </div>
                  {script.description && (
                    <p className="text-sm text-slate-400 mb-2">{script.description}</p>
                  )}
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>TTS: {script.tts_provider}</span>
                    <span>Voice: {script.tts_voice}</span>
                    <span>Outcomes: {script.expected_outcomes?.length || 0}</span>
                    <span>Used: {script.use_count} times</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditScript(script)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteScript(script.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Script Editor */}
      {showEditor && editingScript && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-medium text-white">
              {editingScript.id ? 'Edit Script' : 'New Script'}
            </h4>
            <Button variant="outline" size="sm" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Script Name *</label>
              <Input
                value={editingScript.name || ''}
                onChange={(e) => setEditingScript({ ...editingScript, name: e.target.value })}
                placeholder="Appointment Inquiry Test"
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Persona</label>
              <select
                value={editingScript.persona || 'professional'}
                onChange={(e) => setEditingScript({ ...editingScript, persona: e.target.value })}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              >
                {PERSONAS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Description</label>
            <Input
              value={editingScript.description || ''}
              onChange={(e) => setEditingScript({ ...editingScript, description: e.target.value })}
              placeholder="Tests how staff handles appointment requests"
              className="bg-slate-700 border-slate-600"
            />
          </div>

          {/* Script Text */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Script Text * <span className="text-slate-500">(Use [Wait for response] for pauses)</span>
            </label>
            <textarea
              value={editingScript.script_text || ''}
              onChange={(e) => setEditingScript({ ...editingScript, script_text: e.target.value })}
              rows={10}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono text-sm"
              placeholder="Hello, I'm calling to inquire about..."
            />
          </div>

          {/* Voice Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">TTS Provider</label>
              <select
                value={editingScript.tts_provider || 'signalwire'}
                onChange={(e) => setEditingScript({ 
                  ...editingScript, 
                  tts_provider: e.target.value,
                  tts_voice: e.target.value === 'signalwire' ? 'rime.spore' : 'rachel'
                })}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              >
                <option value="signalwire">SignalWire (Default)</option>
                <option value="elevenlabs">ElevenLabs (Premium)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Voice</label>
              <select
                value={editingScript.tts_voice || ''}
                onChange={(e) => setEditingScript({ ...editingScript, tts_voice: e.target.value })}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              >
                {TTS_VOICES[editingScript.tts_provider as keyof typeof TTS_VOICES]?.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Expected Outcomes */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Expected Outcomes (for scoring)
            </label>
            
            {/* Existing outcomes */}
            <div className="space-y-2 mb-4">
              {editingScript.expected_outcomes?.map((outcome, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded">
                  <Badge variant="default">{outcome.type}</Badge>
                  <span className="text-sm text-slate-300 flex-1">
                    {Array.isArray(outcome.value) ? outcome.value.join(', ') : String(outcome.value)}
                  </span>
                  <span className="text-xs text-slate-500">Weight: {outcome.weight}%</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOutcome(idx)}
                    className="text-red-400"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            {/* Add new outcome */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <select
                  value={newOutcome.type}
                  onChange={(e) => setNewOutcome({ ...newOutcome, type: e.target.value as any })}
                  className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                >
                  <option value="keyword">Keyword (comma-separated)</option>
                  <option value="sentiment">Sentiment (positive/negative/neutral)</option>
                  <option value="duration_min">Minimum Duration (seconds)</option>
                  <option value="duration_max">Maximum Duration (seconds)</option>
                  <option value="response_time">Response Time (seconds)</option>
                </select>
              </div>
              <div className="flex-1">
                <Input
                  value={newOutcome.value || ''}
                  onChange={(e) => setNewOutcome({ ...newOutcome, value: e.target.value })}
                  placeholder={newOutcome.type === 'keyword' ? 'appointment, schedule' : 'positive'}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div className="w-20">
                <Input
                  type="number"
                  value={newOutcome.weight || 20}
                  onChange={(e) => setNewOutcome({ ...newOutcome, weight: parseInt(e.target.value) })}
                  placeholder="Weight"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <Button variant="outline" size="sm" onClick={addOutcome}>
                Add
              </Button>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveScript}
              disabled={saving || !editingScript.name || !editingScript.script_text}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? 'Saving...' : 'Save Script'}
            </Button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
        <h4 className="text-sm font-medium text-blue-400 mb-2">💡 How Secret Shopper Works</h4>
        <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
          <li><strong>Script:</strong> The synthetic caller follows this conversation script</li>
          <li><strong>TTS:</strong> Uses SignalWire or ElevenLabs to speak the script naturally</li>
          <li><strong>Expected Outcomes:</strong> What we check for when scoring the call</li>
          <li><strong>Sentiment Analysis:</strong> AI analyzes the overall tone of the call</li>
          <li><strong>Scoring:</strong> Weighted scores based on outcomes (0-100 scale)</li>
        </ul>
      </div>
    </div>
  )
}
