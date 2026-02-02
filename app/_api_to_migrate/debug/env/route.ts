import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Check what's available in the global scope
    const envInfo = {
      // Process env (if available)
      processEnv: {
        NODE_ENV: process.env.NODE_ENV || 'undefined',
        NEON_PG_CONN: process.env.NEON_PG_CONN ? '***SET***' : 'undefined',
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '***SET***' : 'undefined',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'undefined'
      },
      
      // Global objects
      globalThis: {
        hasEnv: 'env' in globalThis,
        hasEnvironment: 'ENVIRONMENT' in globalThis,
        hasCFBindings: 'CF_BINDINGS' in globalThis,
        hasHyperdrive: 'HYPERDRIVE' in globalThis,
        hasKV: 'KV' in globalThis
      },

      // Request context (Cloudflare specific)
      requestContext: !!req.cf,
      
      // Bindings check
      bindings: {
        env: (globalThis as any).env ? Object.keys((globalThis as any).env) : null,
        environment: (globalThis as any).ENVIRONMENT ? Object.keys((globalThis as any).ENVIRONMENT) : null,
        cfBindings: (globalThis as any).CF_BINDINGS ? Object.keys((globalThis as any).CF_BINDINGS) : null
      }
    }

    return NextResponse.json({ success: true, envInfo })
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      stack: err.stack 
    }, { status: 500 })
  }
}