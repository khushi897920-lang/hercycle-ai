import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Handles OAuth callbacks, logging sanitized errors if social login fails/cancels
export async function GET(request) {
  try {
    const searchParams = request.nextUrl ? request.nextUrl.searchParams : new URL(request.url).searchParams
    const error = searchParams.get('error') || searchParams.get('error_code') || searchParams.get('clerk_error')
    const errorDescription = searchParams.get('error_description') || searchParams.get('error_reason')

    if (error || errorDescription) {
      const sanitizedError = String(error || 'oauth_error').replace(/[^a-zA-Z0-9._\-]+/g, '_')
      const rawDescStr = String(errorDescription || '')
      const rawDesc = rawDescStr.includes('@')
        ? rawDescStr.replace(/\b[a-zA-Z0-9._%+\-]{1,64}@[a-zA-Z0-9\-]{1,63}(?:\.[a-zA-Z0-9\-]{1,63})+/g, '[EMAIL_REDACTED]')
        : rawDescStr
      const sanitizedDesc = rawDesc.replace(/(token|code|session|jwt|key)=[^&\s]+/gi, '$1=[REDACTED]')

      logger.warn(`[OAuth Callback] Auth callback error: ${sanitizedError}`, {
        errorCode: sanitizedError,
        description: sanitizedDesc || 'No detailed description provided'
      })

      const origin = new URL(request.url).origin
      return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(sanitizedError)}`)
    }
  } catch (err) {
    logger.error('[OAuth Callback] Exception processing callback:', err.message || err)
  }

  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/`)
}
