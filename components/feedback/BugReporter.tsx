'use client'

import { useState } from 'react'
import { Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

type IssueType = 'bug' | 'feature' | 'question'

interface FeedbackPayload {
  type: IssueType
  title: string
  description: string
  pageUrl: string
  userAgent: string
}

export function BugReporter() {
  const [open, setOpen] = useState(false)
  const [issueType, setIssueType] = useState<IssueType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const resetForm = () => {
    setIssueType('bug')
    setTitle('')
    setDescription('')
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please provide a brief title for your feedback.',
        variant: 'destructive',
      })
      return
    }

    if (!description.trim()) {
      toast({
        title: 'Description required',
        description: 'Please describe the issue or request in detail.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)

    try {
      const payload: FeedbackPayload = {
        type: issueType,
        title: title.trim(),
        description: description.trim(),
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }

      await apiPost('/api/feedback', payload)

      toast({
        title: 'Feedback submitted',
        description: 'Thank you! Your feedback has been received and will be reviewed by our team.',
      })

      resetForm()
      setOpen(false)
    } catch (error) {
      logger.error('Failed to submit feedback', { error })
      toast({
        title: 'Submission failed',
        description: 'Unable to submit feedback. Please try again or email support@wordis-bond.com.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating trigger button — positioned above Bond AI Chat FAB */}
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="fixed bottom-[5.5rem] right-6 z-50 h-10 w-10 rounded-full shadow-lg hover:shadow-xl transition-shadow p-0"
        aria-label="Report a bug or send feedback"
      >
        <Bug className="h-5 w-5" />
      </Button>

      {/* Feedback dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Report a bug, request a feature, or ask a question. We read every submission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Issue type */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="issue-type">
                Type
              </label>
              <Select
                value={issueType}
                onValueChange={(value) => setIssueType(value as IssueType)}
              >
                <SelectTrigger id="issue-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="feedback-title">
                Title
              </label>
              <Input
                id="feedback-title"
                placeholder="Brief summary of the issue"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="feedback-description">
                Description
              </label>
              <textarea
                id="feedback-description"
                placeholder="Describe the issue, expected behavior, or your request in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={5000}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Page URL (auto-filled, read-only) */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-muted-foreground">
                Page URL
              </label>
              <Input
                value={typeof window !== 'undefined' ? window.location.href : ''}
                readOnly
                tabIndex={-1}
                className="text-xs text-muted-foreground bg-muted"
              />
            </div>

            {/* Screenshot note */}
            <p className="text-xs text-muted-foreground">
              Need to attach screenshots? Send them via email to{' '}
              <a
                href="mailto:support@wordis-bond.com"
                className="text-primary hover:underline"
              >
                support@wordis-bond.com
              </a>{' '}
              referencing your submission.
            </p>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
