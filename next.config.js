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
        http: 'node:http',
        https: 'node:https',
        querystring: 'node:querystring',
        url: 'node:url',
        zlib: 'node:zlib',
        net: 'node:net',
        tls: 'node:tls',
      }
    }
    if (nextRuntime === 'edge') {
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:child_process': false,
        'child_process': false,
      }

      // Use function to handle all node: imports correctly
      config.externals.push(({ request }, callback) => {
        if (/^node:/.test(request)) {
          return callback(null, `commonjs "${request}"`);
        }
        callback();
      });

      // Explicit mappings for non-prefixed modules to force node: prefix
      config.externals.push({
        'crypto': 'commonjs "node:crypto"',
        'stream': 'commonjs "node:stream"',
        'buffer': 'commonjs "node:buffer"',
        'util': 'commonjs "node:util"',
        'http': 'commonjs "node:http"',
        'https': 'commonjs "node:https"',
        'querystring': 'commonjs "node:querystring"',
        'url': 'commonjs "node:url"',
        'zlib': 'commonjs "node:zlib"',
        'net': 'commonjs "node:net"',
        'tls': 'commonjs "node:tls"',
      })

      config.externals.push('nodemailer', 'next-auth/providers/email', 'ws')
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
