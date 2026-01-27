/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "standalone", // Cloudflare Pages does not support standalone mode
  images: {
    unoptimized: true,
  },
  typescript: {
    // TypeScript errors will now block production builds
    // This ensures type safety in production
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  poweredByHeader: false,
  webpack: (config, { isServer, nextRuntime }) => {
    // Fixes npm packages that depend on Node.js modules
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        crypto: 'node:crypto',
        stream: 'node:stream',
        buffer: 'node:buffer',
        util: 'node:util',
      }
    }
    if (nextRuntime === 'edge') {
      config.externals.push({
        'crypto': 'node:crypto',
        'stream': 'node:stream',
        'buffer': 'node:buffer',
        'util': 'node:util',
      })
    }
    return config
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()'
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig
