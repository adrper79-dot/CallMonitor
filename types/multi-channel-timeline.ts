/**
 * Multi-Channel Timeline Type Definitions
 * 
 * Unified communication item types for the collections cockpit timeline.
 */

export type ChannelType = 'call' | 'sms' | 'email' | 'payment_link' | 'note'

export interface BaseTimelineItem {
  id: string
  channel_type: ChannelType
  timestamp: string
  created_by?: string
}

export interface CallTimelineItem extends BaseTimelineItem {
  channel_type: 'call'
  started_at?: string
  ended_at?: string
  status: string
  disposition?: string
  content?: string // disposition_notes
  duration_seconds?: number
}

export interface SmsTimelineItem extends BaseTimelineItem {
  channel_type: 'sms'
  direction: 'inbound' | 'outbound'
  content: string // message_body
  status: string
  to_number: string
  from_number: string
}

export interface EmailTimelineItem extends BaseTimelineItem {
  channel_type: 'email'
  subject: string
  status: string
  opened_at?: string
  clicked_at?: string
  to_email: string
  from_email: string
}

export interface PaymentLinkTimelineItem extends BaseTimelineItem {
  channel_type: 'payment_link'
  amount: number
  status: string
  sent_at?: string
  clicked_at?: string
  paid_at?: string
  link_url: string
}

export interface NoteTimelineItem extends BaseTimelineItem {
  channel_type: 'note'
  title: string
  content?: string // notes field
  type: string
  status: string
}

export type TimelineItem =
  | CallTimelineItem
  | SmsTimelineItem
  | EmailTimelineItem
  | PaymentLinkTimelineItem
  | NoteTimelineItem

export interface TimelinePagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface TimelineResponse {
  success: boolean
  communications: TimelineItem[]
  pagination: TimelinePagination
}
