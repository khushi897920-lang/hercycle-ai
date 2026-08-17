import { jsonSuccess, jsonError } from '@/lib/api-helpers';
import { getAuthUserId } from '@/lib/clerk-server';
import { moderateContent, OUTCOMES } from '@/lib/ai-moderation';
import { generateAlias } from '@/lib/alias-generator';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { crudLimiter } from '@/lib/rateLimiter';
import { logger } from '@/lib/logger';
import { validateSubmissionLength } from '@/lib/forum-limits';
import {
  buildCursorFilter,
  buildFeedPage,
  buildSearchFilter,
  parseFeedQuery,
} from '@/lib/forum-query';

/**
 * GET /api/forum/posts
 */
export async function GET(req) {
  try {
    await crudLimiter.check(req);
  } catch (rateLimitError) {
    logger.warn(`[Rate Limit] Forum posts GET: ${rateLimitError.message}`);
    return jsonError('Too many requests, please slow down.', 429)
  }

  try {
    const { searchParams } = new URL(req.url);
    const query = parseFeedQuery(searchParams);
    const supabase = getSupabaseAdmin();

    let categoryId = query.categoryId;
    if (categoryId) {
      const { data: category } = await supabase
        .from('forum_categories')
        .select('id')
        .or(`id.eq."${categoryId}",slug.eq."${categoryId}"`)
        .maybeSingle();

      if (!category) {
        return jsonSuccess({ posts: [], nextCursor: null, hasMore: false });
      }
      categoryId = category.id;
    }

    let builder = supabase
      .from('forum_posts')
      .select('id, category_id, author_alias, title, content, upvotes, created_at')
      .order('created_at', { ascending: query.ascending })
      .order('id', { ascending: query.ascending })
      .limit(query.limit + 1);

    if (categoryId) builder = builder.eq('category_id', categoryId);
    if (query.search) builder = builder.or(buildSearchFilter(query.search));
    if (query.cursor) builder = builder.or(buildCursorFilter(query.cursor, query.ascending));

    const { data, error } = await builder;

    if (error) {
      logger.error(`Database error listing forum posts: ${error.message}`);
      return jsonError('Failed to load posts', 500);
    }

    return jsonSuccess(buildFeedPage(data, query.limit));
  } catch (error) {
    logger.error(`Forum posts GET error: ${error.message || error}`);
    return jsonError('Internal server error', 500);
  }
}

export async function POST(req) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(req);
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Forum posts endpoint: ${rateLimitError.message}`);
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
      console.warn(`Malformed JSON payload in forum posts: ${parseError.message}`);
      return jsonError('Bad Request: Invalid JSON payload', 400);
    }
    const { categoryId, title, content } = body;

    if (!categoryId || !title || !content) {
      return jsonError('Missing required fields', 400);
    }

    const lengthError = validateSubmissionLength({ title, content });
    if (lengthError) {
      return jsonError(lengthError, 400);
    }

    // 1. Moderate content (both title and content)
    const moderationResult = await moderateContent(`${title}\n\n${content}`);

    if (!moderationResult.isAppropriate) {
      const isRefusal = moderationResult.outcome === OUTCOMES.REJECTED;
      const msg = isRefusal ? 'Your post violates our community guidelines.' : moderationResult.reason

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
      .from('forum_posts')
      .insert([
        {
          user_id: userId,
          category_id: categoryId,
          author_alias: authorAlias,
          title: title,
          content: content,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error:', error);
      return jsonError('Failed to create post', 500);
    }

    return jsonSuccess({ post: data }, null, 201);
  } catch (error) {
    console.error('Create Post Error:', error);
    return jsonError('Internal server error', 500);
  }
}

