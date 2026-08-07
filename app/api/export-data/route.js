import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'
import { formatDateForCSV } from '@/lib/utils'
import { toCsv } from '@/lib/csv'
import { crudLimiter } from '@/lib/rateLimiter'
const archiver = require('archiver')

export const dynamic = 'force-dynamic'

export async function GET(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request)
  } catch (rateLimitError) {
    logger.warn(`[Rate Limit] Data export endpoint: ${rateLimitError.message}`)
    return new Response(JSON.stringify({ error: 'Too many requests, please slow down.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to Data Export API')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Fetch Cycles Data
    const { data: cycles, error: cyclesError } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('user_id', userId)

    if (cyclesError) {
      throw new Error(`Failed to fetch cycles: ${cyclesError.message}`)
    }

    // 2. Fetch Daily Logs Data
    const { data: dailyLogs, error: logsError } = await supabaseAdmin
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)

    if (logsError) {
      throw new Error(`Failed to fetch daily logs: ${logsError.message}`)
    }

    // 3. Set up the ZIP stream response
    // Use Web Streams API ReadableStream to pipe archiver chunks
    const stream = new ReadableStream({
      start(controller) {
        // Next.js ESM interop wraps the CJS module, so we directly instantiate the ZipArchive class
        const archive = new archiver.ZipArchive({
          zlib: { level: 9 } // Sets the compression level
        })

        archive.on('data', (chunk) => {
          controller.enqueue(chunk)
        })

        archive.on('end', () => {
          controller.close()
        })

        archive.on('error', (err) => {
          logger.error('Archiver error:', err)
          controller.error(err)
        })

        // Normalize date-like columns to YYYY-MM-DD so spreadsheets render them cleanly.
        const formatCsvDateFields = (row) => {
          const formattedRow = { ...row }

          Object.entries(formattedRow).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') return
            if (typeof value === 'object' && !(value instanceof Date)) return

            const normalizedKey = key.toLowerCase()
            const isDateColumn =
              normalizedKey === 'date' ||
              normalizedKey.endsWith('_date') ||
              normalizedKey.endsWith('_at') ||
              normalizedKey.endsWith('at') ||
              normalizedKey.endsWith('_timestamp') ||
              normalizedKey.endsWith('timestamp')

            if (isDateColumn) {
              formattedRow[key] = formatDateForCSV(value)
            }
          })

          return formattedRow
        }

        const cycleRows = cycles || []
        const dailyLogRows = dailyLogs || []

        // Append JSON files
        archive.append(JSON.stringify(cycleRows, null, 2), { name: 'cycles.json' })
        archive.append(JSON.stringify(dailyLogRows, null, 2), { name: 'daily_logs.json' })

        // Format date fields before CSV generation (keep JSON exports as full ISO values)
        const cyclesForCsv = cycleRows.map(formatCsvDateFields)
        const dailyLogsForCsv = dailyLogRows.map(formatCsvDateFields)

        // Append CSV files. toCsv() neutralises spreadsheet formula triggers and
        // quotes every field, so a mood note like `=HYPERLINK(...)` is displayed
        // as text instead of being evaluated when the export is opened.
        archive.append(toCsv(cyclesForCsv), { name: 'cycles.csv' })
        archive.append(toCsv(dailyLogsForCsv), { name: 'daily_logs.csv' })

        // Finalize the archive (this triggers 'end')
        archive.finalize()
      }
    })

    // Return the readable stream as a file download
    logger.info(`Data export generated for user ${userId}`)
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=my-hercycle-data.zip',
      },
    })
  } catch (err) {
    logger.error(`Data Export Route Error: ${err.message}`, err.stack)
    return new Response(JSON.stringify({ error: 'Failed to export data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
