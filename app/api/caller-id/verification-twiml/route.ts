import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/caller-id/verification-twiml
 * 
 * Returns TwiML/LaML that speaks the verification code
 * Called by SignalWire when verification call connects
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code') || '000000'
  
  // Split code into individual digits for clearer speech
  const spokenCode = code.split('').join('. ')
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Hello! This is Word Is Bond verification.
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">
    Your verification code is:
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">
    ${spokenCode}
  </Say>
  <Pause length="2"/>
  <Say voice="Polly.Joanna">
    Again, your code is:
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">
    ${spokenCode}
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">
    Please enter this code in Word Is Bond to verify your number. Goodbye!
  </Say>
</Response>`

  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'application/xml'
    }
  })
}

// Also handle POST (SignalWire sometimes POSTs)
export async function POST(req: NextRequest) {
  return GET(req)
}
