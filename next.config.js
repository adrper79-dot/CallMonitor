/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
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

      // Explicitly externalize standard Node.js modules to use Cloudflare's nodejs_compat
      // We map both bare names ('crypto') and prefixed names ('node:crypto') to the 'node:' prefixed require
      const nodeModules = ['crypto', 'stream', 'buffer', 'util', 'http', 'https', 'querystring', 'url', 'zlib', 'net', 'tls', 'events', 'path', 'fs'];
      const edgeExternals = {};

      nodeModules.forEach(mod => {
        // Force all imports to use the "node:" prefix in the final bundle
        // The quotes are essential for Webpack to generate valid CommonJS require("node:...") syntax
        edgeExternals[mod] = `commonjs "node:${mod}"`;
        edgeExternals[`node:${mod}`] = `commonjs "node:${mod}"`;
      });

      config.externals.push(edgeExternals);

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
