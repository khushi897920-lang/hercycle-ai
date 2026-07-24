import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'
import { toYMD } from '@/lib/utils'
const archiver = require('archiver')

export const dynamic = 'force-dynamic'

export async function GET(request) {
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

        // Helper to generate CSV from an array of objects
        const generateCsv = (data) => {
          if (!data || data.length === 0) return ''
          const keys = Object.keys(data[0])
          const header = keys.join(',')
          const rows = data.map(row =>
            keys.map(key => {
              let val = row[key]
              if (Array.isArray(val)) val = val.join(';')
              if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`
              return val
            }).join(',')
          )
          return [header, ...rows].join('\n')
        }

        // Append JSON files
        archive.append(JSON.stringify(cycles, null, 2), { name: 'cycles.json' })
        archive.append(JSON.stringify(dailyLogs, null, 2), { name: 'daily_logs.json' })

        // Format date fields before CSV generation (keep JSON exports as full ISO values)
        const cyclesForCsv = cycles.map(c => ({
          ...c,
          start_date: toYMD(c.start_date),
          end_date: toYMD(c.end_date),
        }))
        const dailyLogsForCsv = dailyLogs.map(l => ({
          ...l,
          date: toYMD(l.date),
        }))

        // Append CSV files
        archive.append(generateCsv(cycles), { name: 'cycles.csv' })
        archive.append(generateCsv(dailyLogs), { name: 'daily_logs.csv' })

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
