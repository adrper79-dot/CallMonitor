'use client'

/**
 * /tools — Agent productivity tools hub
 *
 * Quick links to templates, objections, scripts, payment calculator.
 */

import React from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, BookOpen, ScrollText, Calculator, Wrench } from 'lucide-react'

const tools = [
  { href: '/tools/templates', label: 'Note Templates', desc: 'Pre-built note shortcuts for common scenarios', icon: <FileText className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { href: '/tools/objections', label: 'Objection Library', desc: 'Rebuttals and strategies for common objections', icon: <BookOpen className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50 dark:bg-purple-900/20' },
  { href: '/tools/scripts', label: 'Call Scripts', desc: 'Guided scripts for different call scenarios', icon: <ScrollText className="w-5 h-5 text-teal-600" />, bg: 'bg-teal-50 dark:bg-teal-900/20' },
  { href: '/tools/calculator', label: 'Payment Calculator', desc: 'Calculate payment plans and affordability', icon: <Calculator className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50 dark:bg-amber-900/20' },
]

export default function ToolsPage() {
  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Wrench className="w-5 h-5 text-primary-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Agent Tools</h1>
          <p className="text-sm text-gray-500 mt-0.5">Templates, scripts & calculators</p>
        </div>
      </div>

      <div className="grid gap-3">
        {tools.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${t.bg}`}>
                  {t.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.label}</p>
                  <p className="text-xs text-gray-500">{t.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
