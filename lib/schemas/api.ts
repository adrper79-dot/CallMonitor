import { z } from 'zod'

// Auth
export const sessionSchema = z.object({
  user: z.object({
    id: z.string(), // Changed from z.string().uuid() to z.string() after user_id migration to TEXT
    email: z.string().email(),
    name: z.string().optional(),
    organization_id: z.string().uuid().optional(),
    role: z.enum(['viewer', 'agent', 'manager', 'admin', 'owner']).optional(),
  }).optional(),
  expires: z.string().optional(),
})

export type SessionResponse = z.infer<typeof sessionSchema>

// Calls list
export const callsListSchema = z.object({
  calls: z.array(z.object({
    id: z.string(),
    organization_id: z.string(),
    system_id: z.string().optional(),
    status: z.enum(['queued', 'ringing', 'answered', 'completed', 'failed', 'in_progress']),
    started_at: z.string().optional(),
    ended_at: z.string().optional(),
    created_by: z.string(),
    call_sid: z.string().optional(),
  })),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
})

// Add more schemas...