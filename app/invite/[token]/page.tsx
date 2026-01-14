import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { Logo } from '@/components/Logo'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { token: string }
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = params

  // Fetch invite details
  const { data: inviteRows, error } = await supabaseAdmin
    .from('team_invites')
    .select(`
      id,
      email,
      role,
      status,
      expires_at,
      organization:organizations!team_invites_organization_id_fkey (
        id,
        name
      )
    `)
    .eq('token', token)
    .limit(1)

  const invite = inviteRows?.[0]

  // Check invite validity
  if (!invite) {
    return (
      <InviteError 
        title="Invitation Not Found" 
        message="This invitation link is invalid or has been removed."
      />
    )
  }

  if (invite.status === 'accepted') {
    return (
      <InviteError 
        title="Already Accepted" 
        message="This invitation has already been used. Sign in to access your team."
        showSignIn
      />
    )
  }

  if (invite.status === 'cancelled') {
    return (
      <InviteError 
        title="Invitation Cancelled" 
        message="This invitation has been cancelled by the team administrator."
      />
    )
  }

  if (new Date(invite.expires_at) < new Date()) {
    // Mark as expired
    await supabaseAdmin
      .from('team_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id)

    return (
      <InviteError 
        title="Invitation Expired" 
        message="This invitation has expired. Please ask your team administrator to send a new one."
      />
    )
  }

  // Check if user is logged in
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  const userEmail = session?.user?.email

  // If logged in, check if email matches
  if (userId && userEmail) {
    if (userEmail.toLowerCase() !== invite.email.toLowerCase()) {
      return (
        <InviteError 
          title="Email Mismatch" 
          message={`This invitation was sent to ${invite.email}. You're signed in as ${userEmail}. Please sign out and sign in with the correct account.`}
          showSignOut
        />
      )
    }

    // Accept the invite!
    const orgId = (invite.organization as any)?.id

    // Check if already a member
    const { data: existingMember } = await supabaseAdmin
      .from('org_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .limit(1)

    if (!existingMember?.[0]) {
      // Add to org_members
      await supabaseAdmin.from('org_members').insert({
        organization_id: orgId,
        user_id: userId,
        role: invite.role,
        invite_id: invite.id
      })

      // Update users table
      await supabaseAdmin
        .from('users')
        .update({ 
          organization_id: orgId,
          role: invite.role
        })
        .eq('id', userId)
    }

    // Mark invite as accepted
    await supabaseAdmin
      .from('team_invites')
      .update({ 
        status: 'accepted',
        accepted_by: userId,
        accepted_at: new Date().toISOString()
      })
      .eq('id', invite.id)

    // Redirect to dashboard
    redirect('/dashboard')
  }

  // Not logged in - show accept page
  const orgName = (invite.organization as any)?.name || 'the team'

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Logo size="lg" />
        </div>

        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            You're Invited!
          </h1>
          <p className="text-slate-400 mb-6">
            You've been invited to join <span className="text-white font-medium">{orgName}</span> on VoxSouth.
          </p>

          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Email</span>
              <span className="text-white">{invite.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Role</span>
              <span className="px-2 py-1 bg-teal-900/50 text-teal-300 rounded-full text-sm capitalize">
                {invite.role}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-500 mb-6">
            Sign in with your email to accept this invitation.
          </p>

          <div className="space-y-3">
            <a
              href={`/api/auth/signin?callbackUrl=/invite/${token}`}
              className="block w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors"
            >
              Sign In to Accept
            </a>
            
            <p className="text-xs text-slate-500">
              Don't have an account? Signing in will create one automatically.
            </p>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Invitation expires {new Date(invite.expires_at).toLocaleDateString()}
        </p>
      </div>
    </main>
  )
}

function InviteError({ 
  title, 
  message, 
  showSignIn, 
  showSignOut 
}: { 
  title: string
  message: string
  showSignIn?: boolean
  showSignOut?: boolean
}) {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">😕</div>
        <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
        <p className="text-slate-400 mb-8">{message}</p>
        
        <div className="space-y-3">
          {showSignIn && (
            <a
              href="/api/auth/signin"
              className="block w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors"
            >
              Sign In
            </a>
          )}
          {showSignOut && (
            <a
              href="/api/auth/signout"
              className="block w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
            >
              Sign Out
            </a>
          )}
          <Link
            href="/"
            className="block w-full py-3 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl font-medium transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  )
}
