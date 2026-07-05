import { NextResponse } from 'next/server'

// Clerk handles OAuth callbacks natively via its own middleware.
// This route now just redirects to home — Clerk's session is already set.
export async function GET(request) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/`)
}
