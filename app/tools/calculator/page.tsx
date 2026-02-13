'use client'

import dynamic from 'next/dynamic'

const PaymentCalculator = dynamic(() => import('@/components/voice/PaymentCalculator'), { ssr: false })

export default function CalculatorPage() {
  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <PaymentCalculator />
    </div>
  )
}
