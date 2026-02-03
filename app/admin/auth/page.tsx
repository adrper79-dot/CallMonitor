import AdminAuthDiagnostics from '../../../components/AdminAuthDiagnostics'

export const metadata = {
  title: 'Admin - Auth Providers'
}

export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Admin — Auth Providers</h1>
      <p style={{ color: '#6b7280' }}>View runtime provider diagnostics and toggle Email provider override.</p>
      <div style={{ marginTop: 16 }}>
        <AdminAuthDiagnostics />
      </div>
    </main>
  )
}
