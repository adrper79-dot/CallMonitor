"use client"

import React, { useState } from 'react'
import { useSession } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { apiPost } from '@/lib/apiClient'

// Workers API URL for auth endpoints
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const SESSION_KEY = 'wb-session-token'

// Helper to get stored session token
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_KEY)
}

export default function OrganizationCreatePage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [organizationName, setOrganizationName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationName.trim()) {
      setError('Organization name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await apiPost('/api/organizations', { name: organizationName.trim() })
      
      if (!data) {
        throw new Error('Failed to create organization')
      }

      // Refresh session to get updated organization data
      await update()

      // Redirect to dashboard after successful creation
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to create an organization.</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell organizationName="Create Organization" userEmail={session.user.email || undefined}>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Create Your Organization</CardTitle>
            <CardDescription>
              Set up your organization to get started with Wordis Bond
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="Enter your organization name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Organization
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}