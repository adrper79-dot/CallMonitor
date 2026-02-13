'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

export default function NewCampaignPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [campaignType, setCampaignType] = useState<'outbound' | 'survey' | 'shopper'>('outbound')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Campaign name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await apiPost('/api/campaigns', {
        name: name.trim(),
        description: description.trim(),
        type: campaignType,
        status: 'draft',
      })
      router.push('/campaigns')
    } catch (err: any) {
      logger.error('Failed to create campaign', err)
      setError(err.message || 'Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Create Campaign</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set up a new call campaign for outbound, surveys, or mystery shopping
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>Configure your campaign settings</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Q1 Outbound Sales"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Campaign objectives and notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'outbound' as const, label: 'Outbound', icon: '📞' },
                    { value: 'survey' as const, label: 'Survey', icon: '📋' },
                    { value: 'shopper' as const, label: 'Mystery Shop', icon: '🕵️' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setCampaignType(type.value)}
                      className={`p-4 border rounded-lg text-center transition-all ${
                        campaignType === type.value
                          ? 'border-black bg-gray-50 ring-1 ring-black'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl block mb-1">{type.icon}</span>
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !name.trim()}>
                  {loading ? 'Creating...' : 'Create Campaign'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
    </div>
  )
}
