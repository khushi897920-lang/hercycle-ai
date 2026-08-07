'use client';

/**
 * CommunityFeed — the paging, server-searched forum feed.
 *
 * The previous version received a fixed 20-row array and filtered it in the
 * browser, which made the search box search twenty rows rather than the forum
 * and left every older post unreachable. Search, category filtering, sorting
 * and paging now all happen in `GET /api/forum/posts`.
 *
 * The component keeps the server-rendered first page as its initial state, so
 * the feed still paints instantly and without JavaScript — the network is only
 * touched once the user actually searches, filters, sorts or pages.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Hash, Search, Loader2, AlertCircle, X } from 'lucide-react';
import PostCard from '@/components/community/PostCard';
import fetchWithTimeout from '@/lib/fetch-with-timeout';
import {
  DEFAULT_PAGE_SIZE,
  MIN_SEARCH_LENGTH,
  SORT_NEWEST,
  SORT_OLDEST,
  normaliseSearchTerm,
  toQueryString,
} from '@/lib/forum-query';

/**
 * How long to wait after the last keystroke before querying.
 *
 * Long enough that typing a word is one request rather than eight, short enough
 * that it still feels like search-as-you-type.
 */
const SEARCH_DEBOUNCE_MS = 350;

export default function CommunityFeed({
  locale,
  initialCategories = [],
  initialPosts = [],
  initialNextCursor = null,
  initialHasMore = false,
}) {
  const t = useTranslations('Community');

  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [sort, setSort] = useState(SORT_NEWEST);

  const [posts, setPosts] = useState(initialPosts);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [isPagingMore, setIsPagingMore] = useState(false);
  const [error, setError] = useState(null);

  // True until the first user-driven query. While it holds, `posts` is still
  // the server-rendered page, which must not be replaced by a spinner.
  const isPristine = activeSearch === null && categoryId === null && sort === SORT_NEWEST;

  // Guards against an out-of-order response overwriting a newer one: typing
  // "pcod" quickly can leave a request for "pco" in flight behind it, and
  // without this the slower, staler response wins.
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async ({ cursor = null, append = false, search, category, order }) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (append) setIsPagingMore(true);
    else setIsLoading(true);
    setError(null);

    try {
      const qs = toQueryString({
        search,
        categoryId: category,
        sort: order,
        limit: DEFAULT_PAGE_SIZE,
        cursor,
      });
      const res = await fetchWithTimeout(`/api/forum/posts${qs ? `?${qs}` : ''}`);
      const data = await res.json();

      // A newer request has already been issued; this answer is stale.
      if (requestIdRef.current !== requestId) return;

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load discussions');
      }

      setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
      setNextCursor(data.nextCursor);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err.message || 'Failed to load discussions');
      // On a failed "load more" the already-visible posts are deliberately
      // kept: dropping them would punish the user for a transient network
      // error by throwing away everything they had scrolled through.
      if (!append) {
        setPosts([]);
        setNextCursor(null);
        setHasMore(false);
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
        setIsPagingMore(false);
      }
    }
  }, []);

  /* ── Debounced search ─────────────────────────────────────────────────── */
  useEffect(() => {
    const normalised = normaliseSearchTerm(searchInput);

    // Nothing has changed in a way the server would answer differently.
    if (normalised === activeSearch) return undefined;

    const timer = setTimeout(() => {
      setActiveSearch(normalised);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput, activeSearch]);

  /* ── Query on every criteria change ───────────────────────────────────── */
  const didMountRef = useRef(false);
  useEffect(() => {
    // Skip the first run: the server already rendered exactly this page, and
    // re-fetching it would flash a spinner over content that is already correct.
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    fetchPage({ search: activeSearch, category: categoryId, order: sort });
  }, [activeSearch, categoryId, sort, fetchPage]);

  const handleLoadMore = () => {
    if (!nextCursor || isPagingMore) return;
    fetchPage({
      cursor: nextCursor,
      append: true,
      search: activeSearch,
      category: categoryId,
      order: sort,
    });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch(null);
  };

  const activeCategory = initialCategories.find((category) => category.id === categoryId);

  // A term long enough to type but shorter than the minimum would otherwise
  // look like a search returning nothing.
  const searchTooShort =
    searchInput.trim().length > 0 && searchInput.trim().length < MIN_SEARCH_LENGTH;

  const isFiltering = Boolean(activeSearch || categoryId);
  const showEmptyState = !isLoading && posts.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {activeCategory
              ? (t(`cat_${activeCategory.slug}_name`) || activeCategory.name)
              : (t('recent_discussions') || 'Recent Discussions')}
          </h2>
          <Link
            href={`/${locale}/community/new`}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
          >
            {t('new_post') || 'New Post'}
          </Link>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="community-search" className="sr-only">
              {t('search_posts') || 'Search discussions'}
            </label>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="community-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('search_posts') || 'Search discussions'}
              aria-describedby="community-search-hint"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-slate-700 shadow-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label={t('clear_search') || 'Clear search'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div>
            <label htmlFor="community-sort" className="sr-only">
              {t('sort_label') || 'Sort discussions'}
            </label>
            <select
              id="community-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value={SORT_NEWEST}>{t('sort_newest') || 'Newest first'}</option>
              <option value={SORT_OLDEST}>{t('sort_oldest') || 'Oldest first'}</option>
            </select>
          </div>
        </div>

        {/* One live region for every status message, present from first render:
            a container that appears at the same moment as its text is often not
            announced at all. */}
        <p
          id="community-search-hint"
          role="status"
          aria-live="polite"
          className="mb-4 text-xs text-slate-500 dark:text-slate-400 min-h-[1rem]"
        >
          {searchTooShort
            ? (t('search_too_short') || `Type at least ${MIN_SEARCH_LENGTH} characters to search`)
            : isLoading
              ? (t('searching') || 'Searching…')
              : isFiltering
                ? (t('showing_results', { count: posts.length }) || `Showing ${posts.length} result(s)`)
                : ''}
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p>{t('load_failed') || 'Could not load discussions.'}</p>
              <button
                type="button"
                onClick={() => fetchPage({ search: activeSearch, category: categoryId, order: sort })}
                className="mt-1 font-medium underline underline-offset-2"
              >
                {t('retry') || 'Try again'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {isLoading && !isPristine ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span>{t('searching') || 'Searching…'}</span>
            </div>
          ) : posts.length > 0 ? (
            posts.map((post) => <PostCard key={post.id} post={post} locale={locale} />)
          ) : showEmptyState && !error ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <Users className="mx-auto h-12 w-12 text-slate-400 mb-3" aria-hidden="true" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                {isFiltering
                  ? t('no_search_results') || 'No discussions match your search'
                  : t('no_posts_yet') || 'No posts yet'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {isFiltering
                  ? t('try_different_keywords') || 'Try a different keyword or start a new discussion.'
                  : t('be_the_first') || 'Be the first to start a discussion!'}
              </p>
            </div>
          ) : null}
        </div>

        {hasMore && posts.length > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isPagingMore}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-pink-300 hover:text-pink-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {isPagingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isPagingMore
                ? (t('loading') || 'Loading…')
                : (t('load_more') || 'Load more discussions')}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Hash size={18} className="text-pink-500" aria-hidden="true" />
            {t('categories') || 'Categories'}
          </h3>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setCategoryId(null)}
              aria-pressed={categoryId === null}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                categoryId === null
                  ? 'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="font-medium">{t('all_categories') || 'All discussions'}</span>
            </button>

            {initialCategories?.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                aria-pressed={categoryId === category.id}
                className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  categoryId === category.id
                    ? 'bg-pink-50 dark:bg-pink-950/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="font-medium text-slate-800 dark:text-slate-200">
                  {t(`cat_${category.slug}_name`) || category.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {t(`cat_${category.slug}_desc`) || category.description}
                </div>
              </button>
            ))}
          </div>

          {/* The dedicated category pages remain reachable and server-rendered,
              so the feed's in-place filter does not become the only way in. */}
          {activeCategory && (
            <Link
              href={`/${locale}/community/${activeCategory.slug}`}
              className="mt-4 inline-block text-xs font-medium text-pink-600 underline underline-offset-2 dark:text-pink-400"
            >
              {t('open_category_page') || 'Open this category as its own page'}
            </Link>
          )}
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
