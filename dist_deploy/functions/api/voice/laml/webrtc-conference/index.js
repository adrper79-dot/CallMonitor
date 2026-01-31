export async function onRequestGet() {
  return new Response(JSON.stringify({
    error: 'This endpoint is deprecated. Use /api/voice/swml/bridge for conference calls.',
    migration: 'All conference logic must use SWML. See ARCH_DOCS for standards.'
  }), {
    status: 410,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export async function onRequestPost() {
  return new Response(JSON.stringify({
    error: 'This endpoint is deprecated. Use /api/voice/swml/bridge for conference calls.',
    migration: 'All conference logic must use SWML. See ARCH_DOCS for standards.'
  }), {
    status: 410,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}