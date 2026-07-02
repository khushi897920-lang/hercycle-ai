import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { devLimiter, getRateLimitIdentifier } from '@/lib/rateLimiter'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  // ============ RATE LIMITING (NEW CODE) ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await devLimiter.check(2, identifier); // 2 requests per minute
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Test-DB endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests. Test route is heavily rate limited.' },
      { status: 429 }
    );
  }
  // ==================================================

  const diagnostics = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Defined (starts with ' + process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 12) + '...)' : 'MISSING',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Defined (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : 'MISSING',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Defined (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'MISSING',
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'Defined' : 'MISSING',
    clerkSecretKey: process.env.CLERK_SECRET_KEY ? 'Defined (length: ' + process.env.CLERK_SECRET_KEY.length + ')' : 'MISSING',
    nodeEnv: process.env.NODE_ENV || 'undefined',
  }

  try {
    const supabase = getSupabaseAdmin()
    const start = Date.now()
    
    // Try to query cycles table
    const { data: cycles, error: cyclesError } = await supabase
      .from('cycles')
      .select('id')
      .limit(1)

    const queryTime = Date.now() - start

    if (cyclesError) {
      return NextResponse.json({
        success: false,
        step: 'query_cycles',
        error: cyclesError.message,
        details: cyclesError,
        diagnostics
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful!',
      queryTimeMs: queryTime,
      rowCount: cycles?.length ?? 0,
      diagnostics
    })

  } catch (err) {
    return NextResponse.json({
      success: false,
      step: 'initialization',
      error: err.message || err.toString(),
      diagnostics
    }, { status: 500 })
  }
}
