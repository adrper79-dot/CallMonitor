import UnlockForm from "../components/UnlockForm"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <UnlockForm />
        {children}
      </body>
    </html>
  )
}
