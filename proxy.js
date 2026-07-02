import '@/lib/env'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/auth/login(.*)',
  '/auth/signup(.*)',
  '/auth/callback(.*)',
  '/api/(.*)', // Allow API routes to handle their own auth checks and return clean JSON responses
])

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect()
    }
  },
  { clockSkewInMs: 30000 }
)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/(api|trpc)(.*)',
  ],
}
