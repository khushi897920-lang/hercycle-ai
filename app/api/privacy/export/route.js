import { getAuthUserId } from '@/lib/clerk-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import { formatDateForCSV } from '@/lib/utils';
import { toCsv } from '@/lib/csv';
import { crudLimiter } from '@/lib/rateLimiter';
import { logAuditEvent } from '@/lib/audit-logger';
const archiver = require('archiver');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await crudLimiter.check(request);
  } catch (rateLimitError) {
    logger.warn(`[Rate Limit] Privacy export endpoint: ${rateLimitError.message}`);
    return new Response(JSON.stringify({ error: 'Too many requests, please slow down.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const userId = await getAuthUserId();
    if (!userId) {
      logger.warn('Unauthenticated access attempt to Privacy Export API');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Aggregated queries across user data tables
    const [
      { data: profile },
      { data: cycles },
      { data: dailyLogs },
      { data: weightEntries },
      { data: forumPosts },
      { data: forumComments },
      { data: userBadges },
      { data: challengeProgress },
    ] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('cycles').select('*').eq('user_id', userId),
      supabaseAdmin.from('daily_logs').select('*').eq('user_id', userId),
      supabaseAdmin.from('weight_entries').select('*').eq('user_id', userId),
      supabaseAdmin.from('forum_posts').select('*').eq('user_id', userId),
      supabaseAdmin.from('forum_comments').select('*').eq('author_id', userId),
      supabaseAdmin.from('user_badges').select('*').eq('user_id', userId),
      supabaseAdmin.from('challenge_progress').select('*').eq('user_id', userId),
    ]);

    // 2. Log compliance audit event
    await logAuditEvent({
      userId,
      action: 'DATA_EXPORT',
      details: {
        exportedTables: [
          'user_profiles',
          'cycles',
          'daily_logs',
          'weight_entries',
          'forum_posts',
          'forum_comments',
          'user_badges',
          'challenge_progress',
        ],
      },
    });

    // 3. Construct ZIP Archive Stream
    const stream = new ReadableStream({
      start(controller) {
        const archive = new archiver.ZipArchive({
          zlib: { level: 9 },
        });

        archive.on('data', (chunk) => controller.enqueue(chunk));
        archive.on('end', () => controller.close());
        archive.on('error', (err) => {
          logger.error('Export archive error:', err);
          controller.error(err);
        });

        const formatCsvDateFields = (row) => {
          if (!row) return row;
          const formattedRow = { ...row };
          Object.entries(formattedRow).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') return;
            if (typeof value === 'object' && !(value instanceof Date)) return;
            const k = key.toLowerCase();
            if (k === 'date' || k.endsWith('_date') || k.endsWith('_at') || k.endsWith('timestamp')) {
              formattedRow[key] = formatDateForCSV(value);
            }
          });
          return formattedRow;
        };

        const profileData = profile ? [profile] : [];
        const cycleRows = cycles || [];
        const dailyLogRows = dailyLogs || [];
        const weightRows = weightEntries || [];
        const postRows = forumPosts || [];
        const commentRows = forumComments || [];
        const badgeRows = userBadges || [];
        const challengeRows = challengeProgress || [];

        // Append JSON representations
        archive.append(JSON.stringify(profileData, null, 2), { name: 'user_profile.json' });
        archive.append(JSON.stringify(cycleRows, null, 2), { name: 'cycles.json' });
        archive.append(JSON.stringify(dailyLogRows, null, 2), { name: 'daily_logs.json' });
        archive.append(JSON.stringify(weightRows, null, 2), { name: 'weight_entries.json' });
        archive.append(JSON.stringify(postRows, null, 2), { name: 'forum_posts.json' });
        archive.append(JSON.stringify(commentRows, null, 2), { name: 'forum_comments.json' });
        archive.append(JSON.stringify(badgeRows, null, 2), { name: 'badges.json' });
        archive.append(JSON.stringify(challengeRows, null, 2), { name: 'challenges.json' });

        // Append CSV representations
        archive.append(toCsv(profileData.map(formatCsvDateFields)), { name: 'user_profile.csv' });
        archive.append(toCsv(cycleRows.map(formatCsvDateFields)), { name: 'cycles.csv' });
        archive.append(toCsv(dailyLogRows.map(formatCsvDateFields)), { name: 'daily_logs.csv' });
        archive.append(toCsv(weightRows.map(formatCsvDateFields)), { name: 'weight_entries.csv' });
        archive.append(toCsv(postRows.map(formatCsvDateFields)), { name: 'forum_posts.csv' });
        archive.append(toCsv(commentRows.map(formatCsvDateFields)), { name: 'forum_comments.csv' });
        archive.append(toCsv(badgeRows.map(formatCsvDateFields)), { name: 'badges.csv' });
        archive.append(toCsv(challengeRows.map(formatCsvDateFields)), { name: 'challenges.csv' });

        archive.finalize();
      },
    });

    logger.info(`GDPR data export bundle generated successfully for user ${userId}`);
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=my-hercycle-gdpr-data.zip',
      },
    });
  } catch (err) {
    logger.error(`Privacy Export Route Error: ${err.message}`, err.stack);
    return new Response(JSON.stringify({ error: 'Failed to export privacy data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
