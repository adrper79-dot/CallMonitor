'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'

interface VoiceTarget {
  id: string
  phone_number: string
  name?: string
  description?: string
  is_active: boolean
  created_at: string
}

interface VoiceTargetManagerProps {
  organizationId: string | null
  onTargetSelect?: (targetId: string | null) => void
}

export default function VoiceTargetManager({ organizationId, onTargetSelect }: VoiceTargetManagerProps) {
  const [targets, setTargets] = useState<VoiceTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [newNumber, setNewNumber] = useState('')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  
  // Current selected target
  const { config, updateConfig } = useVoiceConfig(organizationId)
  const selectedTargetId = config?.target_id

  const fetchTargets = async () => {
    if (!organizationId) return
    
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/voice/targets?orgId=${encodeURIComponent(organizationId)}`, {
        credentials: 'include'
      })
      const data = await res.json()
      
      if (data.success) {
        setTargets(data.targets || [])
      } else {
        setError(data.error?.message || data.error || 'Failed to load targets')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load targets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTargets()
  }, [organizationId])

  const handleAddTarget = async () => {
    if (!newNumber || !organizationId) return
    
    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/
    if (!e164Regex.test(newNumber)) {
      setError('Phone number must be in E.164 format (e.g., +12025551234)')
      return
    }
    
    try {
      setSaving(true)
      setError(null)
      
      const res = await fetch('/api/voice/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organization_id: organizationId,
          phone_number: newNumber,
          name: newName || undefined,
          description: newDescription || undefined
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setShowAddForm(false)
        setNewNumber('')
        setNewName('')
        setNewDescription('')
        fetchTargets()
        
        // Auto-select the new target if it's the first one
        if (targets.length === 0 && data.target?.id) {
          handleSelectTarget(data.target.id)
        }
      } else {
        setError(data.error?.message || data.error || 'Failed to add target')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add target')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectTarget = async (targetId: string) => {
    if (!organizationId) return
    
    try {
      setError(null)
      await updateConfig({ target_id: targetId })
      onTargetSelect?.(targetId)
    } catch (err: any) {
      setError(err.message || 'Failed to select target')
    }
  }

  const handleDeleteTarget = async (targetId: string) => {
    if (!confirm('Delete this target number?')) return
    
    try {
      const res = await fetch(`/api/voice/targets?id=${targetId}&orgId=${organizationId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (res.ok) {
        // Clear selection if deleting selected target
        if (selectedTargetId === targetId) {
          await updateConfig({ target_id: null })
          onTargetSelect?.(null)
        }
        fetchTargets()
      }
    } catch (err) {
      console.error('Failed to delete target', err)
    }
  }

  if (!organizationId) {
    return <div className="text-slate-400 p-4">Organization required</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-100">📞 Call Targets</h3>
          <p className="text-sm text-slate-400">
            Add phone numbers to call for testing and monitoring
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? 'outline' : 'default'}
        >
          {showAddForm ? 'Cancel' : '+ Add Number'}
        </Button>
      </div>

      {/* Current Selection */}
      {selectedTargetId && (
        <div className="p-4 bg-teal-900/30 rounded-lg border border-teal-700">
          <div className="text-sm text-teal-400 mb-1">Currently Selected Target:</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono text-white">
              {targets.find(t => t.id === selectedTargetId)?.phone_number || selectedTargetId}
            </span>
            <Badge variant="success">Active</Badge>
          </div>
          {targets.find(t => t.id === selectedTargetId)?.name && (
            <div className="text-sm text-slate-400 mt-1">
              {targets.find(t => t.id === selectedTargetId)?.name}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-4">
          <h4 className="font-medium text-white">Add New Target Number</h4>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1">Phone Number *</label>
            <Input
              type="tel"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="+12025551234"
              className="bg-slate-700 border-slate-600"
            />
            <p className="text-xs text-slate-500 mt-1">E.164 format required (e.g., +12025551234)</p>
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1">Name (optional)</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Main Support Line"
              className="bg-slate-700 border-slate-600"
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1">Description (optional)</label>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="24/7 customer support line"
              className="bg-slate-700 border-slate-600"
            />
          </div>
          
          <Button 
            onClick={handleAddTarget}
            disabled={saving || !newNumber}
            className="w-full"
          >
            {saving ? 'Adding...' : 'Add Target Number'}
          </Button>
        </div>
      )}

      {/* Targets List */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading targets...</div>
      ) : targets.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-4xl mb-4">📞</div>
          <h4 className="text-lg font-medium text-slate-200 mb-2">No Target Numbers</h4>
          <p className="text-slate-400 mb-4">
            Add a phone number to start making test calls
          </p>
          <Button onClick={() => setShowAddForm(true)}>Add Your First Target</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {targets.map((target) => (
            <div
              key={target.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                selectedTargetId === target.id
                  ? 'bg-teal-900/30 border-teal-700'
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
              onClick={() => handleSelectTarget(target.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white">{target.phone_number}</span>
                  {selectedTargetId === target.id && (
                    <Badge variant="success">Selected</Badge>
                  )}
                  {target.is_active ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="warning">Inactive</Badge>
                  )}
                </div>
                {target.name && (
                  <div className="text-sm text-slate-400">{target.name}</div>
                )}
                {target.description && (
                  <div className="text-xs text-slate-500">{target.description}</div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectTarget(target.id)
                  }}
                  disabled={selectedTargetId === target.id}
                >
                  {selectedTargetId === target.id ? 'Selected' : 'Select'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteTarget(target.id)
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg text-sm">
        <strong className="text-blue-400">💡 How it works:</strong>
        <ul className="text-slate-300 mt-1 list-disc list-inside">
          <li>Add phone numbers you want to call (support lines, test numbers)</li>
          <li>Select a target to make it active for the next call</li>
          <li>All calls will go to the selected target number</li>
          <li>Use with Secret Shopper scripts for quality testing</li>
        </ul>
      </div>
    </div>
  )
}
