'use client'

/**
 * SOC2CertificationTracker — SOC 2 certification progress tracking
 *
 * Tracks progress towards SOC 2 Type II certification (6-12 month process).
 * Shows completion status for each SOC 2 trust service criteria.
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ShieldCheck, CheckCircle, Clock, AlertCircle,
  FileText, Users, Lock, Database, Network,
  RefreshCw, Download, ExternalLink
} from 'lucide-react'

interface SOC2Criteria {
  id: string
  category: 'security' | 'availability' | 'processing_integrity' | 'confidentiality' | 'privacy'
  title: string
  description: string
  status: 'not_started' | 'in_progress' | 'completed' | 'verified'
  progress: number
  due_date?: string
  notes?: string
}

const categoryIcons = {
  security: ShieldCheck,
  availability: Network,
  processing_integrity: Database,
  confidentiality: Lock,
  privacy: Users,
}

const categoryColors = {
  security: 'text-blue-600',
  availability: 'text-green-600',
  processing_integrity: 'text-purple-600',
  confidentiality: 'text-orange-600',
  privacy: 'text-pink-600',
}

const statusConfig = {
  not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-800', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-800', icon: ShieldCheck },
}

export default function SOC2CertificationTracker() {
  const [criteria, setCriteria] = useState<SOC2Criteria[]>([])
  const [loading, setLoading] = useState(true)
  const [overallProgress, setOverallProgress] = useState(0)

  // Mock data - in real implementation, this would come from API
  useEffect(() => {
    const mockCriteria: SOC2Criteria[] = [
      {
        id: 'cc1',
        category: 'security',
        title: 'CC1.1 - Control Environment',
        description: 'Demonstrate commitment to integrity and ethical values',
        status: 'completed',
        progress: 100,
        notes: 'Policies and procedures documented'
      },
      {
        id: 'cc2',
        category: 'security',
        title: 'CC2.1 - Communication and Information',
        description: 'Internal and external communications of objectives and responsibilities',
        status: 'completed',
        progress: 100,
        notes: 'Communication protocols established'
      },
      {
        id: 'cc3',
        category: 'security',
        title: 'CC3.1 - Risk Assessment',
        description: 'Identify and assess risks to achieving objectives',
        status: 'in_progress',
        progress: 75,
        due_date: '2026-04-15',
        notes: 'Risk assessment framework in development'
      },
      {
        id: 'cc4',
        category: 'security',
        title: 'CC4.1 - Monitoring Activities',
        description: 'Select, develop, and perform ongoing and/or separate evaluations',
        status: 'in_progress',
        progress: 60,
        due_date: '2026-05-01',
        notes: 'Monitoring controls being implemented'
      },
      {
        id: 'cc5',
        category: 'security',
        title: 'CC5.1 - Control Activities',
        description: 'Select and develop control activities',
        status: 'completed',
        progress: 100,
        notes: 'Access controls and audit logging implemented'
      },
      {
        id: 'cc6',
        category: 'security',
        title: 'CC6.1 - Logical and Physical Access Controls',
        description: 'Restrict logical access to information and systems',
        status: 'completed',
        progress: 100,
        notes: 'RBAC, encryption, and physical security measures in place'
      },
      {
        id: 'cc7',
        category: 'security',
        title: 'CC7.1 - System Operations',
        description: 'Maintain, monitor, and evaluate system operations',
        status: 'in_progress',
        progress: 80,
        due_date: '2026-03-30',
        notes: 'System monitoring and backup procedures'
      },
      {
        id: 'cc8',
        category: 'security',
        title: 'CC8.1 - Change Management',
        description: 'Restrict, authorize, and manage changes to infrastructure',
        status: 'completed',
        progress: 100,
        notes: 'Change management process documented and followed'
      },
      {
        id: 'cc9',
        category: 'security',
        title: 'CC9.1 - Risk Mitigation',
        description: 'Identify and mitigate risks to information assets',
        status: 'in_progress',
        progress: 70,
        due_date: '2026-04-30',
        notes: 'Incident response and business continuity planning'
      },
      {
        id: 'a1',
        category: 'availability',
        title: 'A1.1 - Availability',
        description: 'System availability meets requirements',
        status: 'completed',
        progress: 100,
        notes: '99.9% uptime SLA maintained'
      },
      {
        id: 'pi1',
        category: 'processing_integrity',
        title: 'PI1.1 - Processing Integrity',
        description: 'System processing is complete, valid, accurate, and timely',
        status: 'completed',
        progress: 100,
        notes: 'Data validation and integrity checks implemented'
      },
      {
        id: 'c1',
        category: 'confidentiality',
        title: 'C1.1 - Confidentiality',
        description: 'Information designated as confidential is protected',
        status: 'completed',
        progress: 100,
        notes: 'PII redaction and encryption standards met'
      },
      {
        id: 'p1',
        category: 'privacy',
        title: 'P1.1 - Privacy Notice and Communication',
        description: 'Privacy notice and communication of privacy practices',
        status: 'in_progress',
        progress: 50,
        due_date: '2026-06-01',
        notes: 'Privacy policy review and updates in progress'
      },
      {
        id: 'p2',
        category: 'privacy',
        title: 'P2.1 - Collection',
        description: 'Personal information is collected consistent with privacy notice',
        status: 'completed',
        progress: 100,
        notes: 'Data collection practices documented and compliant'
      },
      {
        id: 'p3',
        category: 'privacy',
        title: 'P3.1 - Use, Retention, and Disposal',
        description: 'Personal information is used, retained, and disposed of consistent with privacy notice',
        status: 'in_progress',
        progress: 65,
        due_date: '2026-05-15',
        notes: 'Data retention policies being finalized'
      }
    ]

    setCriteria(mockCriteria)
    setLoading(false)

    // Calculate overall progress
    const totalProgress = mockCriteria.reduce((sum, item) => sum + item.progress, 0)
    setOverallProgress(Math.round(totalProgress / mockCriteria.length))
  }, [])

  const getCriteriaByCategory = (category: string) => {
    return criteria.filter(c => c.category === category)
  }

  const getCategoryProgress = (category: string) => {
    const categoryCriteria = getCriteriaByCategory(category)
    if (categoryCriteria.length === 0) return 0
    const total = categoryCriteria.reduce((sum, item) => sum + item.progress, 0)
    return Math.round(total / categoryCriteria.length)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            SOC 2 Certification Tracker
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Progress towards SOC 2 Type II certification (6-12 month process)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            View Guidelines
          </Button>
        </div>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-600" />
            Overall Certification Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Completion Status</span>
              <span className="text-sm text-gray-500">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              {Object.entries(categoryIcons).map(([category, Icon]) => {
                const progress = getCategoryProgress(category)
                return (
                  <div key={category} className="text-center">
                    <Icon className={`w-6 h-6 mx-auto mb-2 ${categoryColors[category as keyof typeof categoryColors]}`} />
                    <div className="text-xs font-medium capitalize">{category.replace('_', ' ')}</div>
                    <div className="text-sm font-bold">{progress}%</div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Criteria by Category */}
      <div className="grid gap-6">
        {Object.entries(categoryIcons).map(([category, Icon]) => {
          const categoryCriteria = getCriteriaByCategory(category)
          if (categoryCriteria.length === 0) return null

          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 capitalize">
                  <Icon className={`w-5 h-5 ${categoryColors[category as keyof typeof categoryColors]}`} />
                  {category.replace('_', ' ')} Controls
                  <Badge variant="secondary" className="ml-auto">
                    {getCategoryProgress(category)}% Complete
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryCriteria.map((item) => {
                    const StatusIcon = statusConfig[item.status].icon
                    return (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm">{item.title}</h4>
                              <Badge className={statusConfig[item.status].color}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig[item.status].label}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex-1 mr-4">
                            <Progress value={item.progress} className="h-2" />
                          </div>
                          <span className="text-xs font-medium">{item.progress}%</span>
                        </div>
                        {item.due_date && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            Due: {new Date(item.due_date).toLocaleDateString()}
                          </div>
                        )}
                        {item.notes && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Next Steps & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Complete Risk Assessment Framework</p>
                <p className="text-xs text-gray-600">Finalize risk assessment documentation and mitigation strategies</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Implement Monitoring Controls</p>
                <p className="text-xs text-gray-600">Enhance system monitoring and automated alerting</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Privacy Policy Updates</p>
                <p className="text-xs text-gray-600">Review and update privacy notices and data handling procedures</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Schedule External Audit</p>
                <p className="text-xs text-gray-600">Engage certified SOC 2 auditor for Type II assessment</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}