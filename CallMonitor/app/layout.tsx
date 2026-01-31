import type { Metadata } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import AuthProvider from "../components/AuthProvider"
import Navigation from "../components/Navigation"
import { ErrorBoundary } from "../components/ErrorBoundary"
import { ToastProvider } from "../components/ui/toast"

// Jetsons-inspired typography
const spaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Wordis Bond | The System of Record for Business Conversations',
  description: 'Evidence-grade call monitoring, transcription, and AI-powered analytics. What was said is what matters.',
  keywords: ['call monitoring', 'voice analytics', 'transcription', 'AI', 'evidence-grade', 'enterprise'],
  authors: [{ name: 'Latimer + Woods Tech LLC' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Wordis Bond | The System of Record for Business Conversations',
    description: 'Evidence-grade call monitoring. What was said is what matters.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <meta name="theme-color" content="#FAFAFA" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0A0A1A" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="font-body min-h-screen">
        <ErrorBoundary>
          <AuthProvider>
            <ToastProvider>
              <Navigation />
              {children}
            </ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
