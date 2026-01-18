/**
 * NextAuth Route Handler
 * 
 * This file only exports the HTTP handlers.
 * Auth configuration is in lib/auth.ts to comply with App Router requirements.
 */

export const dynamic = 'force-dynamic'

import NextAuth from "next-auth"
import { getAuthOptions } from "@/lib/auth"

const handler = NextAuth(getAuthOptions() as any)

export { handler as GET, handler as POST }
