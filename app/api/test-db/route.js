import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getAuthUserId } from '@/lib/clerk-server'
import { devLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  // 1. Restrict to development only
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Unauthorized production database test request blocked');
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  // ============ RATE LIMITING ============
  try {
    await devLimiter.check(request); // dev-only route, very low limit
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Test-DB endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests. Test route is heavily rate limited.' },
      { status: 429 }
    );
  }
  // =======================================

  // 2. Require Clerk authentication
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to test-db API');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const diagnostics = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Defined (starts with ' + process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 12) + '...)' : 'MISSING',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Defined (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : 'MISSING',
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Defined (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'MISSING',
      clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'Defined' : 'MISSING',
      clerkSecretKey: process.env.CLERK_SECRET_KEY ? 'Defined (length: ' + process.env.CLERK_SECRET_KEY.length + ')' : 'MISSING',
      nodeEnv: process.env.NODE_ENV || 'undefined',
    }

    const supabase = getSupabaseAdmin()
    const start = Date.now()
    
    // Try to query cycles table
    const { data: cycles, error: cyclesError } = await supabase
      .from('cycles')
      .select('id')
      .limit(1)

    const queryTime = Date.now() - start

    if (cyclesError) {
      logger.error('Test DB query failed:', cyclesError.message);
      return NextResponse.json({
        success: false,
        step: 'query_cycles',
        error: cyclesError.message,
        details: cyclesError,
        diagnostics
      }, { status: 500 })
    }

    logger.info('Test DB connection diagnostic successful');
    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful!',
      queryTimeMs: queryTime,
      rowCount: cycles?.length ?? 0,
      diagnostics
    })

  } catch (err) {
    logger.error('Test DB route initialization error:', err.message || err);
    return NextResponse.json({
      success: false,
      step: 'initialization',
      error: err.message || err.toString(),
      diagnostics: {
        nodeEnv: process.env.NODE_ENV || 'undefined',
      }
    }, { status: 500 })
  }
}
