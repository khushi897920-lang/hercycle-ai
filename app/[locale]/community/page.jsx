import React from 'react';
import { getTranslations } from 'next-intl/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CommunityFeed from '@/components/community/CommunityFeed';
import { DEFAULT_PAGE_SIZE, buildFeedPage } from '@/lib/forum-query';

export const revalidate = 60; // Revalidate every minute

export default async function CommunityPage({ params }) {
  const { locale } = await params;
  const t = await getTranslations('Community');
  const supabase = getSupabaseAdmin();

  // Fetch categories and the first page of posts.
  //
  // `DEFAULT_PAGE_SIZE + 1` mirrors what `GET /api/forum/posts` does: the extra
  // row is how "is there more?" is answered without a second count query, and
  // `buildFeedPage` trims it off. Sharing the helper is what stops the
  // server-rendered first page and the client's subsequent pages from drifting
  // apart — the previous hard-coded `.limit(20)` here was the reason the feed
  // could not page at all.
  const [{ data: categories }, { data: posts }] = await Promise.all([
    supabase.from('forum_categories').select('*').order('name'),
    supabase
      .from('forum_posts')
      .select('id, category_id, author_alias, title, content, upvotes, created_at')
      .order('created_at', { ascending: false })
      // `created_at` is not unique, so the id tie-break is what keeps the
      // boundary between this page and the next one stable.
      .order('id', { ascending: false })
      .limit(DEFAULT_PAGE_SIZE + 1),
  ]);

  const firstPage = buildFeedPage(posts, DEFAULT_PAGE_SIZE);

  return (
    <div className="page">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          {t('title') || 'Anonymous Community'}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {t('subtitle') || 'A safe, anonymous space to discuss PCOD, cycle tracking, and mental health.'}
        </p>
      </div>

      <CommunityFeed
        locale={locale}
        initialCategories={categories || []}
        initialPosts={firstPage.posts}
        initialNextCursor={firstPage.nextCursor}
        initialHasMore={firstPage.hasMore}
      />
      </div>
      <Footer />
    </div>
  );
}
