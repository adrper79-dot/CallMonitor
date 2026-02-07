# Next.js Guide (App Router + Static Export)

## Version

- `next`: ^15.5.2

## Key Features Used

- **App Router** (`app/` dir): pages, layouts, loading.tsx
- **Static Export**: `next.config.js` output: 'export' → CF Pages
- Client Components: "use client"
- Server Actions? Minimal, API via fetch to Workers
- Metadata, SEO optimized.

## Structure

```
app/
├── layout.tsx          # Root layout + AuthProvider
├── page.tsx            # Landing
├── signin/ page.tsx    # Custom auth
├── dashboard/          # Protected
└── voice/              # WebRTC dialer
components/ui/          # shadcn
hooks/                  # useWebRTC, useSession
lib/api-client.ts       # Typed fetch wrapper
```

## Auth Pattern

- Custom: components/AuthProvider.tsx (Context + poll /api/auth/session)
- No NextAuth full; mimics useSession/signIn/signOut

## Static Export Config (next.config.js)

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // ...
}
```

## Examples

### Client Auth Hook

```tsx
// AuthProvider.tsx
export function useSession() {
  return useContext(AuthContext)
}
```

### Page with Auth

```tsx
// app/signin/page.tsx
const { data: session } = useSession()
if (session) router.push('/dashboard')
```

## Best Practices

- Static: no server features, fetch client-side.
- Hydration: loading.tsx, suspense.
- API: NEXT_PUBLIC_API_URL → Workers.
- Tests: vitest components, e2e pages.

## Deployment

```
npm run build    # next build → out/
npm run pages:deploy
```

## Troubleshooting

- Static limits: no dynamic server.
- Auth state: localStorage + poll.
- Images: unoptimized for static.

See app/ dir, next.config.js.
