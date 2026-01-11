import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const username = String(body?.username ?? '')
    const password = String(body?.password ?? '')

    // guard: require env-based whitelist (keep safe for production)
    const envUser = process.env.UNLOCK_USER ?? ''
    const envPass = process.env.UNLOCK_PASS ?? ''
    if (!envUser || !envPass) {
      return NextResponse.json({ success: false, error: { message: 'Unlock not configured' } }, { status: 501 })
    }

    if (username === envUser && password === envPass) {
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: { message: 'Invalid credentials' } }, { status: 401 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { message: 'Bad request' } }, { status: 400 })
  }
}
