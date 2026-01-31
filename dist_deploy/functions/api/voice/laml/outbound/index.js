export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: false,
    route: '/api/voice/laml/outbound',
    migration: 'This endpoint is deprecated. Use /api/voice/swml/outbound.'
  }), {
    status: 410,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export async function onRequestPost() {
  return new Response(JSON.stringify({
    error: 'This endpoint is deprecated. Use /api/voice/swml/outbound for outbound calls.',
    migration: 'All outbound call logic must use SWML. See ARCH_DOCS for standards.'
  }), {
    status: 410,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}