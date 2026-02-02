/** @type {import('next').NextConfig} */

/**
 * Next.js Configuration for Static Export
 * 
 * This config produces a fully static site deployed to Cloudflare Pages.
 * API routes are handled separately by Cloudflare Workers (see workers/).
 * 
 * Build: npm run ui:build → outputs to 'out/'
 * Deploy: npm run ui:deploy → Cloudflare Pages
 */

const nextConfig = {
  // Static export for Cloudflare Pages - no adapter conflicts
  output: 'export',
  
  images: {
    unoptimized: true, // CF Images can handle resizing if needed
  },

  // Trailing slashes help with static hosting
  trailingSlash: true,

  // Environment variables exposed to client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev',
  },

  typescript: {
    // Allow builds with TS errors during migration
    ignoreBuildErrors: true,
  },
  
  eslint: {
    // Allow builds with ESLint errors during migration
    ignoreDuringBuilds: true,
  },

  // Remove X-Powered-By header
  poweredByHeader: false,
}

module.exports = nextConfig
