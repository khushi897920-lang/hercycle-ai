import React from 'react';
import { getTranslations } from 'next-intl/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CommunityFeed from '@/components/community/CommunityFeed';

export const revalidate = 60; // Revalidate every minute

export default async function CommunityPage({ params }) {
  const { locale } = await params;
  const t = await getTranslations('Community');
  const supabase = getSupabaseAdmin();

  // Fetch categories and recent posts
  const [{ data: categories }, { data: posts }] = await Promise.all([
    supabase.from('forum_categories').select('*').order('name'),
    supabase.from('forum_posts').select('*').order('created_at', { ascending: false }).limit(20)
  ]);

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

      <CommunityFeed locale={locale} initialCategories={categories || []} initialPosts={posts || []} />
      </div>
      <Footer />
    </div>
  );
}
