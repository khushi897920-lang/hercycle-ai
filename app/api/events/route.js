import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/clerk-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { crudLimiter } from '@/lib/rateLimiter';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });

    if (error) {
      logger.error(`[Events GET] Error fetching events for ${userId}: ${error.message}`);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({ success: true, events: events || [] });
  } catch (error) {
    logger.error(`[Events GET] Exception: ${error.message || error}`);
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
    } catch (parseErr) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const {
      title,
      description = '',
      start_time,
      end_time = null,
      recurrence_rule = 'none',
      category = 'reminder',
      time_zone = 'UTC',
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Event title is required' }, { status: 400 });
    }

    if (!start_time) {
      return NextResponse.json({ error: 'Event start time is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: event, error } = await supabase
      .from('events')
      .insert([
        {
          user_id: userId,
          title: title.trim(),
          description: description.trim(),
          start_time,
          end_time: end_time || null,
          recurrence_rule,
          category,
          time_zone,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error(`[Events POST] Error creating event for ${userId}: ${error.message}`);
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    logger.error(`[Events POST] Exception: ${error.message || error}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { id, title, description, start_time, end_time, recurrence_rule, category, time_zone } = body;

    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const updatePayload = {
      title,
      description,
      start_time,
      end_time,
      recurrence_rule,
      category,
      time_zone,
    };

    // Remove undefined values
    Object.keys(updatePayload).forEach(
      (key) => updatePayload[key] === undefined && delete updatePayload[key]
    );

    const { data: updated, error } = await supabase
      .from('events')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error(`[Events PUT] Error updating event ${id} for ${userId}: ${error.message}`);
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: updated });
  } catch (error) {
    logger.error(`[Events PUT] Exception: ${error.message || error}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch (e) {}
    }

    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.error(`[Events DELETE] Error deleting event ${id} for ${userId}: ${error.message}`);
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    logger.error(`[Events DELETE] Exception: ${error.message || error}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
