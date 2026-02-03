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
  // Only use static export for production builds
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  
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
    // Allow builds with TS errors during migration
    ignoreBuildErrors: true,
  },
  
  eslint: {
    // Allow builds with ESLint errors during migration
    ignoreDuringBuilds: true,
  },

  // Remove X-Powered-By header
  poweredByHeader: false,
  
  // Webpack config for Cloudflare compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'pg-native': 'commonjs pg-native',
        bufferutil: 'bufferutil',
        'utf-8-validate': 'utf-8-validate',
      })
    }
    return config
  },
}

module.exports = nextConfig
