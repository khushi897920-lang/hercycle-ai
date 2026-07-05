import createMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/', 
  '/:locale', 
  '/:locale/auth/login(.*)', 
  '/:locale/auth/signup(.*)', 
  '/:locale/auth/callback(.*)', 
  '/auth/login(.*)', 
  '/auth/signup(.*)', 
  '/auth/callback(.*)', 
  '/api(.*)', 
  '/manifest.json'
]);

const intlMiddleware = createMiddleware({
  locales: ['en', 'hi'],
  defaultLocale: 'en'
});

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  
  // Apply next-intl middleware to all routes except API and static assets
  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith('/api') && !pathname.startsWith('/manifest.json') && !pathname.includes('.')) {
    return intlMiddleware(req);
  }
}, { clockSkewInMs: 30000 });

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
