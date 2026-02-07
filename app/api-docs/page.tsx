'use client'

/**
 * API Documentation Page
 *
 * Displays interactive OpenAPI documentation using Swagger UI.
 * Uses dynamic script loading since JSX <script /> tags don't execute in React.
 */

import { useEffect, useRef } from 'react'

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    // Load Swagger UI CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css'
    document.head.appendChild(link)

    // Load Swagger UI JS
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js'
    script.onload = () => {
      // @ts-expect-error SwaggerUIBundle loaded via CDN
      if (typeof window.SwaggerUIBundle !== 'undefined') {
        // @ts-expect-error SwaggerUIBundle loaded via CDN
        window.SwaggerUIBundle({
          url: '/openapi.yaml',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            // @ts-expect-error SwaggerUIBundle loaded via CDN
            window.SwaggerUIBundle.presets.apis,
            // @ts-expect-error SwaggerUIStandalonePreset loaded via CDN
            window.SwaggerUIBundle.SwaggerUIStandalonePreset,
          ],
          plugins: [
            // @ts-expect-error SwaggerUIBundle loaded via CDN
            window.SwaggerUIBundle.plugins.DownloadUrl,
          ],
          layout: 'StandaloneLayout',
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
          tryItOutEnabled: false,
          defaultModelsExpandDepth: 2,
          defaultModelExpandDepth: 2,
        })
      }
    }
    document.body.appendChild(script)

    return () => {
      // Cleanup on unmount
      if (link.parentNode) link.parentNode.removeChild(link)
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div id="swagger-ui" ref={containerRef} />
    </div>
  )
}
