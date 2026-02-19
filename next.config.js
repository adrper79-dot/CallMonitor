/** @type {import('next').NextConfig} */

/**
 * Next.js Configuration for Cloudflare Pages
 *
 * Static export for Cloudflare Pages deployment.
 * Server-side features (auth, API routes) handled by Cloudflare Workers.
 *
 * Build: npm run build → outputs to 'out/'
 * Deploy: wrangler pages deploy out
 */

const nextConfig = {
  // Static export for Cloudflare Pages — all server logic in Workers
  // NOTE: Re-enable for production builds (npm run build + pages:deploy)
  // Disabled for local development so next dev works properly
  output: 'export',

  // Fix workspace root inference issue
  outputFileTracingRoot: __dirname,

  images: {
    // Static export uses unoptimized images, but we configure
    // Cloudflare Image Resizing via a custom loader.
    // Usage: <Image loader={cloudflareLoader} src="/hero.png" ... />
    // @see lib/cloudflare-image-loader.ts
    unoptimized: true,
    // Allow images from our R2 bucket and Cloudflare CDN
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'wordis-bond.com' },
      { protocol: 'https', hostname: '**.pages.dev' },
    ],
  },

  // Trailing slashes for static hosting
  trailingSlash: true,

  // Environment variables exposed to client
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev',
    // Feature flag: set to 'true' to enable new role-based navigation
    NEXT_PUBLIC_NEW_NAV: process.env.NEXT_PUBLIC_NEW_NAV || 'false',
    // COO Item 0.4: Status page is built-in at /status — no external env var needed.
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  // Remove X-Powered-By header
  poweredByHeader: false,

  // Webpack config commented for Turbopack/static export
  // webpack: (config, { isServer }) => { ... },
}

module.exports = nextConfig
