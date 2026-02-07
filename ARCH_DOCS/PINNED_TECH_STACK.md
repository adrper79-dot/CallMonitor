# Pinned Tech Stack (Lockdown 2026-02-03)

## Frontend (package.json)

- next: 15.5.7
- react: 19.2.4
- react-dom: 19.2.4
- tailwindcss: 4.1.18
- typescript: 5.9.3
- wrangler: 4.61.1

Overrides:

- react: 19.2.4
- react-dom: 19.2.4
- next: 15.5.7
- typescript: 5.9.3
- tailwindcss: 4.1.18

## Backend (workers/package.json)

- hono: 4.7.4
- @neondatabase/serverless: 1.0.2
- typescript: 5.7.3
- wrangler: 4.61.1

Overrides:

- hono: 4.7.4
- typescript: 5.7.3

## Compliance Rules

- All critical deps exact versions (no ^)
- Overrides prevent subdep drift
- npm install reproduces exact tree
- No linux-only deps on Windows dev

Run `npm ci` for reproducible builds.
