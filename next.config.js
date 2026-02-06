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
  // Use standalone output for Cloudflare deployment, static export for local
  ...(process.env.CLOUDFLARE_ENV ? { output: 'standalone' } : process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  
  // Fix workspace root detection
  outputFileTracingRoot: __dirname,

  
  images: {
    unoptimized: true,
  },

  // Trailing slashes for static hosting
  trailingSlash: true,

  // Environment variables exposed to client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev',
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
