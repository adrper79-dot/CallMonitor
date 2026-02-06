/**
 * Cloudflare Image Resizing Loader
 *
 * Custom Next.js image loader that uses Cloudflare Image Resizing
 * at the edge. Works with static export — no server needed.
 *
 * Usage:
 * ```tsx
 * import { cloudflareLoader } from '@/lib/cloudflare-image-loader'
 * <Image loader={cloudflareLoader} src="/hero.png" width={800} quality={80} />
 * ```
 *
 * Cloudflare Image Resizing transforms images on-the-fly via URL params:
 *   https://voxsouth.online/cdn-cgi/image/width=800,quality=80,format=auto/hero.png
 *
 * Benefits:
 * - Auto WebP/AVIF format negotiation (Accept header)
 * - Edge caching (no origin round-trip after first request)
 * - No build-time image processing needed
 *
 * @see https://developers.cloudflare.com/images/transform-images/
 * @see ARCH_DOCS/CLOUDFLARE_DEPLOYMENT.md
 */

interface CloudflareLoaderParams {
  src: string
  width: number
  quality?: number
}

const CDN_BASE = process.env.NEXT_PUBLIC_CDN_URL || 'https://voxsouth.online'

export function cloudflareLoader({ src, width, quality }: CloudflareLoaderParams): string {
  const params = [
    `width=${width}`,
    `quality=${quality || 80}`,
    'format=auto', // Auto WebP/AVIF based on Accept header
    'fit=scale-down', // Never upscale
  ].join(',')

  // External URLs pass through directly with CF transform
  if (src.startsWith('http')) {
    return `${CDN_BASE}/cdn-cgi/image/${params}/${src}`
  }

  // Local/relative paths
  const cleanSrc = src.startsWith('/') ? src.slice(1) : src
  return `${CDN_BASE}/cdn-cgi/image/${params}/${cleanSrc}`
}

export default cloudflareLoader
