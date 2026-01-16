import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import DashboardHome from '@/components/dashboard/DashboardHome'
import { AppShell } from '@/components/layout/AppShell'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Dashboard | Wordis Bond',
  description: 'Your voice intelligence dashboard'
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/api/auth/signin')
  }

  const userId = (session.user as any).id
  const userEmail = session.user.email || undefined

  // Get user's organization
  const { data: userRows } = await supabaseAdmin
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .limit(1)

  const organizationId = userRows?.[0]?.organization_id || null

  // Get organization details
  let organizationName = 'Your Organization'
  if (organizationId) {
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .limit(1)
    
    organizationName = orgRows?.[0]?.name || organizationName
  }

  return (
    <AppShell organizationName={organizationName} userEmail={userEmail}>
      {/* Page Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back. Here's what's happening with your calls.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <DashboardHome organizationId={organizationId} />
      </div>
    </AppShell>
  )
}
