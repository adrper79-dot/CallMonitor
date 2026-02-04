'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useRBAC } from '@/hooks/useRBAC'
import { logger } from '@/lib/logger'
import { apiGet, apiPost, apiDelete } from '@/lib/api-client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

interface SurveyQuestion {
  id: string
  text: string
  type: 'scale' | 'yes_no' | 'text' | 'multiple_choice'
  options?: string[]
  required: boolean
  order: number
}

interface Survey {
  id: string
  name: string
  description?: string
  questions: SurveyQuestion[]
  is_active: boolean
  created_at: string
  use_count?: number
}

interface SurveyBuilderProps {
  organizationId: string | null
}

const QUESTION_TYPES = [
  { value: 'scale', label: 'Rating Scale (1-5)' },
  { value: 'yes_no', label: 'Yes/No' },
  { value: 'text', label: 'Free Text' },
  { value: 'multiple_choice', label: 'Multiple Choice' }
]

/**
 * SurveyBuilder - Professional Design System v3.0
 * Light theme, no emojis, Navy primary color
 */
export default function SurveyBuilder({ organizationId }: SurveyBuilderProps) {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const { role, plan } = useRBAC(organizationId)
  const canEdit = role === 'owner' || role === 'admin'
  const hasSurveyFeature = plan && ['insights', 'global', 'business', 'enterprise'].includes(plan)

  // Editor state
  const [editingSurvey, setEditingSurvey] = useState<Partial<Survey> | null>(null)
  const [newQuestion, setNewQuestion] = useState<Partial<SurveyQuestion>>({
    text: '',
    type: 'scale',
    required: true
  })
  const [newOption, setNewOption] = useState('')

  const fetchSurveys = async () => {
    if (!organizationId) return
    
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet(`/api/surveys?orgId=${encodeURIComponent(organizationId)}`)
      
      if (data.success) {
        setSurveys(data.surveys || [])
      } else {
        if (data.error?.code === 'PLAN_LIMIT_EXCEEDED') {
          setSurveys([])
        } else {
          setError(data.error?.message || data.error || 'Failed to load surveys')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load surveys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSurveys()
  }, [organizationId])

  const handleNewSurvey = () => {
    setEditingSurvey({
      name: '',
      description: '',
      questions: [],
      is_active: true
    })
    setShowEditor(true)
  }

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurvey({ ...survey })
    setShowEditor(true)
  }

  const handleSaveSurvey = async () => {
    if (!editingSurvey || !organizationId || !editingSurvey.name) return
    
    try {
      setSaving(true)
      setError(null)
      
      const data = await apiPost('/api/surveys', {
        ...editingSurvey,
        organization_id: organizationId
      })
      
      if (data.success) {
        setShowEditor(false)
        setEditingSurvey(null)
        fetchSurveys()
      } else {
        setError(data.error?.message || data.error || 'Failed to save survey')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save survey')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSurvey = async (surveyId: string) => {
    if (!confirm('Delete this survey?')) return
    
    try {
      await apiDelete(`/api/surveys?id=${surveyId}&orgId=${organizationId}`)
      fetchSurveys()
    } catch (err) {
      logger.error('SurveyBuilder: failed to delete survey', err, {
        organizationId,
        surveyId
      })
    }
  }

  const addQuestion = () => {
    if (!editingSurvey || !newQuestion.text || !newQuestion.type) return
    
    const question: SurveyQuestion = {
      id: `q_${Date.now()}`,
      text: newQuestion.text,
      type: newQuestion.type as any,
      options: newQuestion.type === 'multiple_choice' ? newQuestion.options : undefined,
      required: newQuestion.required ?? true,
      order: (editingSurvey.questions?.length || 0) + 1
    }
    
    setEditingSurvey({
      ...editingSurvey,
      questions: [...(editingSurvey.questions || []), question]
    })
    
    setNewQuestion({ text: '', type: 'scale', required: true, options: [] })
  }

  const removeQuestion = (questionId: string) => {
    if (!editingSurvey) return
    
    setEditingSurvey({
      ...editingSurvey,
      questions: editingSurvey.questions?.filter(q => q.id !== questionId)
    })
  }

  const addOption = () => {
    if (!newOption.trim()) return
    setNewQuestion({
      ...newQuestion,
      options: [...(newQuestion.options || []), newOption.trim()]
    })
    setNewOption('')
  }

  const removeOption = (index: number) => {
    setNewQuestion({
      ...newQuestion,
      options: newQuestion.options?.filter((_, i) => i !== index)
    })
  }

  if (!organizationId) {
    return <div className="text-gray-500 p-4">Organization required</div>
  }

  if (!hasSurveyFeature) {
    return (
      <div className="text-center py-12 bg-warning-light rounded-md border border-amber-200">
        <svg className="w-12 h-12 mx-auto mb-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h4 className="text-lg font-medium text-gray-900 mb-2">Survey Feature</h4>
        <p className="text-gray-600 mb-4">
          After-call surveys require the Insights plan or higher
        </p>
        <Button onClick={() => window.location.href = '/settings?tab=billing'}>
          Upgrade Plan
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Survey Builder</h3>
          <p className="text-sm text-gray-500">
            Create after-call surveys to gather customer feedback
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleNewSurvey} variant="primary">
            New Survey
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-error-light border border-red-200 rounded-md text-error text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-gray-500">Loading surveys...</div>
      )}

      {/* Empty State */}
      {!loading && surveys.length === 0 && !showEditor && (
        <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Surveys Yet</h4>
          <p className="text-gray-500 mb-4">
            Create a survey to collect feedback after calls
          </p>
          {canEdit && (
            <Button onClick={handleNewSurvey}>Create Your First Survey</Button>
          )}
        </div>
      )}

      {/* Surveys List */}
      {!loading && surveys.length > 0 && !showEditor && (
        <div className="space-y-3">
          {surveys.map((survey) => (
            <div
              key={survey.id}
              className="p-4 bg-white rounded-md border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">{survey.name}</h4>
                    <Badge variant={survey.is_active ? 'success' : 'default'}>
                      {survey.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {survey.description && (
                    <p className="text-sm text-gray-500 mb-2">{survey.description}</p>
                  )}
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>{survey.questions?.length || 0} questions</span>
                    <span>Created {new Date(survey.created_at).toLocaleDateString()}</span>
                    {survey.use_count !== undefined && (
                      <span>{survey.use_count} responses</span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditSurvey(survey)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSurvey(survey.id)}
                      className="text-error hover:text-error"
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Preview questions */}
              {survey.questions && survey.questions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-400 mb-2">Questions:</div>
                  <div className="space-y-1">
                    {survey.questions.slice(0, 3).map((q, idx) => (
                      <div key={q.id} className="text-sm text-gray-600">
                        {idx + 1}. {q.text} 
                        <span className="text-gray-400 ml-2">({q.type})</span>
                      </div>
                    ))}
                    {survey.questions.length > 3 && (
                      <div className="text-xs text-gray-400">
                        +{survey.questions.length - 3} more questions
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Survey Editor */}
      {showEditor && editingSurvey && (
        <div className="bg-white rounded-md border border-gray-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-900">
              {editingSurvey.id ? 'Edit Survey' : 'New Survey'}
            </h4>
            <Button variant="outline" size="sm" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Survey Name"
              value={editingSurvey.name || ''}
              onChange={(e) => setEditingSurvey({ ...editingSurvey, name: e.target.value })}
              placeholder="Customer Satisfaction Survey"
            />
            <Input
              label="Description"
              value={editingSurvey.description || ''}
              onChange={(e) => setEditingSurvey({ ...editingSurvey, description: e.target.value })}
              placeholder="Post-call survey to measure satisfaction"
            />
          </div>

          {/* Questions List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Questions ({editingSurvey.questions?.length || 0})
            </label>
            
            {/* Existing questions */}
            <div className="space-y-2 mb-4">
              {editingSurvey.questions?.map((question, idx) => (
                <div key={question.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-md">
                  <span className="text-gray-400 text-sm w-6">{idx + 1}.</span>
                  <div className="flex-1">
                    <div className="text-sm text-gray-900">{question.text}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="default">{question.type}</Badge>
                      {question.required && <Badge variant="warning">Required</Badge>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(question.id)}
                    className="text-error"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>

            {/* Add new question */}
            <div className="p-4 bg-gray-50 rounded-md border border-gray-200 space-y-3">
              <div className="text-sm font-medium text-gray-700">Add Question</div>
              
              <Input
                label="Question Text"
                value={newQuestion.text || ''}
                onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                placeholder="How satisfied were you with our service today?"
              />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newQuestion.type || 'scale'}
                    onChange={(e) => setNewQuestion({ 
                      ...newQuestion, 
                      type: e.target.value as any,
                      options: e.target.value === 'multiple_choice' ? [] : undefined
                    })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={newQuestion.required ?? true}
                      onChange={(e) => setNewQuestion({ ...newQuestion, required: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                    />
                    Required
                  </label>
                </div>
              </div>

              {/* Multiple choice options */}
              {newQuestion.type === 'multiple_choice' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Add option"
                      onKeyDown={(e) => e.key === 'Enter' && addOption()}
                    />
                    <Button variant="outline" size="sm" onClick={addOption}>
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newQuestion.options?.map((opt, idx) => (
                      <Badge key={idx} variant="default" className="gap-1">
                        {opt}
                        <button onClick={() => removeOption(idx)} className="ml-1 hover:text-error">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                variant="outline" 
                size="sm" 
                onClick={addQuestion}
                disabled={!newQuestion.text}
                className="w-full"
              >
                Add Question
              </Button>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="survey-active"
              checked={editingSurvey.is_active ?? true}
              onChange={(e) => setEditingSurvey({ ...editingSurvey, is_active: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
            />
            <label htmlFor="survey-active" className="text-sm text-gray-700">
              Survey is active and can be assigned to calls
            </label>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSurvey}
              disabled={saving || !editingSurvey.name || !editingSurvey.questions?.length}
              variant="primary"
            >
              {saving ? 'Saving...' : 'Save Survey'}
            </Button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-info-light border border-blue-200 rounded-md">
        <h4 className="text-sm font-medium text-gray-900 mb-2">How Surveys Work</h4>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li><strong>After-Call:</strong> Survey runs automatically after call ends</li>
          <li><strong>AI-Powered:</strong> Voice bot asks questions using natural TTS</li>
          <li><strong>Analytics:</strong> Results appear in call artifacts and dashboard</li>
          <li><strong>Scale Questions:</strong> "Rate 1 to 5" with voice recognition</li>
          <li><strong>Text Questions:</strong> Open-ended responses transcribed</li>
        </ul>
      </div>
    </div>
  )
}
