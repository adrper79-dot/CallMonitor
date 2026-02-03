# Cloudflare Pages Deployment Guide

**Status:** Active | **Date:** January 25, 2026

This document outlines the deployment architecture for the project, which is hosted on **Cloudflare Pages**.

## 🏗️ Architecture Overview

The application is a Next.js Full Stack app deployed via **Cloudflare Pages** using the `@cloudflare/next-on-pages` adapter. This allows the Next.js app to run on Cloudflare's Edge Network (Workers).

### Key Components
- **Framework:** Next.js (via `@cloudflare/next-on-pages`)
- **Runtime:** Edge (Cloudflare Workers)
- **Database:** Neon (Postgres) via `pg` library (requires `nodejs_compat`)
- **DNS:** Cloudflare DNS

## ⚙️ Configuration

### 1. `wrangler.toml`
The local development configuration is managed via `wrangler.toml`.
```toml
name = "gemini-project"
pages_build_output_dir = ".vercel/output/static"
compatibility_flags = ["nodejs_compat"]
```

### 2. Compatibility Flags (CRITICAL)
The project relies on standard Node.js APIs (specifically for the `pg` database library). You **MUST** enable the **`nodejs_compat`** compatibility flag in the Cloudflare Dashboard.

- **Dashboard Path:** Settings > Functions > Compatibility Flags
- **Required Flag:** `nodejs_compat`

### 3. Build Settings
- **Framework Preset:** `Next.js`
- **Build Command:** `npx @cloudflare/next-on-pages@1`
- **Output Directory:** `.vercel/output/static`

## 🚀 Deployment Pipeline

### Production
Commits to the `main` branch trigger an automatic build and deployment to the production environment on Cloudflare Pages.

### Preview
Pull Requests (if configured) or manual branches can be deployed to preview environments.
- **Local Preview:** Run `npm run preview` to build and serve the app locally using Wrangler, simulating the Cloudflare environment.

## 🔐 Environment Variables
All environment variables must be set in the Cloudflare Pages Dashboard.
**Path:** Settings > Environment variables

See `ARCH_DOCS/SECRETS_TO_SET.md` for the complete inventory.

## ⚠️ Known Differences from Vercel
1.  **Cron Jobs:** Vercel Cron (`vercel.json`) is **NOT** supported. Use Cloudflare Scheduled Triggers or an external cron service to hit the API endpoints.
2.  **Image Optimization:** Next.js `<Image>` component defaults to unoptimized in this adapter unless Cloudflare Image Resizing is explicitly configured and paid for.
3.  **Edge Runtime:** All API routes run on the Edge. Ensure `export const dynamic = 'force-dynamic'` is set where needed.

## 🐛 Troubleshooting
- **Database Connection Failed:** Check if `nodejs_compat` flag is enabled.
- **Build Error (No Project Settings):** Ensure no Vercel configuration files (`vercel.json`, `.vercel/`) exist in the repo.
- **Build Error (ETARGET/Dependency):** Ensure `package.json` uses a valid Next.js version (e.g., `^14.2.xx`) rather than a non-existent one.
- **Build Token Error:** Disconnect and reconnect the Git repository in Cloudflare Pages settings to refresh the OAuth token.
- **Logs:** View runtime logs in the Cloudflare Dashboard > Deployment > Functions.

## 🔮 Future Capabilities (Enabled by Current Access)

Based on your verified API Token permissions, you have unlocked the full Cloudflare Developer Platform. Here is what you can build next without changing credentials:

### 1. ⚡ Database Acceleration (Hyperdrive)
*   **Permission:** `Hyperdrive:Edit`
*   **Use Case:** Accelerate your **Neon Postgres** connections. Hyperdrive caches connection pools at the Edge, drastically reducing the latency of connecting to a database from Serverless Functions.
*   **Impact:** Faster API responses for database-heavy routes.

### 2. 🤖 Edge AI (Workers AI)
*   **Permission:** `Workers AI:Edit`
*   **Use Case:** Run open-source LLMs (Llama 3, Mistral) or Speech-to-Text (Whisper) directly on Cloudflare's global network.
*   **Impact:** Lower cost than external AI APIs, lower latency, and data privacy (runs in your account).

### 3. 📦 Object Storage (R2)
*   **Permission:** `Workers R2 Storage:Edit`
*   **Use Case:** Store call recordings and evidence bundles cheaply without egress fees.
*   **Impact:** Significant cost savings compared to AWS S3.

### 4. 🔑 Internal Tools Security (Cloudflare Access)
*   **Permission:** `Access: Apps and Policies:Edit`
*   **Use Case:** Put your Admin Dashboard (`/admin`) behind Cloudflare Access (SSO).
*   **Impact:** Zero-Trust security for your internal tools, replacing or augmenting NextAuth for admins.

### 5. 🗄️ Edge Database (D1)
*   **Permission:** `D1:Edit`
*   **Use Case:** Lightweight SQLite database at the edge.
*   **Impact:** Perfect for user settings, feature flags, or caching session data closer to the user.

