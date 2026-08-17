import { jsonSuccess, jsonError } from '@/lib/api-helpers'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

const DEFAULT_CATEGORIES = [
  {
    id: 'cat-pcod-advice',
    name: 'PCOD Advice',
    slug: 'pcod-advice',
    description: 'Share tips and ask questions about managing PCOD.',
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cat-cycle-tracking',
    name: 'Cycle Tracking',
    slug: 'cycle-tracking',
    description: 'Discuss period tracking, ovulation, and cycle irregularities.',
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cat-mental-health',
    name: 'Mental Health',
    slug: 'mental-health',
    description: 'A safe space to talk about emotional well-being and stress.',
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cat-general-discussion',
    name: 'General Discussion',
    slug: 'general-discussion',
    description: "Talk about anything else related to women's health.",
    created_at: '2026-01-01T00:00:00.000Z'
  }
]

/**
 * GET /api/forum/categories
 * Returns all forum categories using the admin client (bypasses RLS).
 * Categories are fully public data — no auth required.
 * Falls back gracefully to static default categories on database connectivity failure.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('forum_categories')
      .select('*')
      .order('name')

    if (error) {
      logger.warn(`Database error fetching forum categories, serving fallback categories: ${error.message}`)
      return jsonSuccess(DEFAULT_CATEGORIES)
    }

    if (!data || data.length === 0) {
      return jsonSuccess(DEFAULT_CATEGORIES)
    }

    return jsonSuccess(data)
  } catch (err) {
    logger.error(`Forum categories route error, serving fallback categories: ${err.message || err}`, err.stack)
    return jsonSuccess(DEFAULT_CATEGORIES)
  }
}

