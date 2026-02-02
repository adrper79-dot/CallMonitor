import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Pages deployment is working!',
    timestamp: new Date().toISOString(),
    environment: 'cloudflare-pages'
  });
}