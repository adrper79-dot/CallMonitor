import AuthProvider from "../components/AuthProvider"
import UnlockForm from "../components/UnlockForm"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <AuthProvider>
          <UnlockForm />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
