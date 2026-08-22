import { NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { isAdmin, reason } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: reason || 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const providerFilter = searchParams.get('provider');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('auth_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (providerFilter && providerFilter !== 'all') {
      query = query.eq('provider', providerFilter);
    }

    const { data: logs, error } = await query;

    if (error) {
      logger.error(`[Admin OAuth Logs GET] Error fetching logs: ${error.message}`);
      return NextResponse.json({ error: 'Failed to fetch auth logs' }, { status: 500 });
    }

    return NextResponse.json({ success: true, logs: logs || [] });
  } catch (error) {
    logger.error(`[Admin OAuth Logs GET] Exception: ${error.message || error}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { isAdmin, userId, reason } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: reason || 'Forbidden: Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('auth_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      logger.error(`[Admin OAuth Logs DELETE] Error clearing logs: ${error.message}`);
      return NextResponse.json({ error: 'Failed to clear auth logs' }, { status: 500 });
    }

    // Insert log event for log purge
    await supabase.from('auth_logs').insert([
      {
        provider: 'system',
        event: 'LOGS_CLEARED',
        status: 'info',
        message: 'Auth connection logs cleared by admin',
        user_id: userId,
        created_at: new Date().toISOString(),
      },
    ]);

    return NextResponse.json({ success: true, message: 'Auth connection logs cleared' });
  } catch (error) {
    logger.error(`[Admin OAuth Logs DELETE] Exception: ${error.message || error}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
