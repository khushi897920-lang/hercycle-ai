'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@clerk/nextjs';
import { formatDistanceToNow } from 'date-fns';
import { Send, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase-client';

// Create once at module level — stable reference, no new object on every render
const supabase = createClient();

export default function CommentSection({ postId, initialComments = [] }) {
  const t = useTranslations('Community');
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getToken } = useAuth();

  useEffect(() => {
    // Set up Supabase Realtime subscription
    const channel = supabase.channel(`public:forum_comments:post_id=eq.${postId}`);
    
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'forum_comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          // If we receive a new comment via realtime, add it to the top of the list
          // Ensure we don't duplicate if it's our own comment (though optimistic UI usually needs this check, we aren't doing optimistic insert here)
          setComments((current) => {
            // Check if it already exists (if we added it on successful POST response)
            if (current.some(c => c.id === payload.new.id)) return current;
            return [payload.new, ...current];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/forum/comments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          postId,
          content: newComment,
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to post comment');
      }

      setNewComment('');
      // It will also come through realtime, but we can add it immediately for faster feedback
      setComments((current) => {
        if (current.some(c => c.id === data.comment.id)) return current;
        return [data.comment, ...current];
      });
      toast.success(t('comment_posted') || 'Comment posted anonymously!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const CommentItem = ({ comment }) => {
    const [upvotes, setUpvotes] = useState(comment.upvotes || 0);
    const [userVote, setUserVote] = useState(0);

    const handleVote = async (value) => {
        const previousVote = userVote;
        const previousUpvotes = upvotes;
        let newVote = userVote === value ? 0 : value;
        let upvoteChange = newVote === 0 ? -previousVote : (previousVote === 0 ? newVote : newVote * 2);
    
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
            body: JSON.stringify({ itemType: 'comment', itemId: comment.id, voteValue: value })
          });
          if (!res.ok) throw new Error('Failed to vote');
        } catch (error) {
          setUpvotes(previousUpvotes);
          setUserVote(previousVote);
          toast.error(t('vote_failed') || 'Vote failed');
        }
    };

    return (
      <div className="flex gap-3 p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <div className="flex flex-col items-center gap-1">
          <button onClick={() => handleVote(1)} className={`text-slate-400 hover:text-pink-500 ${userVote === 1 ? 'text-pink-500' : ''}`}><ArrowUp size={16} /></button>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{upvotes}</span>
          <button onClick={() => handleVote(-1)} className={`text-slate-400 hover:text-blue-500 ${userVote === -1 ? 'text-blue-500' : ''}`}><ArrowDown size={16} /></button>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{comment.author_alias}</span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{comment.content}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        {t('comments') || 'Comments'} ({comments.length})
      </h3>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="mb-6 relative">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('write_comment') || 'Share your thoughts anonymously...'}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none"
          rows={3}
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={isSubmitting || !newComment.trim()}
          className="absolute bottom-4 right-4 p-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={18} />
        </button>
      </form>

      {/* Comments List */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {comments.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            {t('no_comments') || 'No comments yet. Be the first to share!'}
          </div>
        ) : (
          comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}
