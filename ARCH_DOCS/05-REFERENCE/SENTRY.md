# Sentry Guide

## Version
- `@sentry/nextjs`: ^10.36.0

## Config
- `sentry.client.config.ts`: Browser
- `sentry.server.config.ts`: (static export unused?)
- Env: SENTRY_DSN, tracesSampleRate

## Usage
- Auto instrument Next.js/React errors.
- Breadcrumbs, performance traces.

## Best Practices
- Static: client only.
- Release: sentry-cli releases.

## Troubleshooting
- Check dashboard for auth/WebRTC errors.

See sentry.*.config.ts