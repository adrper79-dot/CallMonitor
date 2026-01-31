export async function onRequestPost(context) {
  const { env, request } = context

  try {
    const body = await request.json()
    const { aiAgentId } = body

    if (!aiAgentId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'AI Agent ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get SignalWire credentials from environment
    const projectId = env.SIGNALWIRE_PROJECT_ID
    const apiToken = env.SIGNALWIRE_API_TOKEN
    const spaceUrl = env.SIGNALWIRE_SPACE_URL

    if (!projectId || !apiToken || !spaceUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: 'SignalWire credentials not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(aiAgentId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid AI Agent ID format. Must be a valid UUID.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Basic validation - in a real implementation, this would test the actual SignalWire API
    return new Response(JSON.stringify({
      success: true,
      message: 'AI Agent ID format is valid',
      aiAgentId: aiAgentId,
      configured: {
        projectId: !!projectId,
        apiToken: !!apiToken,
        spaceUrl: !!spaceUrl
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid request format'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}