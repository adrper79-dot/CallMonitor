import AuthProvider from "../components/AuthProvider"
import UnlockForm from "../components/UnlockForm"
import Navigation from "../components/Navigation"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <AuthProvider>
          <UnlockForm />
          <Navigation />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
