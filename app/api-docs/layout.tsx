import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Documentation | Word Is Bond',
  description: 'Interactive API documentation for the Word Is Bond Conversation System of Record',
}

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return children
}
