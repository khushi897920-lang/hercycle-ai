'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export default function NewPostPage({ params }) {
  const { locale } = React.use(params);
  const t = useTranslations('Community');
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultCategory = searchParams.get('category');

  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getToken } = useAuth();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/forum/categories')
        const json = await res.json()
        if (json.success && json.data) {
          setCategories(json.data)
          if (defaultCategory) {
            const cat = json.data.find(c => c.slug === defaultCategory)
            if (cat) setCategoryId(cat.id)
          } else if (json.data.length > 0) {
            setCategoryId(json.data[0].id)
          }
        }
      } catch (e) {
        console.error('Failed to load categories:', e)
      }
    }
    fetchCategories()
  }, [defaultCategory])

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !categoryId) return;

    setIsSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ categoryId, title, content }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create post');

      toast.success(t('post_created') || 'Post published anonymously!');
      router.push(`/${locale}/community/post/${data.post.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 w-full">
      <Link 
        href={`/${locale}/community`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        {t('back_to_community') || 'Back to Community'}
      </Link>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          {t('create_new_post') || 'Create New Post'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('category_label') || 'Category'}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
              required
            >
              <option value="" disabled>Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('title_label') || 'Title'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
              placeholder={t('title_placeholder') || 'What do you want to discuss?'}
              required
              maxLength={150}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('content_label') || 'Content'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-y min-h-[150px]"
              placeholder={t('content_placeholder') || 'Share your thoughts, experiences, or questions anonymously...'}
              required
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 flex-1">
              {t('moderation_notice') || 'This community is strictly moderated by AI. Please be kind and respectful.'}
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t('posting') || 'Posting...'}
                </>
              ) : (
                t('publish_post') || 'Publish Post'
              )}
            </button>
          </div>
        </form>
      </div>
      </div>
      <Footer />
    </div>
  );
}
