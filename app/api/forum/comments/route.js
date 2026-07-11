import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/clerk-server';
import { moderateContent } from '@/lib/ai-moderation';
import { generateAlias } from '@/lib/alias-generator';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { crudLimiter, getRateLimitIdentifier } from '@/lib/rateLimiter';

export async function POST(req) {
  // ============ RATE LIMITING ============
  try {
    const identifier = await getRateLimitIdentifier(req);
    await crudLimiter.check(15, identifier); // 15 comments per minute
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Forum comments endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { error: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // =======================================

  try {
    const userId = await getAuthUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { postId, content } = body;

    if (!postId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Moderate content
    const moderationResult = await moderateContent(content);
    
    if (!moderationResult.isAppropriate) {
      return NextResponse.json(
        { error: 'Your comment violates our community guidelines.', reason: moderationResult.reason },
        { status: 403 }
      );
    }

    // 2. Generate Anonymous Alias
    const authorAlias = generateAlias(userId);

    // 3. Insert into Supabase
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('forum_comments')
      .insert([
        {
          post_id: postId,
          author_alias: authorAlias,
          content: content,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (error) {
    console.error('Create Comment Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
