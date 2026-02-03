/**
 * API Documentation Page
 * 
 * Displays interactive OpenAPI documentation using Swagger UI
 */

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Documentation | Wordis Bond',
  description: 'Interactive API documentation for the Wordis Bond Conversation System of Record',
}

export default function ApiDocsPage() {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.onload = function() {
                window.ui = SwaggerUIBundle({
                  url: '/openapi.yaml',
                  dom_id: '#swagger-ui',
                  deepLinking: true,
                  presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                  ],
                  plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                  ],
                  layout: "StandaloneLayout",
                  persistAuthorization: true,
                  displayRequestDuration: true,
                  filter: true,
                  showExtensions: true,
                  showCommonExtensions: true,
                  tryItOutEnabled: false,
                  defaultModelsExpandDepth: 2,
                  defaultModelExpandDepth: 2,
                });
              };
            `,
          }}
        />
      </body>
    </html>
  )
}
