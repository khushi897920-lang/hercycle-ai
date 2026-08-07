import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/clerk-server';
import { moderateContent, OUTCOMES } from '@/lib/ai-moderation';
import { generateAlias } from '@/lib/alias-generator';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { crudLimiter } from '@/lib/rateLimiter';
import { validateCommentLength } from '@/lib/forum-limits';

export async function POST(req) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(req);
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

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.warn(`Malformed JSON payload in forum comments: ${parseError.message}`);
      return NextResponse.json({ error: 'Bad Request: Invalid JSON payload' }, { status: 400 });
    }
    const { postId, content } = body;

    if (!postId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Checked before dispatch so an oversized comment costs a 400 rather than
    // two provider calls. See lib/forum-limits.js.
    const lengthError = validateCommentLength(content);
    if (lengthError) {
      return NextResponse.json({ error: lengthError }, { status: 400 });
    }

    // 1. Moderate content
    const moderationResult = await moderateContent(content);

    if (!moderationResult.isAppropriate) {
      // 403 only when a provider actually refused the comment. A timeout or an
      // outage is a 503 with a message that says so, instead of accusing the
      // user of breaking the community guidelines.
      const isRefusal = moderationResult.outcome === OUTCOMES.REJECTED;

      return NextResponse.json(
        {
          error: isRefusal
            ? 'Your comment violates our community guidelines.'
            : moderationResult.reason,
          reason: moderationResult.reason,
          retryable: moderationResult.retryable,
        },
        { status: moderationResult.status }
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
          user_id: userId,
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
