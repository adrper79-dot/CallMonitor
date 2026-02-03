/**
 * Report Scheduling Component
 * 
 * Allows users to schedule automated report generation
 * Integrates with scheduled_reports table and cron jobs
 * 
 * Features:
 * - Schedule report generation
 * - Set frequency (daily, weekly, monthly)
 * - Configure email delivery
 * - View scheduled reports
 * - Pause/resume schedules
 * 
 * @module components/reports/ReportScheduler
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Calendar, Mail, Loader2, Clock, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface ScheduledReport {
  id: string
  template_id: string
  report_templates: {
    name: string
    report_type: string
  }
  cron_pattern: string
  is_active: boolean
  delivery_config: {
    email_to: string
  }
  last_run: string | null
  next_run: string
  last_report_id: string | null
}

interface ReportTemplate {
  id: string
  name: string
  report_type: string
}

interface ReportSchedulerProps {
  organizationId: string
  templates: ReportTemplate[]
}

export function ReportScheduler({ organizationId, templates }: ReportSchedulerProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<ScheduledReport[]>([])
  const [formData, setFormData] = useState({
    templateId: '',
    frequency: 'daily',
    emailTo: '',
  })

  useEffect(() => {
    if (open) {
      fetchSchedules()
    }
  }, [open])

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/reports/schedules?orgId=${organizationId}`, {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setSchedules(data.schedules || [])
      }
    } catch (error) {
      logger.error('Failed to fetch schedules', error, { organizationId })
    } finally {
      setLoading(false)
    }
  }

  const handleSchedule = async () => {
    if (!formData.templateId || !formData.emailTo) return

    try {
      setLoading(true)

      // Convert frequency to cron pattern
      const cronPatterns: Record<string, string> = {
        daily: '0 0 * * *',     // Daily at midnight
        weekly: '0 0 * * 0',    // Weekly on Sunday
        monthly: '0 0 1 * *',   // Monthly on 1st
      }

      const res = await fetch('/api/reports/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          templateId: formData.templateId,
          cronPattern: cronPatterns[formData.frequency],
          deliveryConfig: {
            email_to: formData.emailTo,
          },
        }),
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to schedule report')

      // Reset form and refresh
      setFormData({ templateId: '', frequency: 'daily', emailTo: '' })
      await fetchSchedules()
    } catch (error) {
      logger.error('Failed to schedule report', error, { organizationId, templateId: formData.templateId })
    } finally {
      setLoading(false)
    }
  }

  const toggleSchedule = async (scheduleId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/reports/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
        credentials: 'include'
      })

      if (res.ok) {
        await fetchSchedules()
      }
    } catch (error) {
      logger.error('Failed to toggle schedule', error, { scheduleId, isActive })
    }
  }

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return

    try {
      const res = await fetch(`/api/reports/schedules/${scheduleId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        await fetchSchedules()
      }
    } catch (error) {
      logger.error('Failed to delete schedule', error, { scheduleId })
    }
  }

  const getFrequencyLabel = (cronPattern: string): string => {
    if (cronPattern.includes('0 0 * * *')) return 'Daily'
    if (cronPattern.includes('0 0 * * 0')) return 'Weekly'
    if (cronPattern.includes('0 0 1 * *')) return 'Monthly'
    return 'Custom'
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Calendar className="mr-2 h-4 w-4" />
          Schedule Reports
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Schedule Automated Reports</DialogTitle>
          <DialogDescription>
            Configure automatic report generation and email delivery
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing Schedules */}
          {schedules.length > 0 && (
            <div className="space-y-2">
              <Label>Active Schedules</Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {schedule.report_templates.name}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {getFrequencyLabel(schedule.cron_pattern)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {schedule.delivery_config.email_to}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Next: {formatDate(schedule.next_run)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={(checked) =>
                          toggleSchedule(schedule.id, checked)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSchedule(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Schedule Form */}
          <div className="space-y-4 pt-4 border-t">
            <Label>Create New Schedule</Label>

            <div className="space-y-2">
              <Label htmlFor="template">Report Template</Label>
              <Select
                value={formData.templateId}
                onValueChange={(value) =>
                  setFormData({ ...formData, templateId: value })
                }
              >
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select report template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) =>
                  setFormData({ ...formData, frequency: value })
                }
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (midnight)</SelectItem>
                  <SelectItem value="weekly">Weekly (Sunday)</SelectItem>
                  <SelectItem value="monthly">Monthly (1st)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="reports@example.com"
                value={formData.emailTo}
                onChange={(e) =>
                  setFormData({ ...formData, emailTo: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={loading || !formData.templateId || !formData.emailTo}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              'Schedule Report'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
