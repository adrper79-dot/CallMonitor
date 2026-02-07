/**
 * Request Body Validation Helper
 *
 * Parses + validates JSON bodies against Zod schemas.
 * Returns a discriminated union for ergonomic usage in route handlers.
 *
 * Usage:
 *   const parsed = await validateBody(c, SignupSchema)
 *   if (!parsed.success) return parsed.response   // pre-built 400 JSON
 *   const { email, password } = parsed.data
 */

import type { Context } from 'hono'
import type { ZodSchema, ZodError } from 'zod'

type ValidationSuccess<T> = { success: true; data: T }
type ValidationFailure = { success: false; error: string; response: Response }

export async function validateBody<T>(
  c: Context,
  schema: ZodSchema<T>
): Promise<ValidationSuccess<T> | ValidationFailure> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    const error = 'Invalid or missing JSON body'
    return {
      success: false,
      error,
      response: c.json({ error, code: 'INVALID_JSON' }, 400) as unknown as Response,
    }
  }

  const result = schema.safeParse(raw)

  if (!result.success) {
    const issues = formatZodErrors(result.error)
    return {
      success: false,
      error: issues,
      response: c.json({ error: issues, code: 'VALIDATION_ERROR' }, 400) as unknown as Response,
    }
  }

  return { success: true, data: result.data }
}

/** Flatten Zod issues into a human-readable string */
function formatZodErrors(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    .join('; ')
}
