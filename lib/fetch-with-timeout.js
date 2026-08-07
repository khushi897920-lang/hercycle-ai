/**
 * fetchWithTimeout — drop-in `fetch()` wrapper with AbortController timeout.
 *
 * Default timeout: 8 000 ms (8 seconds).
 * Throws `TimeoutError` when the deadline is exceeded so call-sites can
 * detect timeouts specifically and show a friendly message.
 *
 * Every request also carries the caller's local calendar day (see
 * `CLIENT_DAY_HEADER`). The server runs in UTC, so without it there is no way
 * for a route to know which day a user in UTC+5:30 means when they log
 * something at 02:00 — it would record it against the previous day. Attaching
 * the header here rather than at each call site means no route can forget it.
 */

import { CLIENT_DAY_HEADER } from './request-day'
import { getTodayISO } from './date-utils'

const DEFAULT_TIMEOUT_MS = 8000

export class TimeoutError extends Error {
  constructor(ms = DEFAULT_TIMEOUT_MS) {
    super(`Request timed out after ${ms / 1000} seconds. Please check your connection and try again.`)
    this.name = 'TimeoutError'
  }
}

/**
 * @param {string | URL | Request} url
 * @param {RequestInit}            [options]
 * @param {number}                 [timeoutMs=8000]
 * @returns {Promise<Response>}
 */
export default function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const { signal: externalSignal, ...rest } = options

  // If the caller already supplies their own signal, forward its abort
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Merge rather than replace: a caller's own headers win, so this cannot
  // clobber a Content-Type or an explicitly-set day.
  const headers = new Headers(rest.headers || {})
  if (!headers.has(CLIENT_DAY_HEADER)) {
    headers.set(CLIENT_DAY_HEADER, getTodayISO())
  }

  return fetch(url, { ...rest, headers, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError') {
        throw new TimeoutError(timeoutMs)
      }
      throw err
    })
    .finally(() => clearTimeout(timeoutId))
}
