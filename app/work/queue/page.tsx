'use client'

/**
 * /work/queue — Full-screen work queue page
 *
 * Standalone queue view for browsing and filtering accounts.
 */

import React from 'react'
import { useSession } from '@/components/AuthProvider'
import WorkQueuePage from '@/components/cockpit/WorkQueuePage'

export default function QueuePage() {
  const { data: session } = useSession()
  const organizationId = session?.user?.organization_id || null

  return <WorkQueuePage organizationId={organizationId} />
}
