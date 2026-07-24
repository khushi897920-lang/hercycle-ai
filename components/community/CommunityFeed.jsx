'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Hash, Search } from 'lucide-react';
import PostCard from '@/components/community/PostCard';

export default function CommunityFeed({ locale, initialCategories = [], initialPosts = [] }) {
  const t = useTranslations('Community');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return initialPosts;
    }

    return initialPosts.filter((post) => {
      const title = (post.title || '').toLowerCase();
      const content = (post.content || '').toLowerCase();
      return title.includes(normalizedSearch) || content.includes(normalizedSearch);
    });
  }, [initialPosts, searchTerm]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('recent_discussions') || 'Recent Discussions'}
          </h2>
          <Link
            href={`/${locale}/community/new`}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
          >
            {t('new_post') || 'New Post'}
          </Link>
        </div>

        <div className="mb-6">
          <label htmlFor="community-search" className="sr-only">
            {t('search_posts') || 'Search discussions'}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="community-search"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('search_posts') || 'Search discussions'}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredPosts && filteredPosts.length > 0 ? (
            filteredPosts.map((post) => <PostCard key={post.id} post={post} locale={locale} />)
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <Users className="mx-auto h-12 w-12 text-slate-400 mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                {searchTerm
                  ? t('no_search_results') || 'No discussions match your search'
                  : t('no_posts_yet') || 'No posts yet'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {searchTerm
                  ? t('try_different_keywords') || 'Try a different keyword or start a new discussion.'
                  : t('be_the_first') || 'Be the first to start a discussion!'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Hash size={18} className="text-pink-500" />
            {t('categories') || 'Categories'}
          </h3>
          <div className="space-y-2">
            {initialCategories?.map((category) => (
              <Link
                key={category.id}
                href={`/${locale}/community/${category.slug}`}
                className="block px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="font-medium text-slate-800 dark:text-slate-200">
                  {t(`cat_${category.slug}_name`) || category.name}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {t(`cat_${category.slug}_desc`) || category.description}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
            {t('safe_space') || 'A Safe Space'}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {t('safe_space_desc') || 'Your identity is protected. All posts and comments are strictly moderated by AI to ensure a supportive environment for everyone.'}
          </p>
        </div>
      </div>
    </div>
  );
}
