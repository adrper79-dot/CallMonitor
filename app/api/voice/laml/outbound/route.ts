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

const tryFetchDynamicScript = async (callSid?: string) => {
  try {
    const base = String(process.env.NEXT_PUBLIC_APP_URL || '')
    if (!base || !callSid) return null
    const url = `${base.replace(/\/$/, '')}/api/voice/script?callSid=${encodeURIComponent(callSid)}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const txt = await res.text()
    if (!txt) return null
    return txt
  } catch (e) {
    return null
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

  const from = payload.From ?? payload.from
  const to = payload.To ?? payload.to
  const callSid = payload.CallSid ?? payload.CallSid ?? payload.CallSid

  // Log minimal info for debugging (do not leak secrets)
  // eslint-disable-next-line no-console
  console.log('laml/outbound webhook', { from, to, callSid })

  // Try to fetch dynamic XML script from app; fall back to conference Dial
  const dynamic = await tryFetchDynamicScript(callSid)
  if (dynamic) {
    return new NextResponse(dynamic, { status: 200, headers: { 'Content-Type': 'application/xml' } })
  }

  // Default: join a conference named by callSid so legs can be bridged
  const confName = callSid || `conf-${Date.now()}`
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Dial>\n    <Conference>${confName}</Conference>\n  </Dial>\n</Response>`

  return new NextResponse(xml, { status: 200, headers: { 'Content-Type': 'application/xml' } })
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/voice/laml/outbound' })
}
