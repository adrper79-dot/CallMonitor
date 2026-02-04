# Zod Schemas Guide

## Version
- `zod`: ^3.22.2

## Usage
- Runtime validation for API responses in api-client.ts
- `lib/schemas/api.ts`: sessionSchema, callsListSchema etc.

## Core Pattern
```ts
// lib/schemas/api.ts
export const sessionSchema = z.object({
  user: z.object({ id: z.string(), organizationId: z.string().nullable() }),
  expires: z.string().nullable()
})
```

### Client Fetch Validation
```ts
// lib/api-client.ts
async function apiFetch<T>(endpoint, { schema }: FetchOptions) {
  const data = await response.json()
  if (schema) {
    const parsed = schema.safeParse(data)
    if (!parsed.success) return { success: false, error: 'Invalid data' }
    return { success: true, data: parsed.data }
  }
}

// Usage
api.auth.getSession()  // schema: sessionSchema
```

## Examples
- `sessionSchema`: /api/auth/session response
- `callsListSchema`: /api/calls list

## Best Practices
- Infer types: `z.infer<typeof schema>`
- safeParse for API.
- Refine/transform for complex.

## Troubleshooting
- Validation fail: console.error(parsed.error.issues)

See lib/schemas/api.ts