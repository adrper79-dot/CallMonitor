import AuthProvider from "../components/AuthProvider"
import UnlockForm from "../components/UnlockForm"
import Navigation from "../components/Navigation"
import { ErrorBoundary } from "../components/ErrorBoundary"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
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
