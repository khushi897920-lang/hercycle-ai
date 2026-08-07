import { NextResponse } from 'next/server';
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
 *
 * Paged, searchable, filterable read of the forum.
 *
 * This route did not exist. `app/[locale]/community/page.jsx` queried Supabase
 * inline with a hard `.limit(20)` and the feed filtered *that slice* in the
 * browser — so the search box searched twenty rows rather than the forum, and
 * every post older than the newest twenty was unreachable through the UI.
 *
 * Query parameters (all optional, all clamped in `lib/forum-query.js`):
 *
 *   q           search text, matched against title and body
 *   categoryId  category slug or id
 *   sort        `newest` (default) | `oldest`
 *   limit       1..50, default 20
 *   cursor      opaque keyset cursor from a previous response
 *
 * Responds `{ success, posts, nextCursor, hasMore }`.
 *
 * Posts are public, anonymous and already moderated at write time, so this is
 * deliberately readable without auth — the same access the server-rendered page
 * always had. It is still rate limited, because an unauthenticated `ilike` scan
 * is the most expensive query in the app.
 */
export async function GET(req) {
  try {
    await crudLimiter.check(req);
  } catch (rateLimitError) {
    logger.warn(`[Rate Limit] Forum posts GET: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const query = parseFeedQuery(searchParams);
    const supabase = getSupabaseAdmin();

    // The feed links to categories by slug while `forum_posts.category_id`
    // stores the id, so accept either and resolve here rather than forcing the
    // client to know which one it holds.
    let categoryId = query.categoryId;
    if (categoryId) {
      const { data: category } = await supabase
        .from('forum_categories')
        .select('id')
        .or(`id.eq."${categoryId}",slug.eq."${categoryId}"`)
        .maybeSingle();

      if (!category) {
        // An unknown category is an empty feed, not an error: a stale bookmark
        // should render "no posts here" rather than a failure state.
        return NextResponse.json({ success: true, posts: [], nextCursor: null, hasMore: false });
      }
      categoryId = category.id;
    }

    let builder = supabase
      .from('forum_posts')
      .select('id, category_id, author_alias, title, content, upvotes, created_at')
      .order('created_at', { ascending: query.ascending })
      // `created_at` is not unique — a seed script can write several rows in the
      // same millisecond — so the id tie-break is what makes paging stable.
      .order('id', { ascending: query.ascending })
      // One more row than asked for: its presence is how `hasMore` is answered
      // without a second count query, which on a filtered ilike scan costs as
      // much again as the page itself.
      .limit(query.limit + 1);

    if (categoryId) builder = builder.eq('category_id', categoryId);
    if (query.search) builder = builder.or(buildSearchFilter(query.search));
    if (query.cursor) builder = builder.or(buildCursorFilter(query.cursor, query.ascending));

    const { data, error } = await builder;

    if (error) {
      logger.error(`Database error listing forum posts: ${error.message}`);
      return NextResponse.json({ success: false, error: 'Failed to load posts' }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...buildFeedPage(data, query.limit) });
  } catch (error) {
    logger.error(`Forum posts GET error: ${error.message || error}`);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(req);
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Forum posts endpoint: ${rateLimitError.message}`);
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
      console.warn(`Malformed JSON payload in forum posts: ${parseError.message}`);
      return NextResponse.json({ error: 'Bad Request: Invalid JSON payload' }, { status: 400 });
    }
    const { categoryId, title, content } = body;

    if (!categoryId || !title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Length is checked here, before anything is sent to a provider. The route
    // previously validated only that the fields were truthy, so a
    // multi-megabyte body was forwarded verbatim to Gemini and then again to
    // Groq on fallback — a slow, expensive request per attempt, reachable by
    // anyone with an account at the ordinary crudLimiter rate.
    const lengthError = validateSubmissionLength({ title, content });
    if (lengthError) {
      return NextResponse.json({ error: lengthError }, { status: 400 });
    }

    // 1. Moderate content (both title and content)
    const moderationResult = await moderateContent(`${title}\n\n${content}`);

    if (!moderationResult.isAppropriate) {
      // A refusal and an outage are no longer the same response. The old code
      // answered both with 403 and "your post violates our community
      // guidelines", so a user whose ordinary post was blocked by a provider
      // timeout was told she had broken the rules.
      const isRefusal = moderationResult.outcome === OUTCOMES.REJECTED;

      return NextResponse.json(
        {
          error: isRefusal
            ? 'Your post violates our community guidelines.'
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
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
    }

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (error) {
    console.error('Create Post Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
