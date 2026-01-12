"use server"

import { z } from 'zod'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getServerSession } from 'next-auth/next'
import startCallHandler, { StartCallInput as HandlerInput } from './startCallHandler'

const StartCallSchema = z.object({
  organization_id: z.string().uuid(),
  from_number: z.string().optional(),
  phone_number: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  flow_type: z.enum(['bridge','outbound']).optional(),
  modulations: z.object({ record: z.boolean(), transcribe: z.boolean(), translate: z.boolean().optional(), survey: z.boolean().optional() }),
  actor_id: z.string().optional()
})

export type StartCallInput = HandlerInput

export default async function startCall(input: StartCallInput) {
  try {
    const parsed = StartCallSchema.parse(input)
    const res = await startCallHandler(parsed as HandlerInput, { supabaseAdmin, env: process.env })
    return res
  } catch (e: any) {
    if (e?.errors) {
      return { success: false, error: { id: 'validation', code: 'CALL_START_INVALID_INPUT', message: 'Invalid input', severity: 'MEDIUM' } }
    }
    return { success: false, error: { id: 'unexpected', code: 'CALL_START_UNEXPECTED', message: e?.message ?? 'Unexpected error', severity: 'CRITICAL' } }
  }
}
