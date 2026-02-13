'use client'

import dynamic from 'next/dynamic'

const BookingsList = dynamic(() => import('@/components/voice/BookingsList'), { ssr: false })

export default function CallbacksPage() {
  return <BookingsList />
}
