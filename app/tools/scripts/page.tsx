'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import dynamic from 'next/dynamic'

const ShopperScriptManager = dynamic(() => import('@/components/voice/ShopperScriptManager'), { ssr: false })

export default function ScriptsPage() {
  const { data: session } = useSession()
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return
    apiGet(`/api/users/${userId}/organization`)
      .then((data: any) => { if (data.organization?.id) setOrgId(data.organization.id) })
      .catch((err: any) => logger.error('Failed to load org for scripts', err))
  }, [session])

  return (
    <div className="p-4 lg:p-6">
      <ShopperScriptManager organizationId={orgId} />
    </div>
  )
}
