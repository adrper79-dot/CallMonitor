import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthProvider from "../components/AuthProvider"
import UnlockForm from "../components/UnlockForm"
import Navigation from "../components/Navigation"
import { ErrorBoundary } from "../components/ErrorBoundary"

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VoxSouth - Call Monitor & Analytics',
  description: 'Enterprise voice operations, call monitoring, transcription, and analytics platform by Latimer + Woods Tech LLC',
  keywords: ['call monitoring', 'voice analytics', 'transcription', 'SignalWire', 'call recording'],
  authors: [{ name: 'Latimer + Woods Tech LLC' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'VoxSouth - Call Monitor & Analytics',
    description: 'Enterprise voice operations platform',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen`}>
        <ErrorBoundary>
          <AuthProvider>
            <UnlockForm />
            <Navigation />
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
