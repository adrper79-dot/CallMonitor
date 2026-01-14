import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import DashboardHome from '@/components/dashboard/DashboardHome'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Command Center | VoxSouth',
  description: 'Your voice intelligence dashboard'
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/api/auth/signin')
  }

  const userId = (session.user as any).id

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
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-3xl">🎛️</span>
                Command Center
              </h1>
              <p className="text-sm text-slate-400">{organizationName}</p>
            </div>
            
            <nav className="flex items-center gap-4">
              <a 
                href="/voice" 
                className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                📞 Calls
              </a>
              <a 
                href="/bookings" 
                className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                📅 Schedule
              </a>
              <a 
                href="/settings" 
                className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                ⚙️ Settings
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <DashboardHome organizationId={organizationId} />
      </main>
    </div>
  )
}
