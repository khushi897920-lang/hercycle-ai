'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function MarkdownRenderer({ content, className = '' }) {
  if (!content || !content.trim()) {
    return (
      <div className="text-slate-400 dark:text-slate-500 italic text-sm py-4">
        Nothing to preview yet. Start typing on the left...
      </div>
    );
  }

  return (
    <div className={`prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 prose-headings:font-bold prose-a:text-pink-500 hover:prose-a:underline prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-pink-600 dark:prose-code:text-pink-400 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-img:rounded-lg ${className}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
