'use client'

/**
 * /accounts/import — CSV account import
 *
 * Smart import wizard with fuzzy column matching, PapaParse parsing,
 * automatic data coercion, and live validation preview.
 *
 * @see components/voice/SmartImportWizard.tsx
 * @see lib/smart-csv-import.ts
 */

import React from 'react'
import SmartImportWizard from '@/components/voice/SmartImportWizard'

export default function AccountImportPage() {
  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <SmartImportWizard />
    </div>
  )
}
