import { NextResponse } from 'next/server'

function parseFormEncoded(text: string) {
  try {
    const params = new URLSearchParams(text)
    const obj: Record<string, string> = {}
    for (const [k, v] of params.entries()) obj[k] = v
    return obj
  } catch {
    return {}
  }
}

export async function POST(req: Request) {
  const ct = String(req.headers.get('content-type') || '')
  let payload: any = {}
  try {
    if (ct.includes('application/json')) payload = await req.json()
    else {
      const txt = await req.text()
      payload = parseFormEncoded(txt)
    }
  } catch (e) {
    // best-effort
    try { payload = await req.json() } catch { payload = {} }
  }

  // Log minimal info for debugging (do not leak secrets)
  // eslint-disable-next-line no-console
  console.log('laml/outbound webhook', { from: payload.From ?? payload.from, to: payload.To ?? payload.to, callSid: payload.CallSid ?? payload.CallSid })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="woman">Connecting your call. Please hold.</Say>\n</Response>`

  return new NextResponse(xml, { status: 200, headers: { 'Content-Type': 'application/xml' } })
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/voice/laml/outbound' })
}
