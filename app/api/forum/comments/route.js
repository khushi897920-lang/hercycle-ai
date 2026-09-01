import crypto from 'crypto';

import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/clerk-server';
import { moderateContent, OUTCOMES } from '@/lib/ai-moderation';
import { generateAlias } from '@/lib/alias-generator';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { crudLimiter } from '@/lib/rateLimiter';
import { logger } from '@/lib/logger';
import { validateCommentLength } from '@/lib/forum-limits';
import { notifyOnReply } from '@/lib/actions/push';
import {
  buildCommentCursorFilter,
  buildCommentPage,
  isForumId,
  parseCommentQuery,
} from '@/lib/comment-thread';

/**
 * Looks up the caller's existing votes on a set of comments.
 *
 * `forum_votes.user_id` holds a sha256 of the Clerk id -- the same hash
 * `app/api/forum/vote/route.js` writes -- so the raw id is never stored and
 * this read has to hash before it can match.
 *
 * Returns `{}` for an anonymous caller or on any failure: not knowing a
 * reader's votes must degrade to "no arrows highlighted", never to a failed
 * thread load.
 *
 * @param {object} supabase
 * @param {string|null} userId
 * @param {string[]} commentIds
 * @returns {Promise<Record<string, number>>}
 */
async function fetchViewerVotes(supabase, userId, commentIds) {
  if (!userId || commentIds.length === 0) return {};

  try {
    const hashedUserId = crypto.createHash('sha256').update(userId).digest('hex');

    const { data, error } = await supabase
      .from('forum_votes')
      .select('item_id, vote_value')
      .eq('user_id', hashedUserId)
      .eq('item_type', 'comment')
      .in('item_id', commentIds);

    if (error) {
      logger.warn(`Could not read viewer votes for a comment page: ${error.message}`);
      return {};
    }

    const byId = {};
    for (const row of data || []) byId[row.item_id] = row.vote_value;
    return byId;
  } catch (err) {
    logger.warn(`Could not read viewer votes for a comment page: ${err.message || err}`);
    return {};
  }
}

/**
 * GET /api/forum/comments?postId=...&limit=...&cursor=...
 *
 * This route did not exist -- `route.js` exported only `POST`. The post page
 * server-rendered *every* comment on a post with no `.limit()`:
 *
 *     await supabase.from('forum_comments').select('*').eq('post_id', postId)
 *                   .order('created_at', { ascending: false })
 *
 * so a long thread was an unbounded RSC payload on first paint, and there was
 * nothing for the client to page against even if it had wanted to.
 *
 * Comments are public and already moderated at write time, so this is readable
 * without auth -- the same access the server-rendered page always had. Signing
 * in adds one thing: `userVote` on each row, which is what lets the arrows
 * render in the state the reader left them.
 */
export async function GET(req) {
  try {
    await crudLimiter.check(req);
  } catch (rateLimitError) {
    logger.warn(`[Rate Limit] Forum comments GET: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const query = parseCommentQuery(searchParams);

    if (!query.postId) {
      // A 400, not a 500. Handing a non-UUID to a `uuid` column makes Postgres
      // raise 22P02, which the old code paths reported as a server fault --
      // see the same trap documented in lib/vote-result.js.
      return NextResponse.json(
        { success: false, error: 'A valid postId is required.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    let builder = supabase
      .from('forum_comments')
      .select('id, post_id, author_alias, content, upvotes, created_at')
      .eq('post_id', query.postId)
      .order('created_at', { ascending: false })
      // `created_at` is not unique -- a burst of replies can share a
      // millisecond -- so the id tie-break is what makes paging stable.
      .order('id', { ascending: false })
      // One more than asked for: its presence answers `hasMore` without a
      // second count query over the same range.
      .limit(query.limit + 1);

    if (query.cursor) builder = builder.or(buildCommentCursorFilter(query.cursor));

    const { data, error } = await builder;

    if (error) {
      logger.error(`Database error listing comments for post ${query.postId}: ${error.message}`);
      return NextResponse.json({ success: false, error: 'Failed to load comments' }, { status: 500 });
    }

    const rows = data || [];

    // Auth is optional here, so a failure to resolve a session is "not signed
    // in", not an error.
    let userId = null;
    try {
      userId = await getAuthUserId();
    } catch {
      userId = null;
    }

    const votesById = await fetchViewerVotes(supabase, userId, rows.map((row) => row.id).filter(isForumId));

    return NextResponse.json({
      success: true,
      data: buildCommentPage(rows, query.limit, votesById),
    });
  } catch (error) {
    logger.error(`Forum comments GET error: ${error.message || error}`);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

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
    const { postId, content, parentCommentId, parent_id } = body;
    const parentCommentTargetId = parentCommentId || parent_id;

    if (!postId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Checked before the moderation call, and before Postgres is handed a value
    // it would reject with 22P02 -- which surfaced as `500 "Failed to create
    // comment"` for what is a caller-side mistake.
    if (!isForumId(postId)) {
      return NextResponse.json({ error: 'Invalid postId' }, { status: 400 });
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

    // 4. Trigger reply push notification asynchronously (isolated from comment creation status)
    try {
      let targetUserId = null;
      let postTitle = null;

      if (parentCommentTargetId && isForumId(parentCommentTargetId)) {
        // Reply to another comment
        const { data: parentComment } = await supabase
          .from('forum_comments')
          .select('user_id')
          .eq('id', parentCommentTargetId)
          .single();
        if (parentComment?.user_id) {
          targetUserId = parentComment.user_id;
        }
      }

      // Default / fallback: reply to post author
      const { data: post } = await supabase
        .from('forum_posts')
        .select('user_id, title')
        .eq('id', postId)
        .single();
      if (post) {
        if (!targetUserId) {
          targetUserId = post.user_id;
        }
        postTitle = post.title;
      }

      // Prevent self-reply notification (Requirement C)
      if (targetUserId && targetUserId !== userId) {
        notifyOnReply({
          targetUserId,
          authorAlias,
          postTitle,
          postId,
        }).catch((err) => {
          logger.warn(`Failed to dispatch reply push notification: ${err.message || err}`);
        });
      }
    } catch (notifError) {
      logger.warn(`Error resolving reply notification target: ${notifError.message || notifError}`);
    }

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (error) {
    console.error('Create Comment Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
