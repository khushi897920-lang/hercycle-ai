import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/clerk-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { crudLimiter } from '@/lib/rateLimiter';
import { logger } from '@/lib/logger';

export async function GET(req) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: draft, error } = await supabase
      .from('user_drafts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error(`Error fetching draft for user ${userId}: ${error.message}`);
      return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 });
    }

    return NextResponse.json({ success: true, draft: draft || null });
  } catch (error) {
    logger.error(`GET /api/drafts error: ${error.message || error}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await crudLimiter.check(req);
  } catch (rateLimitError) {
    return NextResponse.json({ error: 'Too many requests, please slow down.' }, { status: 429 });
  }

  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { title = '', content = '', categoryId = '', draftType = 'forum_post' } = body;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_drafts')
      .upsert({
        user_id: userId,
        draft_type: draftType,
        title,
        content,
        category_id: categoryId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      logger.error(`Error upserting draft for user ${userId}: ${error.message}`);
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }

    return NextResponse.json({ success: true, draft: data });
  } catch (error) {
    logger.error(`POST /api/drafts error: ${error.message || error}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('user_drafts')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.error(`Error deleting draft for user ${userId}: ${error.message}`);
      return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Draft cleared' });
  } catch (error) {
    logger.error(`DELETE /api/drafts error: ${error.message || error}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
