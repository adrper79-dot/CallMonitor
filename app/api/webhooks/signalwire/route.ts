import { NextResponse } from 'next/server'

function parseFormUrlEncoded(body: string) {
  return Object.fromEntries(new URLSearchParams(body))
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let payload: any = null
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      payload = parseFormUrlEncoded(text)
    } else {
      try {
        payload = await req.json()
      } catch (_) {
        payload = await req.text()
      }
    }

    // lightweight, non-sensitive logging for debugging
    // DO NOT log Authorization headers or provider tokens
    // eslint-disable-next-line no-console
    console.log('signalwire webhook received', { path: '/api/webhooks/signalwire', payload: Array.isArray(payload) ? '[array]' : payload })

    // Respond 200 OK so SignalWire knows we received the webhook
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('signalwire webhook handler error', { error: err?.message })
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
