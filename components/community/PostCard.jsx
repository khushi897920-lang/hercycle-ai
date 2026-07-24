'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@clerk/nextjs';
import { formatDistanceToNow } from 'date-fns';
import { enUS, hi } from 'date-fns/locale';
import { ArrowUp, ArrowDown, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PostCard({ post, locale }) {

  const dateLocale = locale === 'hi' ? hi : enUS;
  const t = useTranslations('Community');
  const [upvotes, setUpvotes] = useState(post.upvotes || 0);
  const [userVote, setUserVote] = useState(0); // 1 = upvote, -1 = downvote, 0 = none
  const { getToken } = useAuth();

  const handleVote = async (e, value) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic update
    const previousVote = userVote;
    const previousUpvotes = upvotes;

    let newVote = userVote === value ? 0 : value;
    let upvoteChange = 0;

    if (newVote === 0) {
      // Removing vote
      upvoteChange = -previousVote;
    } else {
      // Changing or adding vote
      if (previousVote === 0) {
        upvoteChange = newVote;
      } else {
        upvoteChange = newVote * 2;
      }
    }

    setUpvotes(prev => prev + upvoteChange);
    setUserVote(newVote);

    try {
      const token = await getToken();
      const res = await fetch('/api/forum/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          itemType: 'post',
          itemId: post.id,
          voteValue: value
        })
      });

      if (!res.ok) {
        throw new Error('Failed to vote');
      }
    } catch (error) {
      // Revert on failure
      setUpvotes(previousUpvotes);
      setUserVote(previousVote);
      toast.error(t('vote_failed') || 'Failed to register vote. Please try again.');
    }
  };

  return (
    <Link href={`/${locale}/community/post/${post.id}`}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-4 hover:border-pink-300 dark:hover:border-pink-800 transition-colors cursor-pointer shadow-sm">
        <div className="flex gap-4">
          {/* Vote Column */}
          <div className="flex flex-col items-center justify-start gap-1 pt-1">
            <button
              onClick={(e) => handleVote(e, 1)}
              className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${userVote === 1 ? 'text-pink-500' : 'text-slate-400'}`}
              aria-label="Upvote"
            >
              <ArrowUp size={20} />
            </button>
            <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{upvotes}</span>
            <button
              onClick={(e) => handleVote(e, -1)}
              className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${userVote === -1 ? 'text-blue-500' : 'text-slate-400'}`}
              aria-label="Downvote"
            >
              <ArrowDown size={20} />
            </button>
          </div>

          {/* Content Column */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-700 dark:text-slate-300">
                {post.author_alias}
              </span>
              <span>•</span>
              <time dateTime={post.created_at}>
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                  locale: dateLocale
                })}
              </time>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
              {post.title}
            </h3>

            <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-3 mb-4">
              {post.content}
            </p>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                <MessageSquare size={16} />
                <span>{t('reply') || 'Reply'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
