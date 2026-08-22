'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import fetchWithTimeout from '@/lib/fetch-with-timeout';
import MarkdownRenderer from './MarkdownRenderer';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Strikethrough,
  Table as TableIcon,
  Columns,
  Edit3,
  Eye,
  Cloud,
  Check,
  Loader2,
  RotateCcw,
  Trash2
} from 'lucide-react';

const DRAFT_STORAGE_KEY = 'hercycle_markdown_draft';

export default function MarkdownEditor({
  value = '',
  onChange,
  title = '',
  onTitleChange,
  categoryId = '',
  onCategoryChange,
  categories = [],
  placeholder = 'Write your blog post or community update in Markdown...',
  minHeight = '350px',
  draftType = 'forum_post',
}) {
  const [content, setContent] = useState(value);
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'edit' | 'preview'
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved_cloud' | 'saved_local' | 'error'
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const { getToken, isSignedIn } = useAuth();

  // Sync internal content when parent value updates externally
  useEffect(() => {
    if (value !== content && saveStatus !== 'saving') {
      setContent(value);
    }
  }, [value]);

  // Load draft on mount (from localStorage first, then Supabase if logged in)
  useEffect(() => {
    const loadDraft = async () => {
      // 1. Try local storage
      let localDraft = null;
      try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          localDraft = JSON.parse(saved);
        }
      } catch (e) {
        console.error('Failed to load local draft:', e);
      }

      // 2. If logged in, fetch cloud draft
      if (isSignedIn) {
        try {
          const token = await getToken();
          const res = await fetchWithTimeout('/api/drafts', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const json = await res.json();
          if (json.success && json.draft) {
            const cloudDraft = json.draft;
            // Use whichever is newer or fallback to cloud draft
            if (!content && cloudDraft.content) {
              setContent(cloudDraft.content);
              if (onChange) onChange(cloudDraft.content);
              if (onTitleChange && cloudDraft.title) onTitleChange(cloudDraft.title);
              if (onCategoryChange && cloudDraft.category_id) onCategoryChange(cloudDraft.category_id);
              setSaveStatus('saved_cloud');
              setHasRestoredDraft(true);
              return;
            }
          }
        } catch (err) {
          console.error('Failed to fetch cloud draft:', err);
        }
      }

      // Fallback to local draft if cloud wasn't loaded
      if (localDraft && !content && (localDraft.content || localDraft.title)) {
        if (localDraft.content) {
          setContent(localDraft.content);
          if (onChange) onChange(localDraft.content);
        }
        if (localDraft.title && onTitleChange) onTitleChange(localDraft.title);
        if (localDraft.categoryId && onCategoryChange) onCategoryChange(localDraft.categoryId);
        setSaveStatus('saved_local');
        setHasRestoredDraft(true);
      }
    };

    loadDraft();
  }, [isSignedIn]);

  // Save function (saves to localStorage immediately, debounces to cloud)
  const triggerAutosave = useCallback(
    (newContent, newTitle = title, newCat = categoryId) => {
      // LocalStorage save
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            content: newContent,
            title: newTitle,
            categoryId: newCat,
            updatedAt: new Date().toISOString(),
          })
        );
        setSaveStatus('saved_local');
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }

      // Clear existing cloud timer
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce Cloud Save (1000ms)
      if (isSignedIn) {
        setSaveStatus('saving');
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            const token = await getToken();
            const res = await fetchWithTimeout('/api/drafts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                title: newTitle,
                content: newContent,
                categoryId: newCat,
                draftType,
              }),
            });
            if (res.ok) {
              setSaveStatus('saved_cloud');
            } else {
              setSaveStatus('saved_local');
            }
          } catch (err) {
            console.error('Cloud draft save error:', err);
            setSaveStatus('saved_local');
          }
        }, 1000);
      }
    },
    [isSignedIn, title, categoryId, draftType, getToken]
  );

  const handleContentChange = (e) => {
    const val = e.target.value;
    setContent(val);
    if (onChange) onChange(val);
    triggerAutosave(val, title, categoryId);
  };

  // Clear draft
  const clearDraft = async () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}

    setContent('');
    if (onChange) onChange('');
    if (onTitleChange) onTitleChange('');
    setSaveStatus('idle');
    setHasRestoredDraft(false);

    if (isSignedIn) {
      try {
        const token = await getToken();
        await fetchWithTimeout('/api/drafts', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error('Failed to delete cloud draft:', err);
      }
    }
  };

  // Formatting Toolbar Helper
  const applyFormat = (syntaxType) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    let replacement = '';
    let newCursorPos = start;

    switch (syntaxType) {
      case 'bold':
        replacement = `**${selectedText || 'bold text'}**`;
        newCursorPos = start + 2;
        break;
      case 'italic':
        replacement = `*${selectedText || 'italic text'}*`;
        newCursorPos = start + 1;
        break;
      case 'h1':
        replacement = `# ${selectedText || 'Heading 1'}`;
        newCursorPos = start + 2;
        break;
      case 'h2':
        replacement = `## ${selectedText || 'Heading 2'}`;
        newCursorPos = start + 3;
        break;
      case 'h3':
        replacement = `### ${selectedText || 'Heading 3'}`;
        newCursorPos = start + 4;
        break;
      case 'bullet':
        replacement = selectedText
          ? selectedText.split('\n').map((line) => `- ${line}`).join('\n')
          : '- List item';
        newCursorPos = start + 2;
        break;
      case 'numbered':
        replacement = selectedText
          ? selectedText.split('\n').map((line, idx) => `${idx + 1}. ${line}`).join('\n')
          : '1. List item';
        newCursorPos = start + 3;
        break;
      case 'quote':
        replacement = selectedText
          ? selectedText.split('\n').map((line) => `> ${line}`).join('\n')
          : '> Blockquote';
        newCursorPos = start + 2;
        break;
      case 'code':
        if (selectedText.includes('\n')) {
          replacement = `\`\`\`javascript\n${selectedText || '// code here'}\n\`\`\``;
          newCursorPos = start + 13;
        } else {
          replacement = `\`${selectedText || 'code'}\``;
          newCursorPos = start + 1;
        }
        break;
      case 'link':
        replacement = `[${selectedText || 'Link Title'}](https://example.com)`;
        newCursorPos = start + 1;
        break;
      case 'strikethrough':
        replacement = `~~${selectedText || 'strikethrough text'}~~`;
        newCursorPos = start + 2;
        break;
      case 'table':
        replacement =
          '\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n';
        newCursorPos = start + 1;
        break;
      default:
        return;
    }

    const newContent =
      content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    if (onChange) onChange(newContent);
    triggerAutosave(newContent, title, categoryId);

    // Maintain focus and cursor selection position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        selectedText ? start + replacement.length : newCursorPos,
        selectedText ? start + replacement.length : newCursorPos + (selectedText ? 0 : replacement.length)
      );
    }, 10);
  };

  return (
    <div className="w-full border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm flex flex-col">
      {/* Editor Header & Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
        {/* Formatting Buttons */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => applyFormat('bold')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Bold (**text**)"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('italic')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Italic (*text*)"
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('strikethrough')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Strikethrough (~~text~~)"
          >
            <Strikethrough size={16} />
          </button>

          <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => applyFormat('h1')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
            title="Heading 1 (#)"
          >
            <Heading1 size={16} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('h2')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
            title="Heading 2 (##)"
          >
            <Heading2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('h3')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
            title="Heading 3 (###)"
          >
            <Heading3 size={16} />
          </button>

          <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => applyFormat('bullet')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Bullet List (-)"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('numbered')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Numbered List (1.)"
          >
            <ListOrdered size={16} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('quote')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Blockquote (>)"
          >
            <Quote size={16} />
          </button>

          <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => applyFormat('code')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Code Block (```)"
          >
            <Code size={16} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('link')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Insert Link ([title](url))"
          >
            <LinkIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('table')}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            title="Insert Table"
          >
            <TableIcon size={16} />
          </button>
        </div>

        {/* View Toggles & Status Pill */}
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <Loader2 size={13} className="animate-spin" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved_cloud' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium" title="Draft saved to Supabase">
              <Cloud size={13} />
              Saved to Cloud
            </span>
          )}
          {saveStatus === 'saved_local' && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium" title="Draft saved to browser storage">
              <Check size={13} />
              Saved Locally
            </span>
          )}

          {/* Clear Draft */}
          {(content || title) && (
            <button
              type="button"
              onClick={clearDraft}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
              title="Discard draft"
            >
              <Trash2 size={15} />
            </button>
          )}

          <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700" />

          {/* View Mode Toggle Buttons */}
          <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'edit'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Edit Mode"
            >
              <Edit3 size={13} />
              <span className="hidden sm:inline">Write</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Side-by-side Live Preview"
            >
              <Columns size={13} />
              <span className="hidden sm:inline">Split</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Preview Only"
            >
              <Eye size={13} />
              <span className="hidden sm:inline">Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Restored Banner Notice */}
      {hasRestoredDraft && (
        <div className="bg-pink-50 dark:bg-pink-950/40 border-b border-pink-100 dark:border-pink-900/50 px-4 py-2 flex items-center justify-between text-xs text-pink-700 dark:text-pink-300">
          <span className="flex items-center gap-1.5">
            <RotateCcw size={13} />
            Restored draft from autosave
          </span>
          <button
            type="button"
            onClick={() => setHasRestoredDraft(false)}
            className="hover:underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Area (Editor & Live Preview) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 min-h-[350px]">
        {/* Editor Pane */}
        {(viewMode === 'split' || viewMode === 'edit') && (
          <div className={`p-4 flex flex-col ${viewMode === 'edit' ? 'md:col-span-2' : ''}`}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder={placeholder}
              className="w-full flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none font-mono text-sm resize-y leading-relaxed min-h-[300px]"
              style={{ minHeight }}
            />
          </div>
        )}

        {/* Live Preview Pane */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div
            className={`p-4 bg-slate-50/50 dark:bg-slate-900/40 overflow-y-auto max-h-[600px] ${
              viewMode === 'preview' ? 'md:col-span-2' : ''
            }`}
          >
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 select-none flex items-center gap-1.5">
              <Eye size={13} /> Live Preview
            </div>
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
