import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/clerk-server';
import { moderateContent } from '@/lib/ai-moderation';
import { generateAlias } from '@/lib/alias-generator';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { crudLimiter } from '@/lib/rateLimiter';

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

    const body = await req.json();
    const { categoryId, title, content } = body;

    if (!categoryId || !title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Moderate content (both title and content)
    const moderationResult = await moderateContent(`${title}\n\n${content}`);
    
    if (!moderationResult.isAppropriate) {
      return NextResponse.json(
        { error: 'Your post violates our community guidelines.', reason: moderationResult.reason },
        { status: 403 }
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
