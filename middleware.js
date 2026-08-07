import createMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import {
  NO_STORE,
  isSensitiveApiPath,
  parseAllowedOrigins,
  resolveCorsHeaders,
} from '@/lib/security-headers.mjs';

const isPublicRoute = createRouteMatcher([
  '/',
  '/:locale',
  '/:locale/auth/login(.*)',
  '/:locale/auth/signup(.*)',
  '/:locale/auth/callback(.*)',
  '/auth/login(.*)',
  '/auth/signup(.*)',
  '/auth/callback(.*)',
  '/api/webhooks(.*)',
  '/manifest.json'
]);

const intlMiddleware = createMiddleware({
  locales: ['en', 'hi'],
  defaultLocale: 'en'
});

/**
 * Origins permitted to make credentialed cross-origin API calls.
 *
 * `CORS_ALLOWED_ORIGINS` takes a comma-separated list; `NEXT_PUBLIC_APP_URL`
 * is accepted as a single-origin shorthand so an existing deployment keeps
 * working without a new variable.
 *
 * Read once at module scope: neither value changes during a process lifetime,
 * and re-parsing per request would run on every asset.
 */
const ALLOWED_ORIGINS = parseAllowedOrigins(
  process.env.CORS_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL
);

/**
 * Applies the headers that can only be decided per request.
 *
 * The static ones — CSP, HSTS, Permissions-Policy and the rest — are set in
 * `next.config.js`, which is the right place for anything that does not depend
 * on the request. These two do:
 *
 * - **CORS**, because the correct `Access-Control-Allow-Origin` is the
 *   request's own `Origin`, checked against an allow-list. The old
 *   configuration emitted `Access-Control-Allow-Origin: <NEXT_PUBLIC_APP_URL>`
 *   on *every* response including HTML and static assets — and an empty value
 *   when that variable was unset — with no `Vary: Origin` anywhere.
 * - **`Cache-Control: no-store` on health endpoints**, belt-and-braces
 *   alongside the same header in `next.config.js`. A Route Handler that sets
 *   its own `Cache-Control` overrides the config; nothing overrides this.
 *
 * @param {Response} response
 * @param {Request} req
 * @returns {Response}
 */
function applyRequestHeaders(response, req) {
  if (!response || !response.headers) return response;

  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith('/api')) {
    const cors = resolveCorsHeaders({
      origin: req.headers.get('origin'),
      allowedOrigins: ALLOWED_ORIGINS,
      isPreflight: req.method === 'OPTIONS',
    });

    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value);
    }
  }

  // Cycle history, daily symptom logs and the PCOD risk assessment were
  // previously served with `private, max-age=60` (300 for the risk score),
  // which permits the browser to write them to its on-disk cache. Signing out
  // does not clear that cache.
  if (isSensitiveApiPath(pathname)) {
    response.headers.set('Cache-Control', NO_STORE);
    response.headers.set('Pragma', 'no-cache');
  }

  return response;
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  // A CORS preflight carries no credentials and must be answered before any
  // auth check — `auth.protect()` would redirect it, and a browser reads a
  // redirected preflight as a failed one.
  if (req.method === 'OPTIONS' && pathname.startsWith('/api')) {
    return applyRequestHeaders(new NextResponse(null, { status: 204 }), req);
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // Apply next-intl middleware to all routes except API and static assets
  if (!pathname.startsWith('/api') && !pathname.startsWith('/manifest.json') && !pathname.includes('.')) {
    return applyRequestHeaders(intlMiddleware(req), req);
  }

  // Previously this returned undefined, which lets the request continue but
  // gives nothing to attach headers to. An explicit `next()` is the same
  // outcome with a response in hand.
  return applyRequestHeaders(NextResponse.next(), req);
}, { clockSkewInMs: 30000 });

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
