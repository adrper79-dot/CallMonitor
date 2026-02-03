import { z } from 'zod'

// Auth
export const sessionSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().optional(),
    organizationId: z.string().uuid().optional(),
    role: z.enum(['viewer', 'agent', 'manager', 'admin', 'owner']).optional(),
  }).optional(),
  expires: z.string().optional(),
})

export type SessionResponse = z.infer<typeof sessionSchema>

// Calls list
export const callsListSchema = z.object({
  calls: z.array(z.object({
    id: z.string(),
    phoneNumber: z.string(),
    status: z.enum(['queued', 'ringing', 'answered', 'completed', 'failed']),
    createdAt: z.string(),
  })),
})

// Add more schemas...