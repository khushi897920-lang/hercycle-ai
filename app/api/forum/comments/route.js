import { jsonSuccess, jsonError } from '@/lib/api-helpers';
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
    return jsonError('Too many requests, please slow down.', 429)
  }
  // =======================================

  try {
    const userId = await getAuthUserId();
    
    if (!userId) {
      return jsonError('Unauthorized', 401);
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.warn(`Malformed JSON payload in forum comments: ${parseError.message}`);
      return jsonError('Bad Request: Invalid JSON payload', 400);
    }
    const { postId, content } = body;

    if (!postId || !content) {
      return jsonError('Missing required fields', 400);
    }

    const lengthError = validateCommentLength(content);
    if (lengthError) {
      return jsonError(lengthError, 400);
    }

    // 1. Moderate content
    const moderationResult = await moderateContent(content);

    if (!moderationResult.isAppropriate) {
      const isRefusal = moderationResult.outcome === OUTCOMES.REJECTED;
      const msg = isRefusal ? 'Your comment violates our community guidelines.' : moderationResult.reason

      return jsonError(msg, moderationResult.status, null, {
        reason: moderationResult.reason,
        retryable: moderationResult.retryable
      });
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
      return jsonError('Failed to create comment', 500);
    }

    return jsonSuccess({ comment: data }, null, 201);
  } catch (error) {
    console.error('Create Comment Error:', error);
    return jsonError('Internal server error', 500);
  }
}

