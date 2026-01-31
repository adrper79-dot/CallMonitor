import { neon } from '@neondatabase/serverless'

export async function onRequestGet({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)

  try {
    // TODO: Implement authentication
    // const auth = await verifyAuth(request)
    // if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const url = new URL(request.url)
    const organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'Organization ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // TODO: RBAC check

    // Fetch voice targets
    let targets = []
    try {
      targets = await sql`
        SELECT id, phone_number, name, description, is_active, created_at
        FROM voice_targets
        WHERE organization_id = ${organizationId}
        ORDER BY created_at DESC
      `
    } catch (targetsErr) {
      // If table doesn't exist, return empty array
      if (targetsErr.message?.includes('does not exist')) {
        console.log('voice_targets table does not exist yet, returning empty array', { organizationId })
        return new Response(JSON.stringify({
          success: true,
          targets: []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      console.error('Failed to fetch voice_targets', targetsErr, { organizationId })
      return new Response(JSON.stringify({ error: 'Failed to fetch voice targets' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      targets: targets || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('GET /api/voice/targets failed', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}