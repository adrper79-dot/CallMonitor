'use client'

import dynamic from 'next/dynamic'

const ObjectionLibrary = dynamic(() => import('@/components/voice/ObjectionLibrary'), { ssr: false })

export default function ObjectionsPage() {
  return (
    <div className="p-4 lg:p-6">
      <ObjectionLibrary />
    </div>
  )
}
